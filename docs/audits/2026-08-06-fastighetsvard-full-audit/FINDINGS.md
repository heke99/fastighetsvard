# Findings

Evidensklassning: `CONFIRMED` (verifierad i live-databas eller exekverad kod),
`LIKELY` (starkt stöd i kod men ej runtime-verifierad), `POSSIBLE` (rimlig risk,
kräver test), `NOT VERIFIED`, `BLOCKED`.

Alla live-observationer kommer från read-only `pg_catalog`-introspektion mot
Supabase-projektet `Fastighetsvard` (ref `dmigdfbvudzexvdnbvrj`) 2026-08-06.

---

## FASTIGHET-001 — Oautentiserad skrivning till den oföränderliga revisionsloggen

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P0 – stop-ship** |
| Säkerhetsklassificering | Broken access control / audit-integritet |
| Status | **CONFIRMED** |
| Berört flöde | Revisionslogg, legal spårbarhet |
| Berörda roller | `anon` (oautentiserad), samtliga |
| Berörda organisationer | Samtliga (`p_organization_id` är fritt val) |

### Beskrivning

`public.write_audit_event(...)` är `SECURITY DEFINER`, saknar varje form av
auktoriseringskontroll och är EXECUTE-bar av rollen `anon`.

### Förväntat beteende

Endast `service_role` (och internt anropande betrodda RPC:er) ska kunna skriva
revisionshändelser. `.agent-memory/security-model.md` anger: *"Audit är
append-only och redigerar bort hemligheter/personnummer."*

### Faktiskt beteende

Vem som helst med den publika `anon`-nyckeln (som per definition är exponerad i
webbklienten) kan anropa `POST /rest/v1/rpc/write_audit_event` och skapa
godtyckliga `AuditEvent`-rader med valfri `organizationId`, `action`,
`entityType`, `entityId`, `before` och `after`.

### Evidens

Funktionskropp (live, `pg_get_functiondef`) — ingen guard:

```sql
CREATE OR REPLACE FUNCTION public.write_audit_event(
  p_organization_id text, p_action text, p_entity_type text, p_entity_id text,
  p_before jsonb DEFAULT NULL, p_after jsonb DEFAULT NULL,
  p_actor_type text DEFAULT 'user', p_actor_id text DEFAULT NULL,
  p_correlation_id text DEFAULT NULL)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER
 SET search_path TO 'public', 'extensions'
AS $function$
DECLARE v_id text := gen_random_uuid()::text;
BEGIN
  INSERT INTO public."AuditEvent" (...) VALUES (...);   -- ingen behörighetskontroll
  RETURN v_id;
END; $function$
```

ACL (live, `pg_proc.proacl`):

```text
write_audit_event = {postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}
```

Jämför en korrekt låst funktion i samma databas:

```text
claim_invitation  = {postgres=X/postgres,service_role=X/postgres}
consume_rate_limit= {postgres=X/postgres,service_role=X/postgres}
```

Supabase security advisor rapporterar samma sak:
`anon_security_definer_function_executable` (40 träffar, WARN).

Oföränderligheten bekräftas av triggerfunktionen `public.reject_audit_mutation()`
(`prosecdef=false`, `search_path=public, extensions`) som blockerar UPDATE/DELETE
på `AuditEvent`. Live-tabellen har dessutom
`REVOKE UPDATE, DELETE ON public."AuditEvent" FROM authenticated, anon`
(`supabase/migrations/20260724020000_auth_rls_storage_hardening.sql:319`).

### Konsekvens

- Revisionsloggen kan fyllas med falska händelser som utger sig för att komma
  från valfri aktör och organisation.
- Raderna kan **inte tas bort eller ändras** av applikationen — korruptionen är
  permanent och kräver manuell DBA-åtgärd med avstängd trigger.
- Legal spårbarhet och eventuell bevisvärdering vid tvist undermineras.
- Obegränsad tillväxt av tabellen (lagrings-DoS).

### Attackscenario

1. Angriparen läser `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` ur webbklientens
   JavaScript-bundle (publik design).
2. `POST https://<ref>.supabase.co/rest/v1/rpc/write_audit_event` med
   `apikey`-header och godtycklig payload.
3. Rader skapas i `AuditEvent` utan session, utan användare, utan spårbarhet.

### Fil- och radreferenser

- `supabase/migrations/20260724010000_core_domain_hardening.sql:1804`
  – `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;` (otillräcklig)
- `supabase/migrations/20260724010000_core_domain_hardening.sql:1805-1830`
  – GRANT-blocket som saknar `write_audit_event` men också saknar
  `REVOKE ... FROM anon`

### Databasobjekt

`public.write_audit_event(text,text,text,text,jsonb,jsonb,text,text,text)`,
`public."AuditEvent"`, `public.reject_audit_mutation()`

### Reproduktion (ej utförd — skrivande)

```sql
-- SET ROLE anon; SELECT public.write_audit_event('<org>','forged','contract','x');
```
Verifieras säkrast i staging. ACL:n ovan är bevis nog för åtkomsten.

### Root cause

`REVOKE ... FROM PUBLIC` tar inte bort de privilegier Supabase delar ut via
`ALTER DEFAULT PRIVILEGES ... GRANT ALL ON FUNCTIONS TO anon, authenticated,
service_role`. Se `FASTIGHET-004`.

### Rekommenderad åtgärd

```sql
REVOKE ALL ON FUNCTION public.write_audit_event(text,text,text,text,jsonb,jsonb,text,text,text)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.write_audit_event(...) TO service_role;
```

Funktionen anropas internt av andra `SECURITY DEFINER`-funktioner, vilket
fortsätter fungera eftersom dessa körs med ägarens rättigheter.

### Regressionstester

- `supabase/tests/verify_rls.sql`: assert att `has_function_privilege('anon', ...)`
  är `false` för samtliga muterande RPC:er.
- Utöka `scripts/lint.mjs` med en regel som kräver `FROM PUBLIC, anon, authenticated`
  i varje `REVOKE ALL ON FUNCTION`.

