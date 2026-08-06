# RLS och RBAC

Samtliga uppgifter nedan är hämtade från live-databasen
(`pg_policies`, `pg_class`, `pg_proc`, `pg_namespace`) 2026-08-06.

## Sammanfattning

| Mätpunkt | Värde |
| --- | --- |
| Tabeller i `public` | 79 |
| Tabeller med RLS aktiverat | **79 (100 %)** |
| Tabeller med `FORCE ROW LEVEL SECURITY` | **0** |
| Tabeller med minst en policy | 51 |
| Tabeller med RLS men **noll** policies | **28** |
| Policies totalt (`public` + `storage`) | 51 + 5 |
| SECURITY DEFINER-funktioner exekverbara av `anon` | **40** |
| SECURITY DEFINER-vyer (`security_invoker` ej satt) | **4** |

100 % RLS-täckning är ett starkt resultat och upprätthålls automatiskt av
event-triggern `rls_auto_enable()`, som aktiverar RLS på varje ny tabell i
`public`. Det är ett genuint bra designval.

## Rollmodell

### Databasroller

| Roll | Användning |
| --- | --- |
| `anon` | Publik webb, oautentiserad |
| `authenticated` | Inloggad användare, JWT från Supabase Auth |
| `service_role` | Server-only, `src/lib/supabase/admin.ts` |
| `postgres` | Migrationer, funktionsägare |

### Applikationsroller (`Role.slug`, 13 globala rader live)

`superadmin`, `org-admin`, `property-owner`, `property-manager`, `caretaker`,
`leasing-agent`, `sales-manager`, `finance`, `customer-service`,
`facility-worker`, `inspector`, `report-viewer`, `contractor`
(+ `tenant` som portal-klass).

`RolePermission` har 120 rader live. `UserRole` 2 rader (de två personalkontona).

### Personroller (`PersonRole.role`)

`APPLICANT`, `CO_APPLICANT`, `TENANT`, `CO_TENANT`. **0 rader live.**

> Detta är en viktig distinktion: en användares *routing* styrs av
> `UserRole → Role.slug`, medan *portalinnehåll* styrs av `PersonRole`.
> Sökande har alltså tomma `roleSlugs`.

## Auktoritativ rollkälla

Det finns **en** auktoritativ källa: `current_user_context()`.

```text
auth.uid()  →  User.authUserId  →  User (isActive)
                                    ├─ organizationId
                                    ├─ personId  → Person → PersonRole
                                    ├─ supplierId
                                    └─ UserRole → Role → RolePermission
```

`src/lib/repositories/auth-context.ts:8` anropar RPC:n; `src/lib/auth.ts:99-110`
cachar resultatet per request med Reacts `cache()`.

**Roller finns inte i JWT eller auth-metadata.** Det är ett medvetet och bra val:
det finns ingen risk för stale claims efter rollbyte, och klienten kan aldrig
förfalska en roll. Priset är en databasrundtur per request.

`current_user_context()` är EXECUTE-bar endast av `authenticated` och
`service_role` (`proacl` saknar `anon`) — korrekt låst.

## RLS-mönster

Policyerna följer tre konsekventa mönster:

**1. Ägare eller behörig personal**
```sql
-- MaintenanceRequest
USING ("personId" = current_app_person_id()
       OR ("organizationId" = current_app_organization_id()
           AND app_has_permission('maintenance:read')))
```

**2. Part i relation eller behörig personal**
```sql
-- Contract
USING (EXISTS (SELECT 1 FROM "ContractParty" cp
               WHERE cp."contractId" = "Contract".id
                 AND cp."personId" = current_app_person_id())
       OR ("organizationId" = current_app_organization_id()
           AND app_has_permission('contracts:read')))
```

**3. Endast personal**
```sql
-- Property / Building / Unit / Listing
USING ("organizationId" = current_app_organization_id()
       AND app_has_permission('properties:read'))
```

Härledd åtkomst till barnrader (`MaintenanceComment`, `MaintenanceStatusEvent`,
`InvoiceLine`, `ContractVersion`, `ApplicationStatusEvent`) går alltid via
`EXISTS`-join mot föräldern. **Ingen policy litar på ett klientskickat ID.**
Det innebär att en angripare inte kan korskoppla genom att skicka ett giltigt ID
från en annan kontext — kopplingen verifieras alltid mot föräldern.

## Kritisk observation: RLS är inte den verksamma gränsen

Av 21 repositories använder **19 uteslutande `createAdminClient()`**
(service-role, kringgår RLS). Endast tre använder användarklienten:

| Repository | admin-anrop | server-anrop |
| --- | --- | --- |
| `portal-records.ts` | 2 | **20** |
| `public-catalog.ts` | 0 | **11** |
| `rental-operations.ts` | 3 | **13** |
| `admin-records.ts` | 25 | 0 |
| `admin-operations.ts` | 12 | 0 |
| `external-api-records.ts` | 15 | 0 |
| `integration-records.ts` | 15 | 0 |
| (14 övriga) | 2–7 | 0 |

