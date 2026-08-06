# Systeminventering

## Teknisk plattform

| Post | Värde | Källa |
| --- | --- | --- |
| Produkt | FaddeBo | `.agent-memory/project-identity.md` |
| Juridisk organisation | Östgöta El Teknik AB | `.agent-memory/project-identity.md` |
| Modell | **En-organisations** fastighets-/uthyrningsplattform | `organization-and-rls.md` |
| Framework | Next.js 15.5.20 (App Router), React 19 | `package.json` |
| Språk | TypeScript strict | `tsconfig.json` |
| Databas | Supabase PostgreSQL 17.6.1.147, eu-west-1 | live |
| Runtime | Node 22.16.0, npm 10.9.2 | `package.json`, `.nvmrc` |
| Hosting | Vercel | `vercel.json` |
| Validering | Zod 3 | `package.json` |
| Test | Vitest 3 | `vitest.config.ts` |
| Beroenden (prod) | 6 st — inga tunga UI-bibliotek | `package.json` |

> **Terminologisk varning.** I denna domän betyder "tenant" *hyresgäst*
> (`Person` med `PersonRole = TENANT`), **inte** SaaS-mandant. Isolerings-
> gränsen heter `organizationId`. Auditens frågor om "tenantisolering" har
> tolkats som **organisationsisolering**, och separat som
> **hyresgästdataisolering**.

## Systemkarta

```text
Användare (sökande / hyresgäst / personal / entreprenör / API-klient)
   │
   ├── Publik webb            src/app/(public)/         22 sidor, anon
   ├── Portal                 src/app/(portal)/mina-sidor/   17 sidor
   ├── Administration         src/app/admin/            18 sidor
   ├── Entreprenörsportal     src/app/entreprenor/       1 sida
   └── Externt API            src/app/api/v1/           17 routes (API-nyckel)
   │
   ▼
middleware.ts → src/lib/supabase/middleware.ts   (endast sessionsförnyelse)
   │
   ▼
Layout-grind (server component)
   admin/layout.tsx      isStaffAccount()
   portal/layout.tsx     defaultDashboardForRoles()
   entreprenor/layout.tsx isContractorAccount() + supplierId
   │
   ▼
Sidgrind: getCurrentUser() + hasPermission(resource, action)
Server action: requirePermission(resource, action)
API-route:    authenticateApiRequest(req, scope) + checkRateLimit()
   │
   ▼
src/lib/services/*        (7 domäntjänster)
   │
   ├── src/lib/repositories/*   (21 repositories)
   │      ├── createServerSupabaseClient()  → användarens JWT → RLS gäller
   │      └── createAdminClient()           → service-role → RLS kringgås,
   │                                          explicit organizationId krävs
   ▼
PostgreSQL
   ├── RLS-policies (51 st över 33 tabeller)
   ├── SECURITY DEFINER-RPC:er (~60 applikationsfunktioner)
   ├── Constraints, triggers (immutability, updated_at, RLS-auto-enable)
   └── Storage (10 buckets, path-bundna policies)
   │
   ▼
Sidoeffekter
   ├── E-post          Resend API (src/lib/email.ts)
   ├── Utgående webhook WebhookDelivery + HMAC (src/lib/services/webhooks.ts)
   ├── Outbox          OutboxEvent  ── INGEN KONSUMENT (FASTIGHET-005)
   └── Audit           AuditEvent (append-only)
```

## Appar och kataloger

| Sökväg | Ansvar | Antal filer |
| --- | --- | --- |
| `src/app/(public)/` | Publik webb, auth-flöden, ansökan | 30 |
| `src/app/(portal)/mina-sidor/` | Sökande- och hyresgästportal | 22 |
| `src/app/admin/` | Administration | 24 |
| `src/app/entreprenor/` | Entreprenörsportal | 4 |
| `src/app/api/` | API v1, auth-hjälpare, webhooks, interna | 24 |
| `src/lib/repositories/` | Databasåtkomst per domän | 21 |
| `src/lib/services/` | Domäntjänster | 7 |
| `src/lib/` (övrigt) | auth, permissions, crypto, email, branding m.m. | 15 |
| `src/components/` | Delade UI-komponenter | 9 |
| `supabase/migrations/` | Kanonisk schemakedja | 36 |
| `supabase/manual/` | Manuella reparations-/preflight-skript | 10 |
| `supabase/tests/` | Schema- och RLS-verifiering | 2 |
| `tests/` | Vitest-enhetstester | 7 |
| `scripts/` | Lint och statiska verifierare | 7 |

## API-routes

### Externt API (`/api/v1`) — autentisering via API-nyckel

`applications`, `buildings`, `contracts`, `customers`, `customers/[id]`,
`invoices`, `invoices/[id]`, `invoices/sync`, `listings`,
`maintenance-requests`, `openapi`, `payments`, `payments/sync`, `properties`,
`tenants`, `units`, `webhook-subscriptions`, `webhook-subscriptions/[id]`

Gemensam grind: `authenticateApiRequest(req, scope)` i `src/lib/api/auth.ts`,
som kontrollerar nyckelhash (SHA-256), `isActive`, `revokedAt`, `expiresAt`,
IP-allowlist och scope. Därefter `checkRateLimit()` → RPC `consume_rate_limit`
(300 anrop/60 s per nyckel, service-role-låst).

### Auth-hjälpare (`/api/auth`)

