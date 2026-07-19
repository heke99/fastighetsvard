# Webhooks

## Inkommande webhooks (från bokföringssystem)

### Endpoint

```
POST /api/webhooks/accounting/{provider}
```

`{provider}` = `fortnox`, `visma`, `bjornlunden`, `business_central`, `mock` …
Hemligheten för signering sätts på integrationsanslutningen
(**Admin → Integrationer**; genereras automatiskt om den lämnas tom).

### Eventformat

```json
{
  "id": "evt_12345",
  "type": "invoice.paid",
  "data": {
    "externalId": "INV-9001",
    "invoiceNumber": "2026-1001",
    "externalCustomerId": "KUND-1001",
    "invoiceDate": "2026-06-25",
    "dueDate": "2026-07-31",
    "totalAmount": 7400,
    "vatAmount": 0,
    "paidAmount": 7400,
    "currency": "SEK",
    "status": "paid",
    "lines": []
  }
}
```

### Eventtyper som stöds

- `customer.created`, `customer.updated`
- `invoice.created`, `invoice.updated`, `invoice.sent`, `invoice.paid`,
  `invoice.partially_paid`, `invoice.overdue`, `invoice.credited`
- `payment.created`, `payment.updated`
- `credit_note.created`
- `contract_reference.updated`

### Signering

Header `X-Webhook-Signature` med formatet:

```
t=<unix-timestamp>,v1=<hex(hmac_sha256(secret, "<timestamp>.<raw body>"))>
```

- Fel signatur → `401` + händelsen loggas i revisionsloggen.
- Tidsstämplar äldre än 5 minuter avvisas (**replay-skydd**).

### Idempotens och dubblettskydd

- Varje event dedupliceras på `(organisation, provider, event.id)` – samma
  event flera gånger besvaras med `{"received": true, "duplicate": true}` och
  processas inte om.
- Fakturor/betalningar upsertas via `ExternalReference` med unikt
  `(system, entitetstyp, externt id)` – **ett webhookevent kan aldrig skapa
  dubbla kunder, fakturor, betalningar, avtal eller hyresgäster**.
- Events som inte kan matchas säkert (t.ex. okänd kund) hamnar i
  **granskningskön** (Admin → Integrationer) där administratören matchar
  manuellt och kör om posten.

## Utgående webhooks (till externa system)

### Prenumeration

`POST /api/v1/webhook-subscriptions` (se [API.md](API.md)). Svarets `secret`
används för verifiering. Trasiga mottagare kan stängas av per prenumeration i
**Admin → Webhooks**.

### Eventtyper

`tenant.created`, `tenant.updated`, `contract.created`, `contract.signed`,
`contract.activated`, `contract.terminated`, `unit.created`, `unit.updated`,
`listing.published`, `application.submitted`, `maintenance_request.created`,
`maintenance_request.completed`, `customer.updated`, `invoice.updated`

### Leveransformat

```
POST <subscription.url>
Content-Type: application/json
X-OET-Signature: t=<unix>,v1=<hmac>
X-OET-Event: contract.signed
X-OET-Event-Id: evt_abc123
X-OET-Delivery-Id: <leverans-id>

{"id":"evt_abc123","type":"contract.signed","createdAt":"...","data":{...}}
```

Verifiera på samma sätt som inkommande: HMAC-SHA256 över `"<t>.<body>"` med
prenumerationens secret, avvisa gamla tidsstämplar.

### Leveransgarantier

- **Retries med exponentiell backoff**: 1, 5, 15, 60, 240, 720 minuter
  (max 6 försök), därefter **dead-letter**.
- Leveranslogg med statuskod, fel och antal försök per leverans
  (**Admin → Webhooks**).
- **Manuell återleverans** av dead-letter-poster från admin.
- Mottagare stängs av automatiskt efter 20 misslyckade leveranser i rad
  (kan återaktiveras manuellt).
- Idempotens hos mottagaren: deduplicera på `X-OET-Event-Id`.
- Kön processas av `POST /api/internal/webhooks/process`
  (cron med `Authorization: Bearer $CRON_SECRET`, eller manuellt från admin).
