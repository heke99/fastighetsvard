import { NextRequest, NextResponse } from "next/server";
import { ZodError, type ZodSchema } from "zod";
import { prisma } from "@/lib/db";
import { sha256 } from "@/lib/crypto";
import { ApiError, type ApiContext, authenticateApiRequest, checkRateLimit } from "./auth";
import type { ApiScope } from "@/lib/permissions";
import type { Prisma } from "@prisma/client";

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
      checkRateLimit(ctx.apiKey.id);
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

const IDEMPOTENCY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Idempotency-stöd för muterande anrop. Om samma Idempotency-Key används
 * igen med samma request-body returneras det sparade svaret. Samma nyckel
 * med annan body ger 409.
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
  const requestHash = sha256(bodyText);
  const existing = await prisma.idempotencyRecord.findUnique({
    where: { apiKeyId_idempotencyKey: { apiKeyId: ctx.apiKey.id, idempotencyKey: key } },
  });
  if (existing) {
    if (existing.requestHash !== requestHash) {
      throw new ApiError(
        409,
        "idempotency_conflict",
        "Samma Idempotency-Key har använts med en annan request-body."
      );
    }
    return apiJson(existing.responseBody, existing.responseStatus, ctx);
  }
  const result = await execute();
  await prisma.idempotencyRecord.create({
    data: {
      apiKeyId: ctx.apiKey.id,
      idempotencyKey: key,
      requestHash,
      responseStatus: result.status,
      responseBody: result.body as Prisma.InputJsonValue,
      expiresAt: new Date(Date.now() + IDEMPOTENCY_TTL_MS),
    },
  });
  return apiJson(result.body, result.status, ctx);
}