### Beroenden / blockerare

Ingen. Kan åtgärdas i en fristående migration. Kräver dock `FASTIGHET-003`
(migrationsliggare) för att kunna deployas via `supabase db push`.

---

## FASTIGHET-002 — Oautentiserad skrivning till outbox-kön

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P1** (eskalerar till P0 när en outbox-konsument driftsätts) |
| Säkerhetsklassificering | Broken access control / message injection |
| Status | **CONFIRMED** |
| Berört flöde | Asynkron leverans (OutboxEvent) |
| Berörda roller | `anon` |

### Beskrivning

`public.enqueue_outbox_event(...)` är `SECURITY DEFINER`, saknar auktorisering
och är EXECUTE-bar av `anon`.

### Evidens

```sql
CREATE OR REPLACE FUNCTION public.enqueue_outbox_event(
  p_organization_id text, p_event_type text, p_aggregate_type text,
  p_aggregate_id text, p_recipient text, p_payload jsonb, p_idempotency_key text)
 RETURNS text LANGUAGE plpgsql SECURITY DEFINER
AS $function$
DECLARE v_id text;
BEGIN
  INSERT INTO public."OutboxEvent" (...) VALUES (...)   -- ingen behörighetskontroll
  ON CONFLICT ("idempotencyKey") DO UPDATE SET ...
  RETURNING "id" INTO v_id; RETURN v_id;
END; $function$
```

ACL: `{postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`

Kontrast — `claim_outbox_jobs` har samma felaktiga ACL men **skyddar sig själv**:

```sql
IF auth.role() <> 'service_role' THEN
  RAISE EXCEPTION 'worker_role_required' USING ERRCODE = '42501';
END IF;
```

### Konsekvens

I nuläget: obegränsad oautentiserad insert i `OutboxEvent` (lagrings-DoS,
förgiftning av `idempotencyKey`-rymden så att legitima händelser tystas via
`ON CONFLICT DO UPDATE`).

**Eskalering:** `p_recipient` är fritt val. Så snart en outbox-konsument som
skickar e-post driftsätts (arkitekturen föreskriver en, se `FASTIGHET-005`) blir
detta en öppen e-postrelä från `info@faddebo.se` — dvs. phishing i FaddeBos namn.
Åtgärda **före** konsumenten byggs.

### Fil- och radreferenser

- `supabase/migrations/20260724010000_core_domain_hardening.sql:1804` (root cause)
- `src/lib/services/webhooks.ts:108-117` (visar att ingen konsument finns)

### Rekommenderad åtgärd

`REVOKE ALL ON FUNCTION public.enqueue_outbox_event(...) FROM PUBLIC, anon, authenticated;`
plus en intern guard analog med `claim_outbox_jobs`.

---

## FASTIGHET-003 — Live-databasen saknar migrationsliggare

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P1** |
| Status | **CONFIRMED** |
| Berört flöde | Release, deployment, schemastyrning |

### Beskrivning

Repot innehåller 36 forward-migrationer. Live-databasens
`supabase_migrations.schema_migrations` är **tom**.

### Evidens

`mcp__Supabase__list_migrations` → `{"migrations":[]}`
`scripts/lint.mjs` → `Static hardening checks passed (36 canonical migrations).`

Schemat är ändå deployat (79 tabeller i `public`, samtliga med RLS på), vilket
betyder att det applicerats utanför migrationskedjan — sannolikt via
`supabase/manual/*.sql` (10 filer, bl.a.
`00_REPAIR_FADDEBO_AUTH_SCHEMA.sql`, 872 rader).

### Konsekvens

- Schemats ursprung går inte att bevisa; ingen kan svara på vilken migration som
  faktiskt är applicerad.
- `supabase db push` skulle försöka applicera alla 36 migrationer från noll och
  sannolikt fallera eller skapa dubbletter.
- Drift kan inte upptäckas systematiskt. Se `FASTIGHET-004` och `FASTIGHET-006`
  som är konkreta bevis på att drift redan finns.

### Rekommenderad åtgärd

Jämför live-schemat mot en ren `supabase db reset` i staging, upprätta en
baseline-migration, och registrera samtliga 36 versioner via
`supabase migration repair --status applied`. Därefter är `db push` säkert.

### Blockerare

Kräver en staging-databas. `.agent-memory/open-blockers.md` BLOCKER-0003.

---

## FASTIGHET-004 — `REVOKE ... FROM PUBLIC` lämnar Supabase standardprivilegier kvar

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P1** (root cause för P0 `FASTIGHET-001`) |
| Status | **CONFIRMED** |

### Beskrivning

Migrationerna använder genomgående `REVOKE ALL ON FUNCTION ... FROM PUBLIC`.
Supabase installerar `ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT ALL ON
FUNCTIONS TO postgres, anon, authenticated, service_role`. Grants till den
namngivna rollen `anon` påverkas **inte** av en revoke mot `PUBLIC`.

### Evidens

Felaktigt mönster:

- `supabase/migrations/20260724010000_core_domain_hardening.sql:1804`
  `REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC;`
- `supabase/migrations/20260725020000_canonical_admin_commands.sql:387-390`
  `REVOKE ALL ON FUNCTION public.change_listing_status(...) FROM PUBLIC;`
- `supabase/migrations/20260725010000_faddebo_brand.sql:202`
- `supabase/migrations/20260725030000_public_catalog_repositories.sql:392-396`

Korrekt mönster (används på fyra ställen):

- `supabase/migrations/20260724015000_verified_email_otp_signing.sql:224`
  `... FROM PUBLIC, anon, authenticated;`
- `supabase/migrations/20260724020000_auth_rls_storage_hardening.sql:325`
- `supabase/migrations/20260724025000_distributed_rate_limiting.sql:67`

Live-utfall — funktioner som följde det korrekta mönstret är låsta,
resten är öppna för `anon`:

