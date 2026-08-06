import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { sha256 } from "@/lib/crypto";
import { createAdminClient } from "@/lib/supabase/admin";
import { ApiError, type ApiContext, authenticateApiRequest, checkRateLimit } from "./auth";
import type { ApiScope } from "@/lib/permissions";

export interface Pagination {
  page: number;
  perPage: number;
  skip: number;
  take: number;
}

export function parsePagination(req: NextRequest): Pagination {
  const url = new URL(req.url);
  const page = Math.max(1, parseInt(url.searchParams.get("page") ?? "1", 10) || 1);
  const perPage = Math.min(
    100,
    Math.max(1, parseInt(url.searchParams.get("per_page") ?? "25", 10) || 25)
  );
  return { page, perPage, skip: (page - 1) * perPage, take: perPage };
}

export function paginatedResponse<T>(
  items: T[],
  total: number,
  pagination: Pagination,
  ctx: ApiContext
) {
  return apiJson(
    {
      data: items,
      meta: {
        page: pagination.page,
        per_page: pagination.perPage,
        total,
        total_pages: Math.ceil(total / pagination.perPage),
      },
    },
    200,
    ctx
  );
}

export function apiJson(body: unknown, status: number, ctx?: ApiContext) {
  const headers: Record<string, string> = { "Content-Type": "application/json" };
  if (ctx) {
    headers["X-Request-Id"] = ctx.requestId;
    headers["X-Correlation-Id"] = ctx.correlationId;
  }
  return NextResponse.json(body, { status, headers });
}

export function apiError(error: unknown, ctx?: ApiContext) {
  if (error instanceof ApiError) {
    return apiJson(
      { error: { code: error.code, message: error.message, details: error.details ?? null } },
      error.status,
      ctx
    );
  }
  if (error instanceof ZodError) {
    return apiJson(
      {
        error: {
          code: "validation_error",
          message: "Ogiltiga fält i anropet.",
          details: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })),
        },
      },
      422,
      ctx
    );
  }
  console.error("[api] Oväntat fel:", error);
  return apiJson(
    { error: { code: "internal_error", message: "Ett internt fel inträffade." } },
    500,
    ctx
  );
}

/**
 * Wrapper för API v1-routes: autentisering, scope-kontroll, rate limiting
 * och enhetlig felhantering.
 */
export function withApiAuth(
  scope: ApiScope | undefined,
  handler: (req: NextRequest, ctx: ApiContext, params: Record<string, string>) => Promise<NextResponse>
) {
  return async (
    req: NextRequest,
    routeCtx: { params: Promise<Record<string, string>> }
  ): Promise<NextResponse> => {
    let ctx: ApiContext | undefined;
    try {
      ctx = await authenticateApiRequest(req, scope);
      await checkRateLimit(ctx.apiKey.id);
      const params = await routeCtx.params;
      return await handler(req, ctx, params ?? {});
    } catch (error) {
      return apiError(error, ctx);
    }
  };
}

export async function parseBody<T>(req: NextRequest, schema: ZodSchema<T>): Promise<T> {
  let json: unknown;
  try {
    json = await req.json();
  } catch {
    throw new ApiError(400, "invalid_json", "Request body måste vara giltig JSON.");
  }
  return schema.parse(json);
}

interface AtomicIdempotencyClaim {
  recordId: string;
  isReplay: boolean;
  responseStatus: number | null;
  responseBody: unknown;
}

/**
 * Atomisk claim och replay för API-idempotens. Om domänoperationen lyckas men
 * kvittot inte säkert kan lagras markeras utfallet UNCERTAIN. Samma nyckel får
 * då inte automatiskt köra domänoperationen igen.
 */
export async function withIdempotency(
  req: NextRequest,
  ctx: ApiContext,
  bodyText: string,
  execute: () => Promise<{ status: number; body: unknown }>
): Promise<NextResponse> {
  const key = req.headers.get("idempotency-key");
  if (!key) {
    const result = await execute();
    return apiJson(result.body, result.status, ctx);
  }
  if (key.length > 200) {
    throw new ApiError(400, "invalid_idempotency_key", "Idempotency-Key är för lång.");
  }

  const client = createAdminClient();
  const operation = `api:${req.method}:${new URL(req.url).pathname}`;
  const { data, error } = await client.rpc("claim_idempotent_operation", {
    p_organization_id: ctx.organizationId,
    p_actor_type: "api_key",
    p_actor_id: ctx.apiKey.id,
    p_operation: operation,
    p_idempotency_key: key,
    p_request_hash: sha256(bodyText),
    p_lease_seconds: 120,
  });
  if (error) {
    if (error.message.includes("idempotency_key_reused_with_different_request")) {
      throw new ApiError(409, "idempotency_conflict", "Samma Idempotency-Key har använts med en annan request-body.");
    }
    if (error.message.includes("operation_already_processing")) {
      throw new ApiError(409, "idempotency_in_progress", "En identisk begäran behandlas redan.");
    }
    if (error.message.includes("operation_outcome_uncertain")) {
      throw new ApiError(
        409,
        "idempotency_outcome_uncertain",
        "Den tidigare begäran kan ha slutförts. Skicka inte om operationen med en ny nyckel; kontrollera resultatet eller kontakta support med request-id."
      );
    }
    throw new ApiError(503, "idempotency_unavailable", "Idempotens kunde inte verifieras.");
  }

  const raw = Array.isArray(data) ? data[0] : data;
  const claim = raw as AtomicIdempotencyClaim | null;
  if (!claim?.recordId) {
    throw new ApiError(503, "idempotency_unavailable", "Idempotenssvaret var ogiltigt.");
  }
  if (claim.isReplay) {
    return apiJson(claim.responseBody, claim.responseStatus ?? 200, ctx);
  }

  let result: { status: number; body: unknown };
  try {
    result = await execute();
  } catch (executionError) {
    const failure = await client.rpc("fail_idempotent_operation", {
      p_record_id: claim.recordId,
      p_error: executionError instanceof Error ? executionError.message : "operation_failed",
    });
    if (failure.error) {
      console.error("[api] Idempotency failure state could not be stored", {
        recordId: claim.recordId,
        error: failure.error.message,
      });
    }
    throw executionError;
  }

  const completion = await client.rpc("complete_idempotent_operation", {
    p_record_id: claim.recordId,
    p_response_status: result.status,
    p_response_body: result.body,
  });
  if (completion.error) {
    const uncertain = await client.rpc("mark_idempotent_operation_uncertain", {
      p_record_id: claim.recordId,
      p_response_status: result.status,
      p_response_body: result.body,
      p_error: completion.error.message,
    });
    if (uncertain.error) {
      console.error("[api] Idempotency outcome could not be reconciled", {
        recordId: claim.recordId,
        completionError: completion.error.message,
        reconciliationError: uncertain.error.message,
      });
    }
    throw new ApiError(
      503,
      "idempotency_completion_uncertain",
      "Operationen kan ha slutförts men svaret kunde inte bekräftas. Skicka inte om operationen med en ny nyckel; kontrollera resultatet eller kontakta support med request-id."
    );
  }

  return apiJson(result.body, result.status, ctx);
}
