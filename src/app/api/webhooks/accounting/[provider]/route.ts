import { NextRequest, NextResponse } from "next/server";
import { verifyWebhookSignature } from "@/lib/crypto";
import { upsertExternalInvoice, upsertExternalPayment } from "@/lib/integrations/sync";
import { audit } from "@/lib/audit";
import type { ExternalInvoice, ExternalPayment } from "@/lib/integrations/provider";
import {
  applyInboundContractReference,
  applyInboundCustomerEvent,
  createInboundWebhookEvent,
  findInboundWebhookConnection,
  finishInboundWebhookEvent,
} from "@/lib/repositories/inbound-webhook-records";

/**
 * POST /api/webhooks/accounting/{provider}
 *
 * Inkommande webhooks från bokföringssystem.
 * - Signaturverifiering (HMAC, header `X-Webhook-Signature`, format t=<unix>,v1=<hmac>).
 * - Replay-skydd via tidsstämpel i signaturen (5 min tolerans).
 * - Idempotens via unikt (organisation, provider, event-id): samma event
 *   som skickas flera gånger skapar aldrig dubbla kunder/fakturor/betalningar.
 */

interface WebhookEnvelope {
  id: string;
  type: string;
  organization_id?: string;
  data: Record<string, unknown>;
}

export async function POST(
  req: NextRequest,
  routeCtx: { params: Promise<{ provider: string }> }
) {
  const { provider } = await routeCtx.params;
  const bodyText = await req.text();
  const signature = req.headers.get("x-webhook-signature") ?? "";

  let envelope: WebhookEnvelope;
  try {
    envelope = JSON.parse(bodyText);
  } catch {
    return NextResponse.json(
      { error: { code: "invalid_json", message: "Body måste vara giltig JSON." } },
      { status: 400 }
    );
  }
  if (!envelope.id || !envelope.type) {
    return NextResponse.json(
      { error: { code: "invalid_event", message: "Event måste ha id och type." } },
      { status: 400 }
    );
  }

  // Hitta anslutningen (per provider). Hemligheten ligger på anslutningen.
  const connection = await findInboundWebhookConnection(
    provider,
    envelope.organization_id
  );
  if (!connection?.webhookSecret) {
    return NextResponse.json(
      { error: { code: "unknown_provider", message: "Ingen aktiv integration för denna provider." } },
      { status: 404 }
    );
  }

  const signatureValid = verifyWebhookSignature(connection.webhookSecret, bodyText, signature);
  if (!signatureValid) {
    await audit({
      organizationId: connection.organizationId,
      actorType: "webhook",
      action: "webhook_signature_invalid",
      entityType: "inbound_webhook",
      after: { provider, eventId: envelope.id },
    });
    return NextResponse.json(
      { error: { code: "invalid_signature", message: "Ogiltig signatur." } },
      { status: 401 }
    );
  }

  const event = await createInboundWebhookEvent({
    organizationId: connection.organizationId,
    provider,
    eventId: envelope.id,
    eventType: envelope.type,
    payload: envelope,
  });
  if (event.duplicate) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  let processingError: string | null = null;
  try {
    await processInboundEvent(connection.organizationId, provider, envelope);
  } catch (e) {
    processingError = e instanceof Error ? e.message : "Okänt fel";
  }

  await finishInboundWebhookEvent(connection.organizationId, event.id, processingError);

  // 200 även vid processfel: eventet är mottaget och loggat; felet hanteras
  // i granskningskön i stället för att providern ska spamma om.
  return NextResponse.json({ received: true, processed: !processingError }, { status: 200 });
}

async function processInboundEvent(
  organizationId: string,
  provider: string,
  envelope: WebhookEnvelope
) {
  const type = envelope.type;
  const data = envelope.data ?? {};

  if (type.startsWith("invoice.")) {
    // invoice.created / invoice.updated / invoice.sent / invoice.paid /
    // invoice.partially_paid / invoice.overdue / invoice.credited
    await upsertExternalInvoice(
      organizationId,
      provider,
      data as unknown as ExternalInvoice
    );
  } else if (type.startsWith("payment.")) {
    await upsertExternalPayment(
      organizationId,
      provider,
      data as unknown as ExternalPayment
    );
  } else if (type.startsWith("credit_note.")) {
    await upsertExternalInvoice(organizationId, provider, {
      ...(data as unknown as ExternalInvoice),
      isCreditNote: true,
    });
  } else if (type.startsWith("customer.")) {
    // Kunduppdatering: uppdatera endast om säker mappning finns.
    const externalId = String((data as { externalId?: string }).externalId ?? "");
    if (!externalId) throw new Error("customer-event saknar externalId.");
    await applyInboundCustomerEvent({
      organizationId,
      provider,
      externalId,
      data: data as { phone?: string; address?: string },
    });
  } else if (type.startsWith("contract_reference.")) {
    const d = data as { externalContractId?: string; contractNumber?: string };
    if (d.externalContractId && d.contractNumber) {
      await applyInboundContractReference({
        organizationId,
        provider,
        externalContractId: d.externalContractId,
        contractNumber: d.contractNumber,
      });
    }
  } else {
    throw new Error(`Okänd eventtyp: ${type}`);
  }
}
