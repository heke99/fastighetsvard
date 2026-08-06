# Remediationplan

> Ingen remediation utfördes i denna audit. Planen är underlag för en
> efterföljande kampanj.

## Ordningsprincip

1. P0 stop-ship
2. Cross-organisation och RLS
3. Autentisering och rolleskalering
4. Dataintegritet och främmande nycklar
5. Felanmälningsflödet
6. Inbjudningar och onboarding
7. Storage och filåtkomst
8. E-post och notifieringar
9. Migrations- och schema drift
10. Databasprestanda
11. Serverprestanda
12. Klientprestanda
13. UI-konsekvens
14. Testtäckning
15. Refaktorering

## Kritiskt beroende

`FASTIGHET-003` (migrationsliggaren) blockerar **säker deployment av allt
annat**. Utan liggare kan `supabase db push` inte köras, och varje fix måste
appliceras manuellt — vilket är exakt den praxis som skapade driften.

**Rekommendation:** kör PR-1 (liggaren) parallellt med PR-2 (P0-fixen), och
applicera PR-2 manuellt en gång om liggaren dröjer. Låt inte P0 vänta på
processarbete.

---

## PR-1 · Återställ migrationsliggaren

| Fält | Värde |
| --- | --- |
| Finding | `FASTIGHET-003` |
| Branch | `fix/migration-ledger-baseline` |
| Avgränsning | Endast liggare och baseline — ingen schemaändring |
| Filer | ny `supabase/migrations/20260807000000_baseline_note.sql` (kommentar), `docs/DEPLOYMENT.md` |
| Ny migration | Nej (endast dokumenterad baseline) |
| Risk | **Medel** — felaktig repair kan leda till att migrationer körs om |
| Beroenden | Kräver staging-databas |
| Tester | `supabase db reset` i staging → diff mot live-schema |
| Rollback | Liggaren kan tömmas igen; inga dataändringar |
| Verifiering | `supabase migration list` visar 36 applicerade; `supabase db diff` mot live ger tom diff |

Arbetsgång:
1. `supabase db reset` i en ren stagingdatabas från repots 36 migrationer.
2. Jämför resultatet mot live med `supabase db diff --linked` (read-only).
3. Åtgärda konstaterade diffar (`property-media`, grants) i PR-2/PR-4.
4. `supabase migration repair --status applied <version>` för samtliga 36.

---

## PR-2 · Lås funktionsrättigheter (P0)

| Fält | Värde |
| --- | --- |
| Findings | **`FASTIGHET-001`** (P0), `FASTIGHET-002`, `FASTIGHET-004`, `FASTIGHET-008` |
| Branch | `fix/revoke-anon-function-grants` |
| Avgränsning | Endast GRANT/REVOKE + två interna guards. Ingen affärslogik |
| Filer | ny `supabase/migrations/20260807010000_lock_function_grants.sql`, `scripts/lint.mjs` |
| Ny migration | **Ja** |
| Risk | **Hög** — en för bred revoke bryter portalflöden som anropar RPC:er med användarens JWT |
| Beroenden | Ingen (kan appliceras manuellt före PR-1) |
| Rollback | Återställ tidigare grants; ingen dataändring |

Innehåll:

```sql
-- 1. Nollställ brett
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;

-- 2. Ge tillbaka selektivt till authenticated (funktioner portalen faktiskt anropar)
GRANT EXECUTE ON FUNCTION public.current_app_user_id()          TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_app_person_id()        TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_app_organization_id()  TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.app_has_permission(text)       TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.current_user_context()         TO authenticated, service_role;
-- ... plus submit_rental_application, accept_rental_offer, decline_rental_offer,
--     withdraw_rental_application, create_viewing_booking, cancel_viewing_booking,
--     toggle_favorite, record_current_login, verify_signing_challenge,
--     current_person_* och current_active_tenancy_summary

-- 3. Endast service_role
GRANT EXECUTE ON FUNCTION public.write_audit_event(text,text,text,text,jsonb,jsonb,text,text,text) TO service_role;
GRANT EXECUTE ON FUNCTION public.enqueue_outbox_event(text,text,text,text,text,jsonb,text)         TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_outbox_jobs(text,integer,integer)                            TO service_role;
GRANT EXECUTE ON FUNCTION public.claim_idempotent_operation(text,text,text,text,text,text,integer)  TO service_role;
-- ... complete_/fail_idempotent_operation, change_*_status, send_rental_offer,
--     create_contract_version, countersign_contract, activate_signed_contract,
--     complete_move_in/out, complete_internal_transfer, complete_unit_listings

-- 4. Täpp NULL-bypassen (FASTIGHET-008)
--    i claim_idempotent_operation: kräv icke-null aktör
```

