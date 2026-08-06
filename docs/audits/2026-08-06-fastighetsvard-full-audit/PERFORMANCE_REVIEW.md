# Prestandagranskning

> **Metodbegränsning.** Live-databasen är i praktiken tom (`MaintenanceRequest`
> 0, `Contract` 0, `Document` 0, `Invoice` 0, `storage.objects` 0, största tabell
> `RolePermission` med 120 rader). `EXPLAIN ANALYZE` ger därför inga meningsfulla
> planer och kördes inte. Samtliga fynd nedan är **strukturella**, inte mätta.
> De markeras `TEORETISK` respektive `VERIFIERAD STRUKTUR`.

## 1. Klientprestanda

Produktionsbygget kördes och gav:

```text
First Load JS shared by all             102 kB
  ├ chunks/1255-*.js                    46.2 kB
  ├ chunks/4bd1b696-*.js                54.2 kB
  └ other shared chunks (total)         1.93 kB

Största sidspecifika bundle:  /mina-sidor/avtal/[id]   2.27 kB (108 kB total)
Minsta:                       /mina-sidor/dokument     227 B  (103 kB total)
```

| Aspekt | Bedömning |
| --- | --- |
| Delad bundle 102 kB | **Bra.** Nära Next.js baseline för React 19; inga tunga UI-bibliotek |
| Beroenden | **Bra.** 6 produktionsberoenden: `@supabase/ssr`, `@supabase/supabase-js`, `next`, `react`, `react-dom`, `zod` |
| Duplicerade dependencies | Inga hittade |
| Onödiga client components | **Få.** `"use client"` används endast för formulär och interaktiva knappar (`MaintenanceForm`, `ActivateForm`, `ListingSearch`, `FavoriteButton`, `SaveSearchButton`, `DeleteSavedSearchButton`, `AdminNav`, `PortalNav`, `ImportWizard`, `OfferResponseForm`, `ActionForm`, `RecoverySessionGate`) |
| Dynamiska imports | Används inte — motiverat vid dessa bundlestorlekar |
| Rendering av hela listor | ⚠ ingen virtualisering; se pagination nedan |
| Onödiga re-renders | Låg risk — `useActionState` är den enda tillståndsmekanismen |
| Bilder | ✔ `next.config.ts` konfigurerar bildoptimering; annonsmedia begränsas till 20 MB och avif/webp tillåts |
| Polling | Ingen |
| Waterfall-anrop | Se serverprestanda |

**Sammanfattning:** klientlagret är lätt och välavvägt. Ingen åtgärd föreslås.

## 2. Serverprestanda

### Parallellisering är korrekt gjord

```ts
// src/lib/repositories/portal-records.ts:288-305
const [commentsResult, historyResult, documentResult, unit] = await Promise.all([
  supabase.from("MaintenanceComment")...,
  supabase.from("MaintenanceStatusEvent")...,
  supabase.from("Document")...,
  ...
]);
```

```ts
// src/lib/repositories/admin-records.ts:155-167
const [requestResult, supplierResult, documentResult] = await Promise.all([...]);
```

### N+1 undviks genomgående

Relationer hämtas med `.in(ids)`-batchning följt av `Map`-uppslag:

```ts
// admin-records.ts:171-186
const unitIds = [...new Set(requests.map((row) => row.unitId).filter(Boolean))];
const { data: unitData } = unitIds.length
  ? await admin.from("Unit").select("id,address,city").in("id", unitIds) : ...;
const unitMap = new Map(unitData.map((row) => [String(row.id), row]));
```

Detta är korrekt mönster och används konsekvent i `groupBy`/`Map`-hjälparna.

### Aggregat i databasen, inte i Node

`admin_dashboard_metrics(p_organization_id, p_now)` och
`admin_report_metrics(...)` är `SECURITY DEFINER`-RPC:er som räknar i SQL.
`verify:login-dashboard` bekräftar att en fallback finns om RPC:n fallerar
(`PASS Admin-dashboard har query-fallback`). Bra design.

### Kända kostnader

| Observation | Klass | Kommentar |
| --- | --- | --- |
| `current_user_context()` per request | VERIFIERAD STRUKTUR | En RPC-rundtur per sidladdning. `cache()` dedupliserar inom request, men alla sidor är `force-dynamic` → ingen cachning mellan requests |
| `force-dynamic` överallt | VERIFIERAD STRUKTUR | Medvetet val för korrekthet (ingen stale roll/status). Kostnad: ingen sida kan serveras statiskt |
| **Ingen pagination** | VERIFIERAD STRUKTUR | Admin-listor hämtar hela resultatmängder. `.limit(2000)` på dokument (`admin-records.ts:166`) är enda bromsen |
| Externa API-anrop i request-path | VERIFIERAD STRUKTUR | Resend-anrop sker post-commit men **inom** samma request (`maintenance.ts:109`). 10 s timeout (`email.ts:88`). Vid långsam leverantör fördröjs redirecten |
| Webhook-leverans i request-path | VERIFIERAD STRUKTUR | `dispatchEvent()` skapar bara `WebhookDelivery`-rader; själva HTTP-anropet görs av cron. Korrekt |
| Ingen `revalidatePath`/`revalidateTag` | VERIFIERAD STRUKTUR | Inte nödvändigt givet `force-dynamic` |
| Loggning | VERIFIERAD STRUKTUR | `console.*`, ingen strukturerad logger; låg overhead men svag diagnostik |
| Edge vs Node runtime | Ej specificerat | Alla routes kör Node-runtime (default) |