| Funktion | `proacl` live | Mönster i repo |
| --- | --- | --- |
| `claim_invitation` | `{postgres,service_role}` | `FROM PUBLIC, anon, authenticated` |
| `consume_rate_limit` | `{postgres,service_role}` | `FROM PUBLIC, anon, authenticated` |
| `change_listing_status` | `{postgres,**anon**,authenticated,service_role}` | `FROM PUBLIC` |
| `write_audit_event` | `{postgres,**anon**,authenticated,service_role}` | (ingen revoke) |
| `enqueue_outbox_event` | `{postgres,**anon**,authenticated,service_role}` | (ingen revoke) |

Totalt **40** funktioner är `anon`-exekverbara (Supabase advisor
`anon_security_definer_function_executable`).

### Riskbedömning per funktion

Merparten av domänkommandona **skyddar sig själva** och är därför inte
direkt exploaterbara:

```sql
-- change_listing_status / change_contract_status
IF auth.role() <> 'service_role'
   AND public.current_app_organization_id() IS DISTINCT FROM v_listing."organizationId" THEN
  RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
END IF;
IF auth.role() <> 'service_role' AND NOT public.app_has_permission('listings:update') THEN
  RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
END IF;
```

```sql
-- submit_rental_application / accept_rental_offer
IF auth.role() <> 'service_role' AND public.current_app_person_id() IS DISTINCT FROM p_person_id THEN
  RAISE EXCEPTION 'person_mismatch' USING ERRCODE = '42501';
END IF;
```

Undantagen — **utan guard** — är `write_audit_event` (`FASTIGHET-001`) och
`enqueue_outbox_event` (`FASTIGHET-002`). Se även `FASTIGHET-008`.

Skyddet vilar alltså i dag enbart på funktionskropparnas interna kontroller.
Det är ett enda lager, i strid med `.agent-memory/security-model.md`.

### Rekommenderad åtgärd

Ny migration som för varje funktion i `public` kör
`REVOKE ALL ON FUNCTION ... FROM PUBLIC, anon, authenticated;` och därefter
selektivt `GRANT EXECUTE ... TO authenticated`/`service_role` enligt faktisk
anropsväg. Lägg till lint-regel som avvisar `FROM PUBLIC;` utan `anon`.

---

## FASTIGHET-005 — Outbox-kön har ingen konsument

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P1** |
| Status | **CONFIRMED** |
| Berört flöde | Alla asynkrona notifieringar |

### Beskrivning

`.agent-memory/canonical-architecture.md` anger: *"Outboxen är källan för
asynkron leverans."* Sju anropsplatser i migrationerna skriver till
`OutboxEvent` via `enqueue_outbox_event`. **Ingen kod läser tabellen.**

### Evidens

```bash
$ grep -rn "OutboxEvent|claim_outbox|outbox" src/ scripts/ -i
src/lib/services/applications.ts:77:/** Skickar erbjudande, ... skapar outbox/audit atomiskt. */   # kommentar
scripts/lint.mjs:71:  "claim_outbox_jobs",              # lint-lista
scripts/lint.mjs:121: ... "claim_outbox_jobs(text,integer,integer) TO authenticated"   # lint-guard
```

Cron-jobbet i `vercel.json` pekar på `/api/internal/webhooks/process`, som
anropar `processPendingDeliveries()` i `src/lib/services/webhooks.ts:108-117`.
Den funktionen arbetar mot **`WebhookDelivery`**, en annan tabell:

```ts
export async function processPendingDeliveries(limit = 50) {
  const due = await claimWebhookDeliveries(limit);   // WebhookDelivery, inte OutboxEvent
  ...
}
```

Antal `enqueue_outbox_event`-anrop i migrationer: 5 i
`20260724010000_core_domain_hardening.sql`, 2 i
`20260725020000_canonical_admin_commands.sql`.

### Konsekvens

Varje händelse som arkitekturen dirigerar till outboxen — bl.a.
`offer.accepted`, `application.submitted`, `listing.status_changed` — registreras
och levereras **aldrig**. Raderna blir permanent `PENDING`. Ingen larmar, eftersom
ingen mäter kölängden.

Notera att felanmälningsflödet **inte** drabbas: det skickar e-post direkt via
`src/lib/services/maintenance.ts:109-122` och webhooks via `dispatchEvent()`.
Systemet har alltså två parallella leveransmekanismer där bara den ena fungerar
— vilket i sig är en dubblerad implementation av samma affärsregel.

### Rekommenderad åtgärd

Antingen (a) bygg en outbox-worker som anropar `claim_outbox_jobs` med
service-role och levererar, eller (b) ta bort outbox-anropen och dokumentera
`WebhookDelivery` + direkt e-post som den enda kanonisk vägen. Välj **en**.

---

## FASTIGHET-006 — Odokumenterad publik storage-bucket live

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P1** |
| Status | **CONFIRMED** |

### Beskrivning

Live har 10 buckets. Repot definierar 9.
`property-media` är **publik** och saknar migration.

### Evidens

Live (`storage.buckets`):

```text
application-documents  public=false
contract-drafts        public=false
exports                public=false
inspection-files       public=false
invoice-files          public=false
listing-media          public=true
maintenance-files      public=false
property-media         public=true    <-- saknas i repo
signed-contracts       public=false
tenant-documents       public=false
```

Repo (`supabase/migrations/20260720001500_storage_and_grants.sql:8`) definierar
endast de nio övriga.

Storage-policyn `private_storage_owner_or_staff_read` räknar upp buckets
explicit och inkluderar **inte** `property-media`. Det finns heller ingen
INSERT/UPDATE/DELETE-policy för bucketen.

### Konsekvens

- Bucketen är publikt läsbar utan path- eller organisationsbindning; allt som
  någonsin laddas upp dit är öppet på internet.
- En `db reset` från repot återskapar den inte → miljöerna divergerar.
- Ingen kod i `src/` refererar till `property-media`, vilket gör den till en
  oövervakad yta.

### Rekommenderad åtgärd