**Konsekvens:** RLS skyddar portalen och den publika katalogen. All
administration, hela externa API:t och alla integrationer skyddas uteslutande av
applikationskod (`hasPermission` / `requirePermission` / `authenticateApiRequest`)
plus manuella `.eq("organizationId", ...)`-predikat.

Detta är ett legitimt arkitekturval som `.agent-memory/security-model.md`
uttryckligen beskriver. Men det betyder att påståendet *"RLS är den slutliga
radgränsen"* endast gäller användarscopeade klienter — dvs. en minoritet av
läsvägarna. Ett glömt organisationspredikat i service-role-kod har inget
skyddsnät. `FASTIGHET-012` är exakt ett sådant fall.

## Tabeller med RLS men inga policies

```text
ApiKey                ContractStatusEvent   Counter               Entrance
ExternalReference     Floor                 IdempotencyRecord     ImportJob
InboundWebhookEvent   Inspection            IntegrationConnection IntegrationSyncJob
Invitation            ListingPublication    MasterDataConfig      OperationIdempotency
PasswordResetToken    RateLimitBucket       Role                  RolePermission
Session               SigningChallenge      Supplier              SyncReviewItem
UnitMedia             UserRole              WebhookDelivery       WebhookSubscription
```

Effekten är **fail-closed** (deny all för `anon`/`authenticated`), vilket räddar
flera tabeller som fortfarande har kvarvarande table-grants:

| Tabell | `authenticated` S/I/U/D | `anon` SELECT | Räddas av |
| --- | --- | --- | --- |
| `PasswordResetToken` | ✔/✔/✔/✔ | ✔ | RLS utan policy |
| `Session` | ✔/✔/✔/✔ | ✔ | RLS utan policy |
| `ApplicationSnapshot` | ✔/✔/✔/✔ | ✔ | endast SELECT-policy finns |
| `SigningSession` | ✔/✔/✔/✔ | ✔ | endast SELECT-policy finns |
| `Reservation` | ✔/✔/✔/✔ | ✔ | endast SELECT-policy finns |

Se `FASTIGHET-009`. Åtgärd: `REVOKE ALL ... FROM anon, authenticated` på alla
service-role-tabeller, samt `FORCE ROW LEVEL SECURITY`.

## SECURITY DEFINER-funktioner

### Grant-tillståndet live

| Mönster i migration | Antal | Live-resultat |
| --- | --- | --- |
| `REVOKE ... FROM PUBLIC, anon, authenticated` | 4 funktioner | **Låsta** — `{postgres, service_role}` |
| `REVOKE ... FROM PUBLIC` | ~30 funktioner | **Öppna för `anon`** |
| Ingen revoke | ~10 funktioner | **Öppna för `anon`** |

Rotorsak i `FASTIGHET-004`. Supabase advisor bekräftar:
`anon_security_definer_function_executable` 40 st,
`authenticated_security_definer_function_executable` 44 st.

### Interna skydd i funktionerna

De flesta funktioner kompenserar med egna kontroller. Tre skyddsmönster används:

```sql
-- A. Organisations- + permissionkontroll (change_*_status)
IF auth.role() <> 'service_role'
   AND public.current_app_organization_id() IS DISTINCT FROM v_row."organizationId" THEN
  RAISE EXCEPTION 'organization_mismatch' USING ERRCODE = '42501';
END IF;
IF auth.role() <> 'service_role' AND NOT public.app_has_permission('...:update') THEN
  RAISE EXCEPTION 'permission_denied' USING ERRCODE = '42501';
END IF;

-- B. Personidentitetskontroll (submit_rental_application, accept_rental_offer)
IF auth.role() <> 'service_role' AND public.current_app_person_id() IS DISTINCT FROM p_person_id THEN
  RAISE EXCEPTION 'person_mismatch' USING ERRCODE = '42501';
END IF;

-- C. Ren service-role-gate (claim_outbox_jobs)
IF auth.role() <> 'service_role' THEN
  RAISE EXCEPTION 'worker_role_required' USING ERRCODE = '42501';
END IF;
```

### Funktioner utan skydd

| Funktion | Guard | `anon` EXECUTE | Finding |
| --- | --- | --- | --- |
| `write_audit_event` | **ingen** | ✔ | `FASTIGHET-001` (P0) |
| `enqueue_outbox_event` | **ingen** | ✔ | `FASTIGHET-002` (P1) |
| `claim_idempotent_operation` | NULL-bypassbar | ✔ | `FASTIGHET-008` (P1) |

### search_path

