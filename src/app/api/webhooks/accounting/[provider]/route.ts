import { NextRequest, NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { verifyWebhookSignature } from "@/lib/crypto";
import { upsertExternalInvoice, upsertExternalPayment } from "@/lib/integrations/sync";
import { audit } from "@/lib/audit";
import type { ExternalInvoice, ExternalPayment } from "@/lib/integrations/provider";
import type { Prisma } from "@prisma/client";

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
  const connection = await prisma.integrationConnection.findFirst({
    where: {
      provider,
      isActive: true,
      ...(envelope.organization_id ? { organizationId: envelope.organization_id } : {}),
    },
  });
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

  // Idempotens: har vi redan sett detta event?
  const existing = await prisma.inboundWebhookEvent.findUnique({
    where: {
      organizationId_provider_eventId: {
        organizationId: connection.organizationId,
        provider,
        eventId: envelope.id,
      },
    },
  });
  if (existing) {
    return NextResponse.json({ received: true, duplicate: true }, { status: 200 });
  }

  const event = await prisma.inboundWebhookEvent.create({
    data: {
      organizationId: connection.organizationId,
      provider,
      eventId: envelope.id,
      eventType: envelope.type,
      payload: envelope as unknown as Prisma.InputJsonValue,
      signatureValid: true,
    },
  });

  let processingError: string | null = null;
  try {
    await processInboundEvent(connection.organizationId, provider, envelope);
  } catch (e) {
    processingError = e instanceof Error ? e.message : "Okänt fel";
  }

  await prisma.inboundWebhookEvent.update({
    where: { id: event.id },
    data: { processedAt: new Date(), processingError },
  });

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
    const ref = await prisma.externalReference.findUnique({
      where: {
        organizationId_externalSystem_entityType_externalId: {
          organizationId,
          externalSystem: provider,
          entityType: "customer",
          externalId,
        },
      },
    });
    if (ref?.personId) {
      const d = data as { email?: string; phone?: string; address?: string };
      await prisma.person.update({
        where: { id: ref.personId },
        data: {
          phone: d.phone ?? undefined,
          address: d.address ?? undefined,
        },
      });
      await prisma.externalReference.update({
        where: { id: ref.id },
        data: { lastSyncedAt: new Date() },
      });
    } else {
      // Okänd kund → granskningskö (skapa aldrig okontrollerade kopior).
      const existing = await prisma.syncReviewItem.findFirst({
        where: {
          organizationId,
          externalSystem: provider,
          entityType: "customer",
          externalId,
          status: "PENDING",
        },
      });
      if (!existing) {
        await prisma.syncReviewItem.create({
          data: {
            organizationId,
            entityType: "customer",
            externalSystem: provider,
            externalId,
            payload: data as Prisma.InputJsonValue,
            reason: "Webhook för okänd kund – kräver manuell matchning.",
          },
        });
      }
    }
  } else if (type.startsWith("contract_reference.")) {
    const d = data as { externalContractId?: string; contractNumber?: string };
    if (d.externalContractId && d.contractNumber) {
      const contract = await prisma.contract.findFirst({
        where: { organizationId, contractNumber: d.contractNumber },
      });
      if (contract) {
        await prisma.externalReference.upsert({
          where: {
            organizationId_externalSystem_entityType_externalId: {
              organizationId,
              externalSystem: provider,
              entityType: "contract",
              externalId: d.externalContractId,
            },
          },
          create: {
            organizationId,
            externalSystem: provider,
            entityType: "contract",
            externalId: d.externalContractId,
            contractId: contract.id,
          },
          update: { contractId: contract.id },
        });
      }
    }
  } else {
    throw new Error(`Okänd eventtyp: ${type}`);
  }
}
