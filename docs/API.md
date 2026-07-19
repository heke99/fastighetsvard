# REST API v1

Maskinläsbar specifikation: `GET /api/v1/openapi` (OpenAPI 3.0).

## Autentisering

API-nycklar skapas under **Admin → API-nycklar** (visas endast en gång) och
skickas som Bearer-token:

```
Authorization: Bearer oet_xxxxxxxx...
```

- Varje nyckel har **scopes** per resurs (t.ex. `customers:read`, `invoices:write`).
- Valfri **IP-begränsning** per nyckel.
- **Rotation**: skapa ny nyckel, revokera den gamla (revokerade nycklar avvisas direkt).
- Rate limit: 300 anrop/minut per nyckel → `429 rate_limited`.

## Konventioner

- Pagination: `?page=1&per_page=25` (max 100). Svar innehåller `meta.total`.
- Sortering: `?sort=-created_at` m.fl. per resurs.
- Datumfilter: t.ex. `?due_from=2026-01-01&due_to=2026-01-31`.
- Alla svar har `X-Request-Id` och `X-Correlation-Id` (skicka egen via `X-Correlation-Id`).
- Fel: `{"error": {"code": "...", "message": "...", "details": ...}}` med
  koder som `unauthenticated`, `invalid_api_key`, `insufficient_scope`,
  `not_found`, `validation_error` (422), `idempotency_conflict` (409),
  `rate_limited` (429).
- **Idempotency**: skicka `Idempotency-Key`-header på POST. Samma nyckel + samma
  body ⇒ sparat svar returneras. Samma nyckel + annan body ⇒ `409`.

## Resurser

| Endpoint | Metoder | Scope |
| --- | --- | --- |
| `/api/v1/customers` | GET, POST | `customers:read/write` |
| `/api/v1/customers/{id}` | GET, PATCH | `customers:read/write` |
| `/api/v1/tenants` | GET (`?active=true`) | `tenants:read` |
| `/api/v1/properties` | GET | `properties:read` |
| `/api/v1/buildings` | GET | `buildings:read` |
| `/api/v1/units` | GET | `units:read` |
| `/api/v1/listings` | GET | `listings:read` |
| `/api/v1/applications` | GET | `applications:read` |
| `/api/v1/contracts` | GET | `contracts:read` |
| `/api/v1/invoices` | GET | `invoices:read` |
| `/api/v1/invoices/{id}` | GET | `invoices:read` |
| `/api/v1/invoices/sync` | POST | `invoices:write` |
| `/api/v1/payments` | GET | `payments:read` |
| `/api/v1/payments/sync` | POST | `payments:write` |
| `/api/v1/maintenance-requests` | GET, POST | `maintenance:read/write` |
| `/api/v1/webhook-subscriptions` | GET, POST | `webhook-subscriptions:read/write` |
| `/api/v1/webhook-subscriptions/{id}` | GET, DELETE | `webhook-subscriptions:read/write` |

## Exempelanrop

### Lista kunder

```bash
curl -H "Authorization: Bearer $API_KEY" \
  "https://host/api/v1/customers?search=andersson&page=1&per_page=25"
```

### Skapa kund (dubblettskyddad + idempotent)

```bash
curl -X POST "https://host/api/v1/customers" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Idempotency-Key: 7f3c1e2a-..." \
  -H "Content-Type: application/json" \
  -d '{
    "first_name": "Anna",
    "last_name": "Andersson",
    "email": "anna@example.com",
    "external_system": "fortnox",
    "external_customer_id": "KUND-1001"
  }'
```

Om `external_system` + `external_customer_id` eller e-posten redan finns
returneras den **befintliga** personen med `"deduplicated": true` – dubbletter
skapas aldrig.

### Pusha fakturor från bokföringssystemet

```bash
curl -X POST "https://host/api/v1/invoices/sync" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Idempotency-Key: batch-2026-07-01" \
  -H "Content-Type: application/json" \
  -d '{
    "invoices": [{
      "external_system": "fortnox",
      "external_id": "INV-9001",
      "invoice_number": "2026-1001",
      "external_customer_id": "KUND-1001",
      "invoice_date": "2026-06-25",
      "due_date": "2026-07-31",
      "total_amount": 7400,
      "vat_amount": 0,
      "paid_amount": 0,
      "status": "sent",
      "ocr": "202610011",
      "bankgiro": "123-4567",
      "reference": "HK-2022-1",
      "lines": [{
        "description": "Hyra juli 2026",
        "quantity": 1, "unit_price": 7400, "vat_rate": 0, "amount": 7400
      }]
    }]
  }'
```

Svar per faktura: `created`, `updated` eller `review` (hamnade i granskningskön,
t.ex. vid okänd kund). Samma externa faktura kan skickas hur många gånger som
helst utan att dubbleras.

### Pusha betalningar

```bash
curl -X POST "https://host/api/v1/payments/sync" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{
    "payments": [{
      "external_system": "fortnox",
      "external_id": "PAY-5001",
      "external_invoice_id": "INV-9001",
      "amount": 7400,
      "paid_at": "2026-07-28",
      "method": "bankgiro"
    }]
  }'
```

Idempotent per `external_id`. Fakturans status uppdateras automatiskt till
`partially_paid`/`paid` enligt statusmaskinen.

### Prenumerera på utgående webhooks

```bash
curl -X POST "https://host/api/v1/webhook-subscriptions" \
  -H "Authorization: Bearer $API_KEY" \
  -H "Content-Type: application/json" \
  -d '{"url": "https://example.com/hooks", "events": ["contract.signed", "invoice.updated"]}'
```

Svaret innehåller `secret` (visas endast en gång) för signaturverifiering –
se [WEBHOOKS.md](WEBHOOKS.md).