Fastställ om bucketen används. Antingen lägg till den i
`20260720001500_storage_and_grants.sql`-efterföljaren med korrekta policies,
eller ta bort den. Fram till dess: behandla den som publik.

---

## FASTIGHET-007 — Personalklassificering är en deny-list

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P1** |
| Säkerhetsklassificering | Privilege escalation (villkorad) |
| Status | **CONFIRMED** (kod) / **LIKELY** (exploaterbarhet) |

### Beskrivning

`isStaffAccount()` returnerar `true` för varje rollslug som inte är exakt
`contractor` eller `tenant`.

### Evidens

`src/lib/role-routing.ts:27-32`:

```ts
export function isStaffAccount(roleSlugs: string[]): boolean {
  if (hasAnyRole(roleSlugs, STAFF_ROLE_SLUGS)) return true;
  // Organization-specific custom roles are staff roles as well. ...
  return roleSlugs.some((role) => role !== "contractor" && role !== "tenant");
}
```

Detta är den **enda** grinden till `/admin`:

`src/app/admin/layout.tsx:15`:
```ts
if (!isStaffAccount(user.roleSlugs)) redirect(defaultDashboardForRoles(user.roleSlugs));
```

### Konsekvens

Varje ny, felstavad, importerad eller framtida portal-roll klassas automatiskt
som personal och får `/admin`. Designen är "fail-open": ett tillägg någon annan
gör i `Role` ger administrativ routing utan kodändring.

### Begränsande faktorer (varför P1 och inte P0)

1. Vanliga sökande har `roleSlugs = []` (rollerna `APPLICANT`/`TENANT` ligger i
   `PersonRole`, inte i `UserRole`→`Role.slug`). `[].some(...)` är `false`, så
   självregistrerade konton eskalerar inte. Live: `PersonRole` har 0 rader,
   `Role` har 13 globala rader.
2. Varje enskild admin-sida gör en egen behörighetskontroll, t.ex.
   `src/app/admin/hyresgaster/page.tsx:15-18`:
   ```ts
   if (!user?.organizationId || !hasPermission(user.permissions, "persons", "read")) redirect("/admin");
   ```
   och samtliga 26 server actions i `src/app/admin/actions.ts` anropar
   `requirePermission(...)`. En roll utan permissions ser alltså en tom
   admin-skal-vy, inte data.

Risken är därmed **åtkomst till administrationsskalet och rollnamn**, inte till
domändata — men klassificeringslogiken är fel och ska vändas.

### Rekommenderad åtgärd

Gör klassificeringen till en allow-list: personal = slug finns i
`STAFF_ROLE_SLUGS` **eller** rollen är en organisationsbunden roll markerad
`isStaff = true` i `Role`. Lägg till kolumnen om den saknas.

### Regressionstester

`tests/role-routing.test.ts` innehåller redan 6 tester; utöka med
`isStaffAccount(["okand-roll"]) === false`.

---

## FASTIGHET-008 — NULL-aktör passerar idempotensguarden

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P1** |
| Status | **CONFIRMED** (logik) / **POSSIBLE** (praktisk påverkan) |

### Beskrivning

`claim_idempotent_operation` skyddas av en `IS DISTINCT FROM`-jämförelse som är
`false` när båda sidor är `NULL`.

### Evidens

```sql
IF auth.role() <> 'service_role'
   AND p_actor_id IS DISTINCT FROM public.current_app_person_id()
   AND p_actor_id IS DISTINCT FROM public.current_app_user_id() THEN
  RAISE EXCEPTION 'actor_mismatch' USING ERRCODE = '42501';
END IF;
```

För `anon` returnerar både `current_app_person_id()` och `current_app_user_id()`
`NULL`. Anropas funktionen med `p_actor_id => NULL` blir båda villkoren `false`
och guarden passeras. ACL:n tillåter `anon` (`FASTIGHET-004`).

Samma NULL-mönster finns i `submit_rental_application` och
`accept_rental_offer`, men där stoppas anropet av den efterföljande
`organization_mismatch`-kontrollen, eftersom `current_app_organization_id()`
är `NULL` medan radens `organizationId` inte är det.

### Konsekvens

Oautentiserad insert av `OperationIdempotency`-rader med `actorId = NULL` och
valfri `organizationId`/`operation`/`idempotencyKey`. Genom att i förväg
registrera en nyckel som en legitim operation senare vill använda kan angriparen
framkalla `idempotency_key_reused_with_different_request` (SQLSTATE 23505) och
blockera den operationen — en riktad denial-of-service mot t.ex. en
ansökningsinlämning.

Praktisk exploaterbarhet kräver att angriparen gissar nyckeln. Nycklarna
genereras av klienten/servern per operation; deras entropi är inte verifierad i
denna audit.

### Rekommenderad åtgärd

Byt guarden till att kräva en icke-null aktör:

```sql
IF auth.role() <> 'service_role' AND (
     p_actor_id IS NULL
     OR (p_actor_id <> public.current_app_person_id()
         AND p_actor_id <> public.current_app_user_id())
   ) THEN RAISE EXCEPTION 'actor_mismatch' USING ERRCODE = '42501';
END IF;
```

plus revoke enligt `FASTIGHET-004` (repot avsåg redan `TO service_role`,
`20260724010000_core_domain_hardening.sql:1828`).

---

## FASTIGHET-009 — 28 tabeller har RLS aktiverat men inga policies

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P2** |
| Status | **CONFIRMED** |

### Beskrivning

RLS är på för samtliga 79 tabeller (bra), men 28 av dem har noll policies.
Effekten är fail-closed — men den betyder också att RLS inte är den
verksamma gränsen för dessa entiteter; all åtkomst går via service-role.

### Evidens

Tabeller med `relrowsecurity = true` och `n_policies = 0`:

```text
ApiKey, ContractStatusEvent, Counter, Entrance, ExternalReference, Floor,
IdempotencyRecord, ImportJob, InboundWebhookEvent, Inspection,
IntegrationConnection, IntegrationSyncJob, Invitation, ListingPublication,
MasterDataConfig, OperationIdempotency, PasswordResetToken, RateLimitBucket,
Role, RolePermission, SavedSearch(?), Session, SigningChallenge, Supplier,
SyncReviewItem, UnitMedia, UserRole, WebhookDelivery, WebhookSubscription
```

Supabase advisor: `rls_enabled_no_policy` (28 INFO).

Vissa av dessa har dessutom kvarvarande table-grants till `authenticated`/`anon`
som blir verkningslösa endast tack vare RLS:

| Tabell | `authenticated` SELECT/INSERT/UPDATE/DELETE | `anon` SELECT |
| --- | --- | --- |
| `PasswordResetToken` | true / true / true / true | true |
| `Session` | true / true / true / true | true |
| `ApplicationSnapshot` | true / true / true / true | true |
| `Reservation` | true / true / true / true | true |
| `SigningSession` | true / true / true / true | true |

### Konsekvens

Ett enda framtida `CREATE POLICY ... USING (true)` eller ett `ALTER TABLE ...
DISABLE ROW LEVEL SECURITY` exponerar direkt sessions- och
återställningstokentabeller. Skyddet är en enda felkonfiguration djupt.

### Rekommenderad åtgärd

`REVOKE ALL ON <tabell> FROM anon, authenticated;` för samtliga tabeller som
enbart ska nås av service-role. Lägg till `FORCE ROW LEVEL SECURITY` där ägaren
annars kringgår policies.

---

## FASTIGHET-010 — Fyra publika vyer är SECURITY DEFINER

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P2** |
| Status | **CONFIRMED** |

### Evidens

| Vy | `security_invoker` | `anon` SELECT |
| --- | --- | --- |
| `published_listing_catalog` | NOT SET | true |
| `published_listing_cities` | NOT SET | true |
| `upcoming_unit_catalog` | NOT SET | true |
| `public_property_catalog` | NOT SET | true |
| `api_customer_catalog` | NOT SET | false |

Supabase advisor: `security_definer_view` (4 ERROR).

Utan `security_invoker = true` körs vyerna med ägarens (postgres) rättigheter och
**kringgår RLS** på underliggande tabeller. Vyerna har `security_barrier = true`,
vilket skyddar mot predikatläckage men inte mot RLS-bypass.

### Konsekvens

Vyernas `WHERE`-satser är den enda filtreringen mellan `anon` och tabeller som
`Listing`, `Unit`, `Property`. Filtreringen förefaller korrekt (endast
`PUBLISHED`), men den är inte försvarad i djupled: en framtida kolumn eller
ändrad `WHERE`-sats exponerar opublicerad data direkt.

### Rekommenderad åtgärd

`ALTER VIEW ... SET (security_invoker = true);` och lägg till RLS-policies för
`anon` som speglar den publika delmängden. Verifiera att den publika katalogen
fortfarande fungerar.

---

## FASTIGHET-011 — Filuppladdning validerar endast klientskickad MIME-typ

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P2** |
| Status | **CONFIRMED** |

### Evidens

`src/lib/repositories/maintenance-files.ts:32-43`:

```ts
export function validateMaintenanceFiles(files: File[]): string | null {
  if (files.length > MAX_FILES) return `Du kan bifoga högst ${MAX_FILES} filer.`;
  for (const file of files) {
    if (!ALLOWED_MIME_TYPES.has(file.type)) { ... }   // file.type = klientens Content-Type
    if (file.size > MAX_FILE_SIZE) { ... }
  }
  return null;
}
```

`file.type` kommer från multipart-headern och är helt angriparkontrollerad.
Ingen magic byte-kontroll utförs. Samma värde skickas vidare som `contentType`
till Storage (`:74`) och lagras i `Document.mimeType` (`:86`).

### Positiva iakttagelser

- Filnamnet saneras korrekt — ingen path traversal:
  `:16` `.replace(/[^a-z0-9]/g, "")` med längdgräns 8.
- Storage-nyckeln byggs server-side av betrodda värden:
  `:71` `${organizationId}/${personId}/${requestId}/${randomUUID()}.${ext}`
  vilket matchar storage-policyn `foldername[1]=org AND foldername[2]=person`.
- Ärendet ägarverifieras före uppladdning (`:58-67`).
- Bucketen har `allowed_mime_types` satt även på Storage-nivå — men den
  kontrollen använder samma klientskickade header.

### Konsekvens

Godtyckliga bytes kan lagras märkta som `image/png`. Bucketen är privat och nås
via signerad URL, så direkt XSS är begränsad; risken ligger i nedladdning till
personalens klienter och i PDF-baserade nyttolaster.

### Rekommenderad åtgärd

Läs de första bytena och verifiera magic numbers (`\x89PNG`, `\xFF\xD8\xFF`,
`RIFF....WEBP`, `%PDF-`) innan uppladdning. Sätt `Content-Disposition: attachment`
på signerade nedladdningar.

---

## FASTIGHET-012 — Oanvänd organisationsparameter i arbetsorderrelationer

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P2** |
| Status | **CONFIRMED** |

### Evidens

`src/lib/repositories/admin-records.ts:150-175`:

```ts
async function workOrderRelations(workOrders: Row[], organizationId?: string) {
  const admin = createAdminClient();
  ...
      admin.from("MaintenanceRequest")
          .select("id,unitId,requestNumber,contactPhone,preferredTime,masterKeyAllowed,petsInHome")
          .in("id", requestIds)            // <-- ingen .eq("organizationId", ...)
  ...
      admin.from("Supplier").select("id,name").in("id", supplierIds)         // <-- ingen
  ...
      await admin.from("Unit").select("id,address,city").in("id", unitIds)   // <-- ingen
```

Parametern `organizationId` deklareras men används aldrig i funktionskroppen.

### Konsekvens

Frågorna körs med service-role och saknar organisationspredikat, i strid med
`.agent-memory/security-model.md`: *"Service-role-klienter är server-only och
måste tillämpa explicita organisationspredikat."*