Samtliga applikationsfunktioner utom en har låst `search_path`
(`public, extensions`, `public, pg_temp` eller `public, auth, pg_temp`).
Undantag: `set_updated_at` (`proconfig = (none)`, `FASTIGHET-015`).
`rls_auto_enable` använder korrekt `search_path=pg_catalog`.

## Storage-policies

```sql
-- Privat läsning: organisation + person i path, eller documents:read
private_storage_owner_or_staff_read  SELECT {authenticated}
USING (bucket_id = ANY (ARRAY['application-documents','contract-drafts',
         'signed-contracts','tenant-documents','maintenance-files',
         'inspection-files','invoice-files','exports'])
   AND (storage.foldername(name))[1] = current_app_organization_id()
   AND ((storage.foldername(name))[2] = current_app_person_id()
        OR app_has_permission('documents:read')))

-- Annonsmedia: personal skriver inom sin organisation
listing_media_staff_insert / _update / _delete   {authenticated}
CHECK (bucket_id = 'listing-media'
   AND (storage.foldername(name))[1] = current_app_organization_id()
   AND app_has_permission('listings:update'))

-- Annonsmedia: publik läsning
public_listing_media_read  SELECT {anon,authenticated}
USING (bucket_id = 'listing-media')
```

**Bra:** path är organisations- och personbunden, inte klientstyrd.
**Lucka:** `property-media` (publik, live) omfattas inte av någon policy
(`FASTIGHET-006`). Inga INSERT-policies för privata buckets → uppladdning sker
uteslutande via service-role, vilket är konsekvent med koden.

## RBAC-matris: UI vs server vs databas

| Kontroll | UI (nav) | Sidgrind | Server action | RLS | RPC |
| --- | --- | --- | --- | --- | --- |
| Fastigheter läsa | `AdminNav permissions` | `hasPermission("properties","read")` | – | `staff_read_properties` | – |
| Fastighet skapa | dold knapp | – | `requirePermission("properties","create")` | ingen INSERT-policy | service-role |
| Felanmälan skapa (hyresgäst) | formulär | `getCurrentUser()` | validerar objekt mot hyresförhållande | ingen INSERT-policy | `create_maintenance_request` (service-role-låst) |
| Felanmälan status | dold knapp | – | `requirePermission("maintenance","update")` | – | `change_maintenance_status` (service-role-låst) |
| Revisionslogg läsa | nav-post | `hasPermission("audit","read")` | – | `audit_authorized_read` | – |
| Revisionslogg skriva | – | – | – | ingen INSERT-policy | **`write_audit_event` öppen för `anon`** |
| API-nycklar | nav-post | `hasPermission("apikeys",...)` | `requirePermission("apikeys","create"/"delete")` | ingen policy (deny) | – |

Raden för revisionslogg-skrivning är avvikelsen: alla lager utom RPC:n är
korrekt låsta.

## Verifierade rollegenskaper

| Krav | Utfall | Evidens |
| --- | --- | --- |
| Konsekventa rollnamn | ✔ | `src/lib/role-routing.ts` + `verify:consistency` (27 kontroller) |
| En auktoritativ rollkälla | ✔ | `current_user_context()` |
| Klienten kan inte välja roll | ✔ | roller läses ur DB per request, aldrig ur request body |
| Roll ur request body litas aldrig på | ✔ | inga rollfält i server actions |
| Superadmin ej implicit organisationsmedlem | ✔ | `User.organizationId` krävs även för superadmin |
| Inaktiv användare tappar åtkomst | ✔ | `isActive = true` i `current_app_*`-funktionerna och `app_has_permission` |
| Gammal JWT ger inte kvarstående åtkomst | ✔ | roller cachas inte i JWT; `force-dynamic` på alla portaler |
| Service-role exponeras aldrig i klienten | ✔ | `import "server-only"` + lint-guard |
| Server actions gör samma kontroll som API | ✔ | båda går via permission-lagret |
| RLS aktiverad på alla känsliga tabeller | ✔ | 79/79 |
| Views kringgår inte RLS oavsiktligt | ✘ | 4 SECURITY DEFINER-vyer (`FASTIGHET-010`) |
| `SECURITY DEFINER` används säkert | ✘ | `FASTIGHET-001`, `-002`, `-004`, `-008` |
| `search_path` låst i säkerhetskritiska funktioner | ✔ (1 undantag) | `FASTIGHET-015` |
| Rolleskalering via inbjudan/onboarding omöjlig | ✔ | `claim_invitation` och `provision_staff_user` är service-role-låsta; `create_custom_role` kräver aktiv aktör med `roles:create` och tillåter `*` endast för superadmin |
| Read-only-roll är read-only | ✔ (strukturellt) | `report-viewer` saknar `:create/:update/:delete`; ej runtime-testat |
| Tenant/organisationsadmin kan inte administrera annan organisation | ✔ (strukturellt) | 1 organisation live → ej empiriskt testbart |
