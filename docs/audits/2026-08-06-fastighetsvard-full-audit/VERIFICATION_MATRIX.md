# Verifierings- och konsekvensmatris

## Del 1 – Synkmatris per flöde

Legend: ✔ konsekvent · ⚠ avvikelse · ✘ brist · – ej tillämpligt

| Flöde | DB-schema | RLS | Server/API | TypeScript | UI | E-post/notis | Cache | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Användarskapande (självreg.) | ✔ | ✔ | ✔ | ✔ | ✔ | ✔ Auth-SMTP | ✔ | OK |
| Organisationsmedlemskap | ✔ | ⚠ `UserRole` utan policy | ✔ | ✔ | ✔ | – | ✔ | OK |
| Rolltilldelning | ✔ | ⚠ `Role`/`RolePermission` utan policy | ✔ | ✔ | ✔ | – | ✔ | OK |
| Inbjudan | ✔ | ⚠ `Invitation` utan policy | ✔ | ✔ | ✔ | ⚠ ingen återkallning vid fel | ✔ | P2 |
| Fastighetsskapande | ✔ | ✔ | ✔ | ✔ | ✔ | – | ✔ | OK |
| Byggnadsskapande | ⚠ hoppas över i praktiken | ✔ | ✔ | ✔ | ✔ | – | ✔ | P2 |
| Objektskapande | ⚠ `buildingId` nullbar | ✔ | ✔ | ✔ | ✔ | – | ✔ | P2 |
| Hyresgästkoppling | ✔ | ✔ `ContractParty` | ✔ | ✔ | ✔ | ✔ | ✔ | OK |
| Ansökan | ✔ | ✔ | ✔ idempotent | ✔ | ✔ | ⚠ outbox död | ✔ | P1 |
| Erbjudande → avtal | ✔ | ✔ | ✔ idempotent + lås | ✔ | ✔ | ⚠ outbox död | ✔ | P1 |
| **Felanmälan** | ✔ | ✔ | ⚠ ej idempotent | ✔ | ✔ | ✔ direkt e-post | ✔ | P2 |
| Statushantering | ✔ | ✔ | ✔ optimistisk låsning | ✔ | ✔ | ✔ | ✔ | OK |
| **Kommentar** | ✔ `isInternal` | ✘ **filtreras inte** | ✔ | ✔ | ✔ | – | ✔ | **P1** |
| Bilaga | ✔ | ✔ | ✔ kompensation åt båda håll | ✔ | ✔ | – | ✔ | OK |
| Dokument | ✔ | ✔ 5 vägar | ✔ | ✔ | ✔ | – | ✔ | OK |
| **Notifiering (outbox)** | ✔ | ✔ | ✘ **ingen konsument** | – | – | ✘ | – | **P1** |
| Notifiering (webhook) | ✔ | ⚠ utan policy | ✔ HMAC + backoff | ✔ | ✔ | ✔ | ✔ | OK |
| **Revisionslogg** | ✔ | ⚠ **skrivning öppen** | ✔ läsning | ✔ | ✔ | – | ✔ | **P0** |
| Borttagning | ✔ RESTRICT/SET NULL | ✔ | ✔ | ✔ | ✔ | – | ✔ | OK |
| Organisationsbyte | – | – | – | – | – | – | – | Ej implementerat |
| Rollbyte | ✔ | ⚠ utan policy | ✔ | ✔ | ✔ | – | ✔ genomslag direkt | OK |

### De tio kontrollfrågorna per flöde