Exponeringen är i dag indirekt begränsad: `requestIds`/`supplierIds`/`unitIds`
härleds från en redan organisationsfiltrerad förälderfråga. Med **en** organisation
live är den praktiska risken noll. Skyddet vilar dock helt på anroparen, och
`organizationId` finns redan i signaturen — det är en glömd guard, inte ett
medvetet val.

Notera att `MaintenanceRequest`-projektionen inkluderar `contactPhone`,
`masterKeyAllowed` och `petsInHome`, dvs. känsliga uppgifter om tillträde till
bostaden.

### Rekommenderad åtgärd

Lägg till `.eq("organizationId", organizationId)` på alla tre frågorna och gör
parametern obligatorisk. Övriga 116 förekomster av `organizationId` i filen visar
att mönstret annars följs.

---

## FASTIGHET-013 — `PersonRole`-policy saknar organisationspredikat

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P2** |
| Status | **CONFIRMED** |

### Evidens

Live-policy:

```sql
person_roles_read_own_or_authorized  SELECT  {authenticated}
USING (("personId" = current_app_person_id()) OR app_has_permission('persons:read'))
```

Jämför den korrekta motsvarigheten på `Person`:

```sql
person_read_own_or_authorized  SELECT  {authenticated}
USING ((id = current_app_person_id())
       OR (("organizationId" = current_app_organization_id()) AND app_has_permission('persons:read')))
```

### Konsekvens

Med `persons:read` kan personal läsa `PersonRole` för **alla** personer,
oavsett organisation. Produkten är i dag enorganisations (`Organization` har 1
rad live), så påverkan är noll — men policyn bryter mot den dokumenterade
regeln att `organizationId` är säkerhetsgränsen och blir en verklig
cross-organisation-läcka den dag en andra organisation läggs till.

### Rekommenderad åtgärd

```sql
USING ("personId" = current_app_person_id()
       OR EXISTS (SELECT 1 FROM "Person" p
                  WHERE p.id = "PersonRole"."personId"
                    AND p."organizationId" = current_app_organization_id()
                    AND app_has_permission('persons:read')))
```

---

## FASTIGHET-014 — 40+ främmande nycklar saknar täckande index

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P2** |
| Status | **CONFIRMED** (struktur) / **POSSIBLE** (påverkan) |

### Evidens

Live-fråga mot `pg_constraint`/`pg_index` returnerade 40 FK utan index på första
kolumnen (trunkerad lista). Urval med hög trafikpotential:

| Tabell | Constraint | ON DELETE |
| --- | --- | --- |
| `ApplicationMember` | `ApplicationMember_personId_fkey` | CASCADE |
| `ContractParty` | `ContractParty_personId_fkey` | CASCADE |
| `Document` | `Document_maintenanceRequestId_fkey` | SET NULL |
| `Document` | `Document_unitId_fkey` | SET NULL |
| `Document` | `Document_propertyId_fkey` | SET NULL |
| `InvoiceLine` | `InvoiceLine_invoiceId_fkey` | CASCADE |
| `Listing` | `Listing_unitId_fkey` | CASCADE |
| `MaintenanceRequest` | `MaintenanceRequest_unitId_fkey` | SET NULL |
| `Building` | `Building_propertyId_fkey` | CASCADE |
| `AuditEvent` | `AuditEvent_userId_fkey` | SET NULL |

### Konsekvens

Två effekter: (a) joins och ägarskapsuppslag gör seq scan, (b) varje `DELETE`
på förälderraden tvingar full scan av barntabellen för att verifiera CASCADE/SET
NULL, med lästlås under tiden.

Påverkan är i dag **teoretisk** — live-tabellerna är i praktiken tomma
(`MaintenanceRequest` 0 rader, `Contract` 0, `Document` 0). Den blir reell vid
produktionsvolym. `supabase/migrations/20260720001000_indexes.sql` (256 rader)
täcker uppenbarligen inte FK-kolumnerna systematiskt.

### Rekommenderad åtgärd

Generera index för samtliga FK-förstakolumner via
`CREATE INDEX CONCURRENTLY`. Mät med `EXPLAIN` mot representativ datamängd innan
och efter; utan data är `EXPLAIN ANALYZE` inte meningsfullt (utfördes därför inte).

---

## FASTIGHET-015 — `set_updated_at` har mutabel search_path

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P2** |
| Status | **CONFIRMED** |

### Evidens

```text
proname = set_updated_at, prosecdef = false, proconfig = (none)
```

Supabase advisor: `function_search_path_mutable` (1 WARN).

Alla övriga applikationsfunktioner har låst `search_path`
(`public, extensions` eller `public, pg_temp`).

### Konsekvens

Funktionen är `SECURITY INVOKER`, vilket kraftigt begränsar risken — den kör med
anroparens rättigheter. Som triggerfunktion körs den dock i varje UPDATE. En
angripare med rätt att skapa objekt i en schema tidigt i `search_path` skulle
kunna kapa ett osäkert kvalificerat anrop. Kroppen är sannolikt trivial
(`NEW."updatedAt" = now()`), men avvikelsen från projektets egen standard bör
åtgärdas.

### Rekommenderad åtgärd

`ALTER FUNCTION public.set_updated_at() SET search_path = pg_catalog, public;`

---

## FASTIGHET-016 — Skydd mot läckta lösenord är avstängt

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P2** |
| Status | **CONFIRMED** |

### Evidens

Supabase advisor: `auth_leaked_password_protection` — *"Leaked Password
Protection Disabled ... checking against HaveIBeenPwned.org."*

### Konsekvens

Användare kan sätta lösenord som redan förekommer i kända intrångsdumpar.
Plattformen hanterar hyresavtal, fakturor och personuppgifter.
`.agent-memory/authentication-and-rbac.md` konstaterar att MFA är overifierat;
det finns alltså inget kompenserande andra faktor-skydd.

### Rekommenderad åtgärd

