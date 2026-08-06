# Databas- och migrationsgranskning

## Live-verifieringens status

**Genomförd.** Read-only-introspektion mot Supabase-projektet `Fastighetsvard`
(ref `dmigdfbvudzexvdnbvrj`, eu-west-1, PostgreSQL 17.6.1.147) 2026-08-06.
Endast `SELECT` mot `pg_catalog` och domäntabeller utfördes. Inga skrivningar,
inga `EXPLAIN ANALYZE` på muterande frågor.

## Migrationskällan i repot

36 forward-migrationer i `supabase/migrations/`, i fyra generationer:

| Prefix | Antal | Innehåll |
| --- | --- | --- |
| `20260720*` | 11 | Grundschema: enums, tabeller, index, FK, auth-funktioner, RLS, storage |
| `20260724*` | 4 | Kärnhärdning (1832 rader), OTP-signering, auth/RLS/storage, rate limiting |
| `20260725*` | 14 | Brand, kanoniska kommandon, publik katalog, provisionering, metrics |
| `20260803–04*` | 7 | FaddeBo-konton/roller, ägarreparation, kontolivscykel, SMTP-härdning, login/dashboard, rollkontext |

`scripts/lint.mjs` validerar kedjan statiskt och rapporterar
`Static hardening checks passed (36 canonical migrations)`.

Utöver dessa finns `supabase/manual/` med 10 skript, bl.a.
`000_RESET_PARTIAL_FASTIGHETSPLATTFORM.sql`,
`00_REPAIR_FADDEBO_AUTH_SCHEMA.sql` (872 rader) och
`03_APPLY_FADDEBO_AUTH_SMTP_LOGIN_HARDENING.sql` (445 rader — nästan identisk med
migration `20260804101500`).

## Migrationsliggaren

```text
mcp__Supabase__list_migrations → {"migrations":[]}
```

**Live-databasen har noll registrerade migrationer** medan schemat är fullt
deployat (79 tabeller). Slutsats: schemat applicerades via `supabase/manual/`
eller SQL-editorn, inte via `supabase db push`.

Detta är `FASTIGHET-003` och är förutsättningen för att övrig drift ska kunna
uppstå obemärkt.

## Konstaterad schema drift

| # | Objekt | Repo | Live | Bedömning |
| --- | --- | --- | --- | --- |
| 1 | Funktions-ACL för ~40 RPC:er | `REVOKE ... FROM PUBLIC` avsett | `anon=X` kvar | `FASTIGHET-004` — repo-defekt **och** drift |
| 2 | Storage-bucket `property-media` | saknas | finns, `public=true` | `FASTIGHET-006` |
| 3 | Migrationsliggare | 36 versioner | 0 | `FASTIGHET-003` |

Ingen kolumn-, typ- eller nullability-drift upptäcktes vid stickprov mot
kärntabellerna. Enum-typerna matchar `src/lib/database-types.ts`
(verifierat av `tests/supabase-schema.test.ts` och
`npm run verify:consistency`, 27 kontroller).

### Migrationsfiler redigerade efter applicering

Kan **inte avgöras** — utan liggare finns ingen checksum att jämföra mot.
Markeras `NOT VERIFIED`.

### Duplicerad SQL mellan `manual/` och `migrations/`

`supabase/manual/03_APPLY_FADDEBO_AUTH_SMTP_LOGIN_HARDENING.sql` (445 rader) och
`supabase/migrations/20260804101500_faddebo_auth_smtp_login_hardening.sql`
(445 rader) är parallella källor för samma ändring. Om den ena redigeras
divergerar miljöerna tyst. Rekommendation: `manual/` bör endast innehålla
engångsreparationer, aldrig kopior av migrationer.

## Tabeller och RLS

| Mätpunkt | Värde |
| --- | --- |
| Tabeller i `public` | 79 |
| RLS aktiverat | 79 (100 %) |
| `FORCE ROW LEVEL SECURITY` | 0 |
| Utan policies | 28 |
| Vyer | 5 (4 exponerade för `anon`) |
| Materialiserade vyer | 0 |

RLS-täckningen upprätthålls av event-triggern `rls_auto_enable()`, som kör
`ALTER TABLE ... ENABLE ROW LEVEL SECURITY` vid varje `CREATE TABLE` i `public`.
Det är en stark garanti mot att en framtida tabell glöms bort.

Detaljer i [`RLS_AND_RBAC_REVIEW.md`](RLS_AND_RBAC_REVIEW.md).

## Främmande nycklar och delete-semantik

Delete-semantiken är genomtänkt och följer tre linjer:

| Mönster | Används för | Exempel |
| --- | --- | --- |
| `ON DELETE CASCADE` | äkta kompositionsbarn | `Building→Property`, `InvoiceLine→Invoice`, `Listing→Unit`, `Entrance→Building`, `Floor→Entrance` |
| `ON DELETE SET NULL` | valfria referenser och historik | `AuditEvent.userId`, `Document.*Id`, `MaintenanceRequest.unitId/propertyId`, `Message.senderPersonId` |
| `ON DELETE RESTRICT` | juridiskt bevismaterial | `ContractSignature.*`, `EvidenceReport.*`, `MoveInCase.organizationId` |

**Bra:** signaturer och bevisrapporter kan inte raderas bort under fötterna på
ett avtal (`RESTRICT`), och `AuditEvent.userId` sätts till `NULL` i stället för
att revisionsraden försvinner när en användare tas bort. Det uppfyller kravet
att historik och audit bevaras vid användarborttagning.