`favorites`, `gdpr-export`, `logout`, `saved-searches`

### Webhooks

| Route | Riktning | Skydd |
| --- | --- | --- |
| `/api/webhooks/accounting/[provider]` | Inkommande | HMAC `X-Webhook-Signature` (`t=<unix>,v1=<hmac>`), 5 min replay-fönster, idempotens per (org, provider, eventId) |
| `/api/internal/webhooks/process` | Intern cron | `Bearer ${CRON_SECRET}` **eller** `webhooks:update`-permission |

### Cron

`vercel.json` → `/api/internal/webhooks/process` var femte minut
(`*/5 * * * *`). Det är systemets **enda** schemalagda jobb.

## Databasfunktioner (urval)

| Kategori | Funktioner |
| --- | --- |
| Kontext | `current_app_user_id`, `current_app_person_id`, `current_app_organization_id`, `current_user_context`, `app_has_permission` |
| Uthyrning | `submit_rental_application`, `withdraw_rental_application`, `send_rental_offer`, `accept_rental_offer`, `decline_rental_offer` |
| Avtal | `create_contract_version`, `create_signing_session`, `record_contract_signature`, `countersign_contract`, `activate_signed_contract`, `change_contract_status` |
| Uppsägning/flytt | `request_contract_termination`, `confirm_contract_termination`, `cancel_contract_termination`, `complete_internal_transfer`, `complete_move_in`, `complete_move_out` |
| Felanmälan | `create_maintenance_request`, `change_maintenance_status`, `create_work_order`, `change_work_order_status` |
| Provisionering | `provision_staff_user`, `provision_supplier`, `provision_verified_self_signup`, `register_existing_tenant`, `bootstrap_faddebo_owner`, `create_custom_role`, `claim_invitation` |
| Integration | `upsert_external_customer`, `persist_external_invoice`, `apply_external_payment`, `queue_sync_review` |
| Infrastruktur | `claim_idempotent_operation`, `complete_idempotent_operation`, `fail_idempotent_operation`, `enqueue_outbox_event`, `claim_outbox_jobs`, `consume_rate_limit`, `write_audit_event` |
| Triggers | `set_updated_at`, `reject_audit_mutation`, `reject_immutable_row_mutation`, `reject_locked_contract_version_mutation`, `assign_primary_brand`, `sync_main_applicant_person_id`, `rls_auto_enable` (event trigger) |

**Edge Functions: inga.** `supabase/functions/` existerar inte;
`mcp__Supabase__list_edge_functions` bekräftar tom lista.

## Miljövariabler

Från `.env.example` (värden ej återgivna):

| Variabel | Användning |
| --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | klient + server |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` / `..._ANON_KEY` | publik nyckel, fallback-kedja |
| `SUPABASE_SECRET_KEY` / `SUPABASE_SERVICE_ROLE_KEY` | **server-only**, `src/lib/supabase/admin.ts` |
| `RESEND_API_KEY` | e-post; obligatorisk i produktion |
| `EMAIL_FROM` | avsändare; tvingas till `info@faddebo.se` |
| `CRON_SECRET` | cron-autentisering |
| `NEXT_PUBLIC_APP_URL` | länkar i e-post |

Service-role-nyckeln nås enbart via `getSupabaseSecretKey()` i
`src/lib/supabase/env.ts`, som importeras av `src/lib/supabase/admin.ts` — och
den filen har `import "server-only"` (rad 1). **Ingen läcka till klientbundlen.**
`scripts/lint.mjs` upprätthåller detta statiskt.

## Observability

| Aspekt | Status |
| --- | --- |
| Strukturerad loggning | Nej — `console.error`/`console.info` med prefixet `FaddeBo` |
| Metrics | Nej |
| Tracing | Nej |
| Felrapportering (Sentry e.d.) | Nej |
| Audit | Ja — `AuditEvent`, append-only |
| Kölängdsövervakning | **Nej** — bidrar till att `FASTIGHET-005` är osynlig |

## Cachning och revalidation

Portalerna använder `export const dynamic = "force-dynamic"` genomgående
(`admin/layout.tsx:10`, `mina-sidor/layout.tsx:38`, `entreprenor/layout.tsx:8`,
`aktivera/[token]/page.tsx:7`). Det eliminerar risken för stale data efter
roll- eller medlemskapsändring, till priset av att ingen sida cachas.
Ingen `revalidatePath`/`revalidateTag` används.

## Duplicerad affärslogik (identifierade ställen)

| Regel | Implementation 1 | Implementation 2 |
| --- | --- | --- |
| Asynkron leverans | `OutboxEvent` via `enqueue_outbox_event` (död) | `WebhookDelivery` via `dispatchEvent()` (levande) |
| Behörighetskontroll | `app_has_permission()` i SQL (RLS + RPC) | `hasPermission()` i TypeScript (`src/lib/permissions.ts`) |
| Organisationsbindning | RLS-predikat `= current_app_organization_id()` | `.eq("organizationId", ...)` i service-role-frågor |
| Statusövergångar | `CASE`-tabeller i RPC:er | `src/lib/state-machines.ts` |

Dubbleringen av behörighet och statusmaskiner är **medveten och testad**
(`tests/permissions.test.ts`, `tests/state-machines.test.ts`,
`npm run verify:consistency` = 27 kontroller som jämför TypeScript mot SQL).
Dubbleringen av leveransmekanism är det **inte** — se `FASTIGHET-005`.