**Kritisk verifiering före merge.** Lista faktiska anropare per funktion:

```bash
grep -rn '\.rpc("' src/ | sed 's/.*rpc("\([^"]*\)".*/\1/' | sort -u
```

Korsa mot vilken klient som används (`createServerSupabaseClient` = behöver
`authenticated`; `createAdminClient` = behöver bara `service_role`). En funktion
som endast anropas via `createAdminClient()` ska **inte** ha
`authenticated`-grant.

Lint-regel att lägga till i `scripts/lint.mjs`:

```js
// Avvisa REVOKE som bara nämner PUBLIC
if (/REVOKE ALL ON FUNCTION[^;]*FROM PUBLIC\s*;/i.test(migrationSql)) {
  errors.push("REVOKE måste omfatta PUBLIC, anon, authenticated.");
}
```

Regressionstest i `supabase/tests/verify_rls.sql`:

```sql
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.oid::regprocedure AS sig FROM pg_proc p
           JOIN pg_namespace n ON n.oid = p.pronamespace
           WHERE n.nspname='public' AND p.prosecdef
             AND has_function_privilege('anon', p.oid, 'EXECUTE')
  LOOP
    RAISE EXCEPTION 'anon kan exekvera SECURITY DEFINER-funktion: %', r.sig;
  END LOOP;
END $$;
```

Verifieringskriterium: `npm run test:rls` passerar, portalen kan fortfarande
skicka ansökan, acceptera erbjudande och boka visning.

---

## PR-3 · Interna kommentarer i radgränsen

| Fält | Värde |
| --- | --- |
| Finding | `FASTIGHET-022` (P1) |
| Branch | `fix/maintenance-comment-internal-rls` |
| Filer | ny `supabase/migrations/20260807020000_maintenance_comment_visibility.sql` |
| Ny migration | Ja |
| Risk | **Låg** — personalvägen går via service-role och påverkas inte |
| Beroenden | Ingen |
| Tester | `verify_rls.sql`: hyresgästsession + `isInternal = true` → 0 rader; personal ser båda |
| Rollback | Återställ ursprungspolicyn |
| Verifiering | Portalen visar fortsatt externa kommentarer; admin ser alla |

Behåll `.eq("isInternal", false)` i `portal-records.ts:293` som andra lager.

---

## PR-4 · Storage drift och organisationspredikat

| Fält | Värde |
| --- | --- |
| Findings | `FASTIGHET-006` (P1), `FASTIGHET-012` (P2), `FASTIGHET-013` (P2) |
| Branch | `fix/storage-drift-and-org-predicates` |
| Filer | ny migration, `src/lib/repositories/admin-records.ts` |
| Ny migration | Ja — `property-media`-bucket + policies, `PersonRole`-policy |
| Risk | Låg |
| Beroenden | Kräver beslut om `property-media` ska behållas |
| Tester | `verify_rls.sql` + `npm run verify:consistency` |
| Rollback | Droppa policyerna; koden är additiv |
| Verifiering | `storage.buckets` matchar repot; `workOrderRelations` filtrerar på organisation |

Kodändring i `admin-records.ts:150-175`: gör `organizationId` obligatorisk och
lägg `.eq("organizationId", organizationId)` på `MaintenanceRequest`-, `Supplier`-
och `Unit`-frågorna.

---

## PR-5 · Rollklassificering till allow-list

| Fält | Värde |
| --- | --- |
| Finding | `FASTIGHET-007` (P1) |
| Branch | `fix/staff-role-allowlist` |
| Filer | `src/lib/role-routing.ts`, `tests/role-routing.test.ts`, ev. migration för `Role.isStaff` |
| Ny migration | Ja, om `Role.isStaff` införs |
| Risk | **Medel** — för strikt allow-list låser ut befintliga anpassade roller |
| Beroenden | Kräver inventering av faktiska `Role`-rader (live: 13 globala, 0 organisationsspecifika) |
| Tester | `isStaffAccount(["okand-roll"]) === false`; befintliga 6 tester ska fortsatt passera |
| Rollback | Trivial — ren funktionsändring |
| Verifiering | Alla 13 seedade roller routar som förut; okänd slug routar till `/mina-sidor` |