### E-post i request-path

```ts
// maintenance.ts:109-122
await runPostCommitEffects([
  { label: "created webhook", task: dispatchEvent(...) },
  { label: "created email",   task: notifyCreated(...) },
]);
```

`await` gör att användaren väntar på båda. `notifyCreated` skickar upp till två
Resend-anrop med 10 s timeout vardera (`Promise.allSettled` internt, så de går
parallellt). Värsta fall: ~10 s extra innan redirecten.

Detta är **exakt vad outboxen var tänkt att lösa** (`FASTIGHET-005`): lägg
leveransintentionen i kön, returnera direkt, låt en worker leverera. Att
outboxen saknar konsument är alltså både ett funktionellt och ett
prestandaproblem.

## 3. Databasprestanda

### Främmande nycklar utan index

40 FK saknar index på sin första kolumn (`FASTIGHET-014`). Kopplat till kod:

| Constraint | Belastas av |
| --- | --- |
| `ContractParty_personId_fkey` | RLS-policyerna på `Contract`, `ContractVersion`, `MoveInCase`, `MoveOutCase`, `Termination`, `SigningSession`, `EvidenceReport` — samtliga gör `EXISTS ... WHERE cp."personId" = current_app_person_id()` |
| `ApplicationMember_personId_fkey` | RLS på `Application`, `ApplicationSnapshot`, `ApplicationStatusEvent`, `Document` |
| `MaintenanceRequest_unitId_fkey` | `workOrderRelations()`, portalens ärendelista |
| `Document_maintenanceRequestId_fkey` | `portal-records.ts:301`, bilagelistning |
| `InvoiceLine_invoiceId_fkey` | fakturadetaljvyn |
| `Listing_unitId_fkey` | publika katalogvyer |

Sju RLS-policies gör `EXISTS`-subselect mot `ContractParty` respektive
`ApplicationMember`. Utan index på `(contractId, personId)` och
`(applicationId, personId)` blir dessa seq scan **per rad** i den yttre
frågan — den enskilt största skalbarhetsrisken i databasen.

Klass: **TEORETISK** (0 rader live), men konsekvensen vid produktionsvolym är
förutsägbar och allvarlig.

### `app_has_permission()` i varje policy

```sql
SELECT EXISTS (
  SELECT 1 FROM public."User" u
  JOIN public."UserRole" ur ON ur."roleId" = ...
  JOIN public."RolePermission" rp ON rp."roleId" = ur."roleId"
  WHERE u."authUserId" = auth.uid() AND u."isActive" = true AND (...)
)
```

Funktionen är `STABLE`, så planeraren kan utvärdera den en gång per sats i
stället för per rad. Den joinar dock tre tabeller. Rekommenderade index:
`User(authUserId) WHERE isActive`, `UserRole(userId)`, `RolePermission(roleId, permission)`.

### Övrigt

| Observation | Klass |
| --- | --- |
| Inga materialiserade vyer | TEORETISK — publika katalogvyer beräknas per anrop |
| Inga wildcard-projektioner | VERIFIERAD — alla `.select()` listar kolumner explicit |
| `FOR UPDATE SKIP LOCKED` i `claim_outbox_jobs` | VERIFIERAD — korrekt köhämtning |
| `FOR UPDATE` i muterande RPC:er | VERIFIERAD — låser en rad i taget, kort transaktion |
| Låsrisk | Låg — inga långa transaktioner; externa anrop görs utanför DB-transaktionen |
| Count-frågor på stora tabeller | Undviks — metrics går via aggregat-RPC |
| Realtime-subscriptions | Används inte |
| `btree_gist` i `public` | ~120 extra funktioner; ingen mätbar körtidskostnad |
| Connection usage | Supabase-pooler; inga långlivade anslutningar i koden |

## Prioriterade åtgärder

| # | Åtgärd | Effekt | Klass |
| --- | --- | --- | --- |
| 1 | Index på `ContractParty(contractId, personId)` och `ApplicationMember(applicationId, personId)` | Eliminerar seq scan i 11 RLS-policies | TEORETISK, hög säkerhet |
| 2 | Index på samtliga 40 FK-förstakolumner | Snabbare joins + billigare CASCADE-verifiering | TEORETISK |
| 3 | Index för `app_has_permission`-joinen | Varje RLS-utvärdering | TEORETISK |
| 4 | Pagination i admin-listor | Begränsar payload och rendering | VERIFIERAD STRUKTUR |
| 5 | Bygg outbox-konsument, flytta e-post ur request-path | −10 s värsta fall på felanmälan | VERIFIERAD STRUKTUR |
| 6 | `loading.tsx` för upplevd prestanda | UX | VERIFIERAD STRUKTUR |

**Ingen av dessa är brådskande i nuvarande datavolym.** Åtgärd 1 och 2 bör dock
göras innan produktionsdata läggs in, eftersom `CREATE INDEX CONCURRENTLY` är
billigare på en tom tabell och eftersom RLS-kostnaden annars upptäcks först i
drift.

## Rekommenderad mätmetod före åtgärd

Kör i staging med representativ datamängd (≥10 000 `MaintenanceRequest`,
≥1 000 `Contract`):

```sql
EXPLAIN (ANALYZE, BUFFERS)
SELECT * FROM "Contract" WHERE ...;   -- som hyresgästroll, med RLS aktiv
```

Utan sådan mätning är index­tillägg välgrundade gissningar, inte verifierade
förbättringar. Denna audit gör inga anspråk på det senare.