Aktivera i Supabase Auth-konfigurationen (`supabase/config.toml` respektive
projektinställningarna). Överväg minimilängd och MFA för personalkonton.

---

## FASTIGHET-017 — Fastighetshierarkin är inte framtvingad

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P2** |
| Status | **CONFIRMED** |

### Beskrivning

`.agent-memory/domain-model.md` föreskriver `Property → Building →
Entrance/Floor → Unit` som "kanonisk fysisk hierarki". Databasen tillåter att
hoppa över `Building`.

### Evidens

Live-data:

```text
Property                4 rader
Building                0 rader
Entrance                0 rader
Floor                   0 rader
Unit                    1 rad
Unit utan buildingId    1        <-- 100 % av objekten
Unit utan propertyId    0
```

`Unit` har alltså både `propertyId` och `buildingId`, där den senare är nullbar,
och används i praktiken inte. Det ger två vägar från `Unit` till `Property`:
direkt, och via `Building.propertyId`.

### Konsekvens

- Två sanningskällor för "vilken fastighet tillhör objektet" som kan divergera.
  Ingen constraint garanterar att `Unit.propertyId = Building.propertyId` när
  båda är satta.
- Härledd organisationstillhörighet blir beroende av vilken väg koden råkar
  välja.
- Rapporter och dashboards som grupperar per byggnad blir tomma.

### Rekommenderad åtgärd

Bestäm en kanonisk väg. Om `buildingId` ska vara obligatorisk: backfill och
`SET NOT NULL`. Om `propertyId` är kanonisk: lägg en composite FK
`(buildingId, propertyId) REFERENCES Building(id, propertyId)` så att de inte
kan divergera.

---

## FASTIGHET-018 — `btree_gist` installerat i schemat `public`

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P2** |
| Status | **CONFIRMED** |

### Evidens

Supabase advisor: `extension_in_public`. Live `pg_proc` visar ~120
`gbt_*`/`*_dist`-funktioner i `public`.

### Konsekvens

Extensionens funktioner blandas med applikationens i `public` och ärver
Supabase standardgrants till `anon`/`authenticated`. Det gör
funktionsinventeringen svårläst och ökar ytan för `search_path`-relaterade
problem. Extensionen används rimligen för exclusion constraints på
tidsintervall (bokningar/reservationer).

### Rekommenderad åtgärd

Flytta till `extensions`-schemat: `ALTER EXTENSION btree_gist SET SCHEMA extensions;`
Verifiera att beroende constraints fortsatt fungerar; kräver testkörning.

---

## FASTIGHET-019 — Projektminnet är inaktuellt om testläget

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P3** |
| Status | **CONFIRMED** |

### Evidens

`.agent-memory/current-state.md` anger under "NOT RUN":

> *"dependency installation, complete semantic typecheck, Vitest and Next build ...
> Reason: `npm ci` is blocked by the environment's internal npm registry returning
> 404 for the locked `zod-3.25.76.tgz` tarball."*

I denna audit kördes hela grinden utan problem:

```text
npm ci                     exit 0
npm run lint               Static hardening checks passed (36 canonical migrations).
npm run verify:accounts    Alla 16 konto-verifieringar godkändes.
npm run verify:login-dashboard  Alla 10 login- och dashboardkontroller godkändes.
npm run verify:consistency Alla 27 roll- och felanmälningskontroller godkändes.
npm run typecheck          rent (tsc --noEmit)
npm run test:unit          7 filer, 50 tester, samtliga gröna
npm run build              lyckades
```

### Konsekvens

`AGENTS.md` föreskriver att minnet ska uppdateras i samma ändring som arbetet.
Ett minne som felaktigt påstår att grinden är blockerad får kommande sessioner
att hoppa över verifiering de faktiskt kan utföra.

### Rekommenderad åtgärd

Uppdatera `current-state.md` och `open-blockers.md`. BLOCKER-0003 gäller
fortfarande DB/RLS-sviterna (kräver PostgreSQL), men **inte** npm/typecheck/
test/build.

---

## FASTIGHET-020 — Rotkatalogen innehåller tio överlappande statusrapporter

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P3** |
| Status | **CONFIRMED** |

### Evidens

```text
CHANGED_FILES.md  DELETE_FILES.txt  DELIVERY_REPORT.md
FADDEBO_ACCOUNT_FIX_REPORT.md  FADDEBO_KONSEKVENSRAPPORT.md
FADDEBO_LOGIN_DASHBOARD_FIX.md  FADDEBO_OWNER_AUTH_FIX.md
PATCH_FILES.txt  SPLIT_MIGRATIONS.md  TESTFIX_README.md
```

`.agent-memory/README.md` föreskriver att superseded rapporter flyttas till
`archive/`. `archive/`-katalogerna finns men innehåller endast `README.md`-filer
plus en historisk statusfil.

### Konsekvens

Ingen funktionell påverkan. Läsordningen blir otydlig och risken ökar att en
framtida session följer en inaktuell rapport i stället för `.agent-memory`.

### Rekommenderad åtgärd

Flytta till `.agent-memory/archive/historical-status/` eller
`docs/`. Behåll `README.md` och `DELIVERY_REPORT.md` i roten.

---

## FASTIGHET-021 — Inga kodfiler överstiger 2 000 rader

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P3** (informativ) |
| Status | **CONFIRMED** |

### Evidens

Största filer i `src/`, `supabase/`, `tests/`, `scripts/`:

| Rader | Fil |
| --- | --- |
| 1832 | `supabase/migrations/20260724010000_core_domain_hardening.sql` |
| 1060 | `src/lib/repositories/admin-records.ts` |
| 908 | `src/app/admin/actions.ts` |
| 872 | `supabase/manual/00_REPAIR_FADDEBO_AUTH_SCHEMA.sql` |
| 865 | `supabase/migrations/20260804090000_faddebo_account_lifecycle.sql` |
| 766 | `supabase/migrations/20260720001100_foreign_keys_core.sql` |