| Fråga | Svar |
| --- | --- |
| 1. Är modellen konsekvent? | **Ja.** Enums, typer och tillståndsmaskiner är synkade och verifieras av 27 automatiska kontroller. |
| 2. Är organisationsägarskapet konsekvent? | **Ja i skrivvägar, nästan i läsvägar.** Två undantag: `FASTIGHET-012` (oanvänd parameter) och `FASTIGHET-013` (policy utan org-predikat). |
| 3. Är rollerna konsekventa? | **Ja i tillämpningen** (`requirePermission` överallt). **Nej i klassificeringen** (`FASTIGHET-007`). |
| 4. Matchar UI och databas? | **Ja**, med två undantag där UI är strängare än databasen (`FASTIGHET-001`, `FASTIGHET-022`). |
| 5. Matchar kod och migrationshistorik? | **Ja** — repot är internt konsekvent (lint över 36 migrationer passerar). |
| 6. Matchar live-databas och repository? | **Nej.** Tre bekräftade avvikelser: grants, `property-media`, migrationsliggare. |
| 7. Finns dubbla implementationer? | **Ja, en skadlig:** outbox vs `WebhookDelivery` (`FASTIGHET-005`). Övriga dubbleringar (permissions, statusmaskiner) är avsiktliga och testade. |
| 8. Finns race conditions? | **Nej i uthyrnings-/avtalsflödena** (`FOR UPDATE` + optimistisk låsning + idempotens). **Ja i felanmälan** (ingen idempotensnyckel). |
| 9. Finns idempotens? | **Ja** för ansökan, erbjudande, uppsägning, transfer, webhook-mottagning. **Nej** för felanmälan och e-post. |
| 10. Finns regressionstester? | **Delvis.** 50 enhetstester + 53 statiska kontroller. Inga RLS-, Storage- eller E2E-tester har kunnat köras. |

---

## Del 2 – Obligatoriska logiska testfall

| # | Scenario | Bedömning | Grund |
| --- | --- | --- | --- |
| 1 | Hyresgäst i org A läser org B:s felanmälan | **Verifierat säkert (strukturellt)** | RLS `maintenance_owner_or_staff_read` kräver `personId = current_app_person_id()` eller org + permission. Endast 1 org live → ej empiriskt testat |
| 2 | Förvaltare i org A uppdaterar org B:s fastighet | **Verifierat säkert (strukturellt)** | Alla muterande RPC:er jämför `current_app_organization_id()` mot radens `organizationId` och kastar `organization_mismatch` (42501) |
| 3 | Handläggare tilldelar ärende till användare i annan org | **Delvis verifierat** | `create_work_order` är service-role-låst och anropas efter `requirePermission`. Org-kontroll av `p_assignee_user_id` finns i RPC-kroppen men är ej runtime-testad |
| 4 | Hyresgäst manipulerar `apartment_id` (`unitId`) | **Verifierat säkert** | `actions.ts:62-69` – `getMyRentalUnit()` returnerar `null` för objekt hyresgästen inte hyr → felmeddelande, inget ärende skapas |
| 5 | Hyresgäst manipulerar `property_id` | **Verifierat säkert** | `propertyId` accepteras aldrig från klienten; härleds ur den verifierade objektsraden (`actions.ts:71`) |
| 6 | Användare manipulerar sin roll i klienten | **Verifierat säkert** | Roller finns varken i JWT eller i något formulärfält; läses per request ur `UserRole` via `current_user_context()` |
| 7 | Inbjudan används två gånger | **Verifierat säkert** | `acceptedAt` kontrolleras i preview och i `claim_invitation` inom samma transaktion |
| 8 | Två parallella accepteringar av samma inbjudan | **Verifierat säkert (strukturellt)** | `claim_invitation` är en atomisk `SECURITY DEFINER`-transaktion; ej runtime-testat |
| 9 | Samma felanmälan skickas två gånger | **Verifierat sårbart** | Ingen idempotensnyckel i `create_maintenance_request`. UI-knappen inaktiveras (`MaintenanceForm.tsx:130`), men en retry på nätverksnivå skapar två ärenden |
| 10 | E-postleverantören misslyckas efter att DB sparat | **Verifierat säkert** | `runPostCommitEffects` med `Promise.allSettled` (`maintenance.ts:88-97`); ärendet är committat, felet loggas, användaren får kvitto och uppmanas inte skicka om |
| 11 | Storage-upload lyckas men DB-insert misslyckas | **Verifierat säkert** | `maintenance-files.ts:97-101` – `.remove([storageKey])` städar filen |
| 12 | DB-insert lyckas men storage misslyckas | **Verifierat säkert** | `:76-79` – filen räknas som `failed`, ingen `Document`-rad skapas; status `partial`/`failed` visas |
| 13 | Användare tas bort men har gammal aktiv session | **Verifierat säkert** | `current_app_user_id/person_id/organization_id` och `app_has_permission` kräver alla `User.isActive = true`; utan rad returneras `NULL` och ingen policy matchar |
| 14 | Hyresgäst flyttar och läser gamla lägenhetsärenden | **Verifierat säkert (avsiktligt)** | RLS binder till `personId`, inte `unitId`. Hyresgästen behåller åtkomst till **sina egna** historiska ärenden; ny hyresgäst ser dem inte. Bör dokumenteras som medvetet GDPR-val |
| 15 | Soft-deletade poster visas i dashboard | **Ej tillämpligt** | Systemet använder hard delete med RESTRICT/SET NULL. Enda soft delete är `Document.archivedAt`, som filtreras (`admin-records.ts:166`) |
| 16 | Cache visar data efter roll-/medlemskapsändring | **Verifierat säkert** | Alla portalslayouter är `force-dynamic`; roller cachas inte i JWT; `cache()` är per request |
| 17 | Superadmin byter organisationskontext | **Ej tillämpligt** | En organisation; ingen kontextväxling implementerad. Superadmin har wildcard `*` inom sin egen organisation |
| 18 | Read-only-roll försöker skapa/ändra/radera | **Delvis verifierat** | `report-viewer` saknar `:create/:update/:delete` i `RolePermission` (120 rader live, verifierat av `verify:consistency`). Server actions kastar `AuthError("forbidden")`. Ej runtime-testat |

