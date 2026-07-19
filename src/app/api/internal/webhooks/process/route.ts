import { NextRequest, NextResponse } from "next/server";
import { processPendingDeliveries } from "@/lib/services/webhooks";
import { getCurrentUser } from "@/lib/auth";
import { hasPermission } from "@/lib/permissions";

/**
 * POST /api/internal/webhooks/process
 * Processar kön av utgående webhookleveranser (retries m.m.).
 * Anropas av cron eller manuellt av admin.
 */
async function processWebhookQueue(req: NextRequest) {
  const cronSecret = process.env.CRON_SECRET;
  const authHeader = req.headers.get("authorization");
  const viaCron = cronSecret && authHeader === `Bearer ${cronSecret}`;

  if (!viaCron) {
    const user = await getCurrentUser();
    if (!user || !hasPermission(user.permissions, "webhooks", "update")) {
      return NextResponse.json(
        { error: { code: "forbidden", message: "Behörighet saknas." } },
        { status: 403 }
      );
    }
  }

  const result = await processPendingDeliveries();
  return NextResponse.json({ data: result });
}

export const GET = processWebhookQueue;
export const POST = processWebhookQueue;