Totalt 32 970 rader över 242 filer. **Ingen fil passerar 2 000-radersgränsen**,
så kravet på uppdelningsanalys utlöses inte.

### Observation (utan åtgärdskrav i denna fas)

`20260724010000_core_domain_hardening.sql` (1832 rader) blandar tabelländringar,
~30 RPC-definitioner, triggers och hela grant-blocket. Det är filen som
innehåller grant-defekten i `FASTIGHET-004`, och dess storlek är en bidragande
orsak till att defekten inte upptäckts. `SPLIT_MIGRATIONS.md` visar att projektet
redan resonerat kring uppdelning.

`admin-records.ts` (1060 rader, 80 `.from()`-anrop) samlar läsningar för alla
admin-vyer och är kandidat för uppdelning per domän.

---

## FASTIGHET-022 — Interna felanmälningskommentarer skyddas endast av applikationsfrågan

| Fält | Värde |
| --- | --- |
| Allvarlighetsgrad | **P1** |
| Säkerhetsklassificering | Sensitive data exposure / broken access control |
| Status | **CONFIRMED** |
| Berört flöde | Felanmälan – kommentarer |
| Berörda roller | Hyresgäst (`authenticated` med egen `personId`) |

### Beskrivning

`MaintenanceComment.isInternal` skiljer personalens interna anteckningar från
kommentarer avsedda för hyresgästen. Filtreringen sker **enbart i
applikationsfrågan**. RLS-policyn filtrerar inte på kolumnen, och hyresgästen har
direkt `SELECT`-rättighet på tabellen.

### Förväntat beteende

`.agent-memory/organization-and-rls.md`: *"hyresgäster ser sitt
avtal/hyresförhållande, fakturor, dokument och ärenden"* — interna
personalanteckningar ska aldrig nå hyresgästen, oavsett åtkomstväg.

### Faktiskt beteende

Applikationslagret filtrerar korrekt:

`src/lib/repositories/portal-records.ts:289-294`
```ts
supabase
  .from("MaintenanceComment")
  .select("id,authorName,body,createdAt")
  .eq("requestId", requestId)
  .eq("isInternal", false)          // <-- enda skyddet
  .order("createdAt", { ascending: true }),
```

RLS-policyn gör det inte:

```sql
maintenance_comment_owner_or_staff_read   SELECT   {authenticated}
USING (EXISTS (SELECT 1 FROM "MaintenanceRequest" mr
               WHERE mr.id = "MaintenanceComment"."requestId"
                 AND (mr."personId" = current_app_person_id()
                      OR (mr."organizationId" = current_app_organization_id()
                          AND app_has_permission('maintenance:read')))))
```

Ingen referens till `isInternal`. Tabellrättigheter live:
`MaintenanceComment` → `authenticated` `SELECT = true`.

Frågan i `portal-records.ts` använder dessutom
`createServerSupabaseClient()` — dvs. hyresgästens egen JWT. Samma JWT kan
användas direkt mot PostgREST.

### Konsekvens

En hyresgäst kan hämta samtliga interna kommentarer på sitt eget ärende:

```http
GET /rest/v1/MaintenanceComment?requestId=eq.<eget-ärende-id>&select=*
Authorization: Bearer <hyresgästens egen access token>
apikey: <publik nyckel>
```

Interna anteckningar kan innehålla bedömningar av hyresgästen,
kostnadsuppskattningar, entreprenörsdialog eller information om andra boende.
Detta är exakt det mönster auditen efterfrågar: **ett dolt UI-element är den
enda behörighetskontrollen.**

Begränsning: endast ärenden där hyresgästen själv är `personId` nås. Det är
inte en cross-organisationsläcka.

### Attackscenario

1. Hyresgästen loggar in normalt och öppnar utvecklarverktygen.
2. Access token och den publika nyckeln läses ur webbläsarens lagring.
3. Ett direkt PostgREST-anrop utan `isInternal`-filter returnerar allt.

Ingen manipulation av request body, cookies eller URL krävs — bara att
applikationens eget filter utelämnas.

### Fil- och radreferenser

- `src/lib/repositories/portal-records.ts:289-294`
- `supabase/migrations/20260720000500_tables_maintenance_platform.sql:37-47`
  (kolumnen `isInternal` definieras)
- `supabase/migrations/20260720001400_rls_policies.sql` (policyn)

### Databasobjekt

`public."MaintenanceComment"`, policy `maintenance_comment_owner_or_staff_read`

### Root cause

Affärsregeln "intern kommentar syns inte för hyresgäst" implementerades i
frågelagret i stället för i radgränsen. RLS-policyn skrevs för
*ärendetillhörighet*, inte för *kommentarssynlighet*.

### Rekommenderad åtgärd

Dela policyn i två:

```sql
DROP POLICY maintenance_comment_owner_or_staff_read ON public."MaintenanceComment";

CREATE POLICY maintenance_comment_tenant_read ON public."MaintenanceComment"
  FOR SELECT TO authenticated
  USING ("isInternal" = false
         AND EXISTS (SELECT 1 FROM public."MaintenanceRequest" mr
                     WHERE mr.id = "MaintenanceComment"."requestId"
                       AND mr."personId" = public.current_app_person_id()));

CREATE POLICY maintenance_comment_staff_read ON public."MaintenanceComment"
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public."MaintenanceRequest" mr
                 WHERE mr.id = "MaintenanceComment"."requestId"
                   AND mr."organizationId" = public.current_app_organization_id()
                   AND public.app_has_permission('maintenance:read')));
```

Behåll `.eq("isInternal", false)` i `portal-records.ts` som andra lager.

### Regressionstester

Utöka `supabase/tests/verify_rls.sql`: sätt sessionen till en hyresgäst,
infoga en `isInternal = true`-kommentar på hyresgästens ärende och assertera att
`SELECT` returnerar noll rader.

### Beroenden / blockerare

Kräver staging-databas för att verifiera att personalvyn fortfarande ser båda
kommentarstyperna (`admin`-vägen går via service-role och påverkas inte).