### Sammanställning

| Utfall | Antal |
| --- | --- |
| Verifierat säkert | 11 |
| Verifierat sårbart | **1** (#9) |
| Delvis verifierat | 3 (#3, #8, #18) |
| Ej tillämpligt | 3 (#15, #17) + #14 avsiktligt |
| Blockerat | 0 |
| Saknar testtäckning | #1–#3, #8, #18 saknar körbara negativa tester |

---

## Del 3 – Exekverade kontroller

| Kommando | Resultat | Antal | Anmärkning |
| --- | --- | --- | --- |
| `npm ci` | **PASS** | — | Exit 0. Motbevisar `.agent-memory`-påståendet om blockerad registry (`FASTIGHET-019`) |
| `npm run lint` | **PASS** | 36 migrationer inspekterade | `scripts/lint.mjs` |
| `npm run verify:accounts` | **PASS** | 16 kontroller | — |
| `npm run verify:login-dashboard` | **PASS** | 10 kontroller | — |
| `npm run verify:consistency` | **PASS** | 27 kontroller | Roll-, media- och felanmälningskonsekvens |
| `npm run typecheck` | **PASS** | — | `tsc --noEmit`, rent |
| `npm run test:unit` | **PASS** | 7 filer, **50 tester** | 1,97 s |
| `npm run build` | **PASS** | — | Next.js 15.5.20; delad JS 102 kB |
| `npm run test:rls` | **BLOCKERAD** | — | Kräver `psql` + PostgreSQL; ingen lokal instans |
| `npm run db:verify` | **BLOCKERAD** | — | Samma |
| `npm run test:concurrency` | **BLOCKERAD** | — | Kräver databasanslutning |
| `npm run test:e2e` | **BLOCKERAD** | — | Kräver körande app + miljövariabler |
| `supabase db lint` | **EJ KÖRD** | — | Skulle kräva länkat projekt / lokal stack |
| Live-introspektion (MCP, read-only) | **GENOMFÖRD** | ~10 frågor | `pg_policies`, `pg_proc`, `pg_class`, `pg_constraint`, `storage.buckets`, advisors |
| Supabase security advisors | **GENOMFÖRD** | 119 träffar | 4 ERROR, 86 WARN, 28 INFO, 1 auth-WARN |

**Testfiler:** `branding`, `crypto`, `permissions`, `production-hardening`,
`role-routing`, `state-machines`, `supabase-schema`.

Inget fel föregick auditbranchen — allt var grönt vid startcommit `d9c7cfe`, och
inga produktionsfiler ändrades under auditen. Samtliga resultat är reproducerbara
med `npm ci && npm run ci`.

### Vad som inte kunnat verifieras

| Område | Krav för verifiering |
| --- | --- |
| Negativa RLS-tester (cross-person, cross-org) | PostgreSQL-instans med applicerad migrationskedja |
| Storage-policyer i praktiken | Samma + testanvändare |
| Verklig concurrency | Samma + parallella anslutningar |
| E-postleverans, avsändaridentitet, bounce | Resend-konto och verifierad domän |
| Browser-E2E, tangentbord, skärmläsare | Körande app + Playwright |
| Vercel-konfiguration, cron-exekvering | Projektåtkomst |
| Supabase Auth-inställningar (rate limits, SMTP, Site URL) | Projektinställningar |