**Att notera:** `Building_propertyId_fkey` är `CASCADE`. En raderad fastighet tar
med sig byggnader → uppgångar → våningar. Objekten (`Unit`) hänger dock på
`propertyId` direkt (se `FASTIGHET-017`), så konsekvenserna av en fastighets-
radering är inte enhetliga. Ingen cascade korsar organisationsgräns, eftersom
alla organisationsbundna tabeller har `organizationId` FK mot samma
`Organization`.

### FK utan täckande index

40 främmande nycklar saknar index på sin första kolumn — se `FASTIGHET-014`.
Detta påverkar både joins och kostnaden för att verifiera CASCADE/SET NULL vid
radering.

## Dataintegritet (live)

| Kontroll | Utfall |
| --- | --- |
| `User` utan `personId` | 0 |
| `User` utan `organizationId` | 0 |
| `User` utan `UserRole` | 0 |
| `Person` utan `organizationId` | 0 |
| `Property` utan `organizationId` | 0 |
| `Unit` utan `propertyId` | 0 |
| `Unit` utan `buildingId` | **1 av 1** |
| `Listing` utan `unitId` | 0 |
| Organisationer | 1 |
| Globala roller (`organizationId IS NULL`) | 13 |
| `PersonRole`-rader | 0 |

Inga orphans, inga brutna referenser, inga null-värden där ägarskap krävs.

**Reservation:** datamängden är i praktiken tom (`Contract` 0, `MaintenanceRequest`
0, `Document` 0, `Invoice` 0, `Application` 0, `storage.objects` 0).
Integritetsresultaten är därför strukturellt korrekta men statistiskt svaga.
Kontroller som "dubbla aktiva avtal per objekt", "hyresgäst utan giltig
lägenhetsrelation" och "storage-objekt utan databasreferens" är
**vakuöst sanna** och måste köras om mot produktionsdata.

Den enda faktiska avvikelsen är `Unit.buildingId IS NULL` (`FASTIGHET-017`):
`Building` har 0 rader, så den dokumenterade hierarkin
`Property → Building → Entrance/Floor → Unit` används inte i praktiken.

## Constraints och immutabilitet

Tre triggerfunktioner upprätthåller oföränderlighet:

| Funktion | Skyddar |
| --- | --- |
| `reject_audit_mutation()` | `AuditEvent` — append-only |
| `reject_immutable_row_mutation()` | `ApplicationSnapshot`, `ContractSignature`, `EvidenceReport` m.fl. |
| `reject_locked_contract_version_mutation()` | `ContractVersion` efter låsning |

Samtliga är `SECURITY INVOKER` med låst `search_path` — korrekt.

Konkurrenskontroll sker via `version`-kolumner och `expected_status`-parametrar
i RPC:erna, som kastar `optimistic_lock_conflict` (SQLSTATE 40001). Radlås tas
med `FOR UPDATE` innan tillståndsläsning. `claim_outbox_jobs` använder
`FOR UPDATE SKIP LOCKED` — korrekt köhämtningsmönster.

Unikhet: `OperationIdempotency` har unikt index på
(organizationId, actorType, actorId, operation, idempotencyKey), och
`OutboxEvent` på `idempotencyKey`.

## Prestandaobservationer

Alla nedanstående är **teoretiska** — live-tabellerna är tomma, vilket gör
`EXPLAIN ANALYZE` meningslöst. De baseras på struktur, inte mätning.

| Observation | Bedömning |
| --- | --- |
| 40 FK utan index | Blir reell vid volym (`FASTIGHET-014`) |
| RLS-policyer med `EXISTS`-subselect på `ApplicationMember`/`ContractParty` | Kräver index på `(applicationId, personId)` resp. `(contractId, personId)` för att inte bli seq scan per rad |
| `app_has_permission()` anropas i varje policy | `STABLE`, så planeraren kan cacha per sats; joinar 3 tabeller. Bör indexeras på `UserRole(userId)`, `RolePermission(roleId)` |
| `current_user_context()` per request | En rundtur per sidladdning; alla portaler är `force-dynamic` → ingen cachning |
| `Document`-hämtning `.limit(2000)` | `src/lib/repositories/admin-records.ts:166` — hård gräns utan pagination |
| `admin_dashboard_metrics` / `admin_report_metrics` | Aggregat-RPC:er i stället för N+1 från Node — bra mönster |
| Ingen materialiserad vy | Publika katalogvyer beräknas per anrop |
| `btree_gist` i `public` | ~120 extra funktioner i applikationsschemat (`FASTIGHET-018`) |

Repositorielagret undviker genomgående N+1: relationer hämtas med
`.in(ids)`-batchning följt av `Map`-uppslag (se `workOrderRelations`,
`admin-records.ts:150-190`). Det är korrekt gjort.

## Extensions

`btree_gist` är installerat i `public` (`FASTIGHET-018`). Övriga extensions
(`pgcrypto` via `extensions`-schemat, refererat i `search_path`) ligger korrekt.

## Sammanfattande bedömning

Schemat är genomarbetat: 100 % RLS-täckning, medveten delete-semantik,
immutabilitetsskydd, optimistisk låsning och idempotens. Svagheterna ligger inte
i modellen utan i **utrullningsdisciplinen** — avsaknaden av migrationsliggare
och grant-defekten. Åtgärdas de två, är databasen i gott skick.