Eftersom live har **noll** organisationsspecifika roller är risken i praktiken
låg just nu — gör ändringen innan sådana roller skapas.

---

## PR-6 · Outbox: konsument eller borttagning

| Fält | Värde |
| --- | --- |
| Finding | `FASTIGHET-005` (P1) |
| Branch | `fix/outbox-consumer` eller `chore/remove-outbox` |
| Filer | ny route/cron + `src/lib/services/`, alternativt migrationer som tar bort anropen |
| Ny migration | Ja i borttagningsalternativet |
| Risk | **Medel** |
| Beroenden | **Måste komma efter PR-2** — annars blir en e-postsändande konsument en öppen relä (`FASTIGHET-002`) |
| Tester | Enhetstest för claim/leverans/backoff; kölängdslarm |
| Rollback | Stäng av cron-posten |
| Verifiering | `OutboxEvent` med status `PENDING` går mot noll |

**Beslut krävs först:** ska outboxen vara den kanoniska kanalen, eller ska
`WebhookDelivery` + direkt e-post vara det? Ha en, inte två. Detta beslut bör
dokumenteras som ADR.

---

## PR-7 · Idempotens för felanmälan

| Fält | Värde |
| --- | --- |
| Finding | Scenario 9 i `VERIFICATION_MATRIX.md` (P2) |
| Branch | `fix/maintenance-idempotency` |
| Filer | ny migration för `create_maintenance_request`, `src/lib/repositories/maintenance-operations.ts`, `src/lib/services/maintenance.ts` |
| Ny migration | Ja — lägg till `p_idempotency_key`, `p_request_hash` |
| Risk | Medel — funktionssignaturen ändras |
| Beroenden | PR-2 (guarden i `claim_idempotent_operation`) |
| Tester | Två identiska inlämningar → ett ärende |
| Rollback | Behåll gammal signatur parallellt under en release |
| Verifiering | `scripts/verify-concurrency-primitives.mjs` utökas |

---

## PR-8 · Filinnehållsvalidering

| Fält | Värde |
| --- | --- |
| Finding | `FASTIGHET-011` (P2) |
| Branch | `fix/upload-magic-byte-validation` |
| Filer | `src/lib/repositories/maintenance-files.ts`, `src/lib/repositories/listing-media.ts`, ny test |
| Ny migration | Nej |
| Risk | Låg |
| Beroenden | Ingen |
| Tester | PNG-`Content-Type` + PDF-magic → avvisas; giltiga filer accepteras |
| Rollback | Trivial |
| Verifiering | `npm run verify:consistency` fortsatt grön |

Lägg samtidigt `Content-Disposition: attachment` på signerade nedladdningar.

---

## PR-9 · Auth-härdning

| Fält | Värde |
| --- | --- |
| Findings | `FASTIGHET-016` (P2), H-15, H-16, H-20 |
| Branch | `fix/auth-hardening` |
| Filer | `supabase/config.toml`, `src/lib/auth.ts`, `src/lib/email.ts` |
| Ny migration | Nej |
| Risk | Låg |
| Beroenden | Kräver åtkomst till Supabase-projektinställningar |
| Tester | 11:e inloggningsförsöket inom fönstret nekas |
| Rollback | Konfigurationsåterställning |

Innehåll: aktivera skydd mot läckta lösenord, applicera `consume_rate_limit` på
inloggning (IP + e-post), blockera `EMAIL_LOG_LINKS` i produktion.

---

## PR-10 · RLS-härdning i djupled

| Fält | Värde |
| --- | --- |
| Findings | `FASTIGHET-009`, `FASTIGHET-010`, `FASTIGHET-015`, `FASTIGHET-018` (alla P2) |
| Branch | `fix/rls-defense-in-depth` |
| Filer | ny migration |
| Ny migration | Ja |
| Risk | **Medel–hög** — `security_invoker` på publika vyer kan tysta den publika katalogen |
| Beroenden | PR-1 |
| Tester | Publik katalog visar fortsatt publicerade annonser för `anon` |
| Rollback | Återställ vyoptioner och grants |

Innehåll:
- `REVOKE ALL ON <28 tabeller> FROM anon, authenticated`
- `ALTER TABLE ... FORCE ROW LEVEL SECURITY` på organisationskänsliga tabeller
- `ALTER VIEW ... SET (security_invoker = true)` + `anon`-policies för publik delmängd
- `ALTER FUNCTION set_updated_at() SET search_path = pg_catalog, public`
- `ALTER EXTENSION btree_gist SET SCHEMA extensions`

Dela gärna i två PR om vyändringen visar sig riskabel.

---

## PR-11 · Databasindex

| Fält | Värde |
| --- | --- |
| Finding | `FASTIGHET-014` (P2) |
| Branch | `perf/foreign-key-indexes` |
| Filer | ny migration |
| Ny migration | Ja — `CREATE INDEX CONCURRENTLY` |
| Risk | Låg (concurrently, tomma tabeller) |
| Beroenden | PR-1 |
| Tester | `EXPLAIN` före/efter i staging med representativ data |
| Rollback | `DROP INDEX` |
| Verifiering | Inga seq scan i RLS-`EXISTS`-subselects |

Prioritera `ContractParty(contractId, personId)` och
`ApplicationMember(applicationId, personId)` — de belastar elva RLS-policies.

---

## PR-12 · Hierarki och pagination

| Fält | Värde |
| --- | --- |
| Findings | `FASTIGHET-017` (P2), pagination (P2) |
| Branch | `fix/unit-hierarchy` respektive `feat/admin-pagination` |
| Risk | Medel — hierarkibeslutet påverkar rapporter och import |
| Beroenden | Kräver produktbeslut om `Building` ska användas |

Dela i två separata PR; de har olika beslutsfattare.

---

## PR-13 · Projektminne och rotstädning

| Fält | Värde |
| --- | --- |
| Findings | `FASTIGHET-019`, `FASTIGHET-020` (P3) |
| Branch | `chore/refresh-project-memory` |
| Filer | `.agent-memory/current-state.md`, `open-blockers.md`, tio rot-`.md`-filer |
| Risk | Ingen |
| Beroenden | Ingen |
| Verifiering | `AGENTS.md`-läsordningen leder till aktuell information |

Uppdatera BLOCKER-0003: npm/typecheck/test/build är **inte** blockerade;
DB/RLS/Storage-sviterna är det fortfarande.

---

## Sammanställning

| PR | Findings | Prioritet | Risk | Blockerad av |
| --- | --- | --- | --- | --- |
| PR-1 liggare | 003 | P1 | Medel | staging |
| **PR-2 grants** | **001**, 002, 004, 008 | **P0** | Hög | – |
| PR-3 interna kommentarer | 022 | P1 | Låg | – |
| PR-4 storage + org-predikat | 006, 012, 013 | P1/P2 | Låg | produktbeslut |
| PR-5 rollallowlist | 007 | P1 | Medel | – |
| PR-6 outbox | 005 | P1 | Medel | **PR-2** + ADR |
| PR-7 idempotens felanmälan | scenario 9 | P2 | Medel | PR-2 |
| PR-8 filvalidering | 011 | P2 | Låg | – |
| PR-9 auth-härdning | 016 | P2 | Låg | projektåtkomst |
| PR-10 RLS djupled | 009, 010, 015, 018 | P2 | Medel–hög | PR-1 |
| PR-11 index | 014 | P2 | Låg | PR-1 |
| PR-12 hierarki/pagination | 017 | P2 | Medel | produktbeslut |
| PR-13 minne/städning | 019, 020 | P3 | Ingen | – |

## Rekommenderad sekvens

**Vecka 1:** PR-2 (manuellt om nödvändigt) → PR-3 → PR-13
**Vecka 2:** PR-1 → PR-5 → PR-4 → PR-8
**Vecka 3:** PR-10 → PR-11 → PR-9
**Vecka 4:** ADR om leveranskanal → PR-6 → PR-7 → PR-12

## Gemensamma verifieringskriterier

Varje PR ska passera hela den befintliga grinden innan merge:

```bash
npm ci && npm run lint && npm run verify:accounts && \
npm run verify:login-dashboard && npm run verify:consistency && \
npm run typecheck && npm run test:unit && npm run build
```

Databasrörande PR ska dessutom passera `npm run db:verify` och
`npm run test:rls` i staging — kontroller som **inte** kunde köras i denna audit.
