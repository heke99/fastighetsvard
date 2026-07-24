# Fastighetsvärd – leveransrapport för produktionshärdning etapp 1

**Leveransdatum:** 2026-07-24  
**Utgångsprojekt:** `fastighetsvard-main(7).zip`  
**Målbild:** eget HomeQ-flöde för en enda hyresvärd, med organisationsisolering och Supabase-only.

## 1. Samlad bedömning

Projektet var inte produktionssäkert. De allvarligaste felen var dubbla migrationshistoriker, en Prisma-liknande Supabase-adapter med heltabellsläsningar och falsk `$transaction`, vanlig registrering med administrativt verifierad e-post, e-postbaserad automatisk claim av importerade personer, breda Storage- och tabellrättigheter, signering som kunde reduceras till en tidsstämpel, uppsägning som avslutade kontraktet direkt samt check-then-create-idempotens.

Den här leveransen är en konkret första härdningsetapp. Den etablerar en canonical migrationskedja, atomiska PostgreSQL-operationer för de mest riskfyllda flödena, databasskydd mot flera samtidighetsfel, riktig verifieringsbaserad självregistrering, separat account claim, dokumenthashbunden e-post-OTP-signering, append-only audit, striktare RLS/Storage, databasbaserad rate limiting, säkerhetsheaders och reproducerbar CI.

**Leveransen är inte hela masterplanen och ska inte användas med skarpa personuppgifter eller juridiskt bindande avtal innan blockerarna i avsnitt 10 är stängda.**

## 2. Genomförda ändringar

### Databas och samtidighet

- Tog bort den monolitiska initialmigrationen och fyra överlappande repair-migrationer.
- Behöll en linjär kedja med 15 migrationer.
- Lade till tabeller för immutable ansökningssnapshot, reservationer, signeringssessioner, signaturbevis, evidence report, in-/avflyttningsärenden, transactional outbox, atomisk idempotens, signeringsutmaningar och distribuerad rate limiting.
- Lade till partiella unika index för aktiv ansökan och aktiv reservation.
- Lade till exclusion constraint mot överlappande bindande kontraktsperioder.
- Lade till row locks, villkorade statusövergångar, optimistic locking, workerclaim med `FOR UPDATE SKIP LOCKED` och request-hashbaserad idempotens.
- Lade till read-only preflight-rapport för befintlig data och schema-/RLS-verifiering.

### Kritiska domänoperationer

Följande operationer finns nu som PostgreSQL-RPC:er och används i de omkopplade portalflödena:

- `submit_rental_application`
- `withdraw_rental_application`
- `create_viewing_booking`
- `cancel_viewing_booking`
- `send_rental_offer`
- `accept_rental_offer`
- `decline_rental_offer`
- `create_contract_version`
- `create_signing_session`
- `record_contract_signature`
- `countersign_contract`
- `activate_signed_contract`
- `request_contract_termination`
- `confirm_contract_termination`
- `cancel_contract_termination`
- `complete_internal_transfer`
- `complete_move_in`
- `complete_move_out`
- `claim_outbox_jobs`
- `claim_idempotent_operation`
- `complete_idempotent_operation`
- `fail_idempotent_operation`
- `create_signing_challenge`
- `verify_signing_challenge`
- `claim_invitation`
- `consume_rate_limit`

### Auth och account claim

- Självregistrering använder nu `auth.signUp` och väntar på riktig Supabase-verifiering.
- Appens person-/användarprofil provisioneras först när `email_confirmed_at` finns.
- Självregistrering skapar alltid en ny sökande och kan inte claima en importerad hyresgäst via e-postmatchning.
- Importerad person claimas separat med tokenhash, person-, organisation- och e-postbindning, expiry, single-use, låsning och audit.
- Personal- och känsliga workerfunktioner har inte browser-grants.

### Signering och kontrakt

- Portalens gamla enkla signering är ersatt med kortlivad sexsiffrig e-post-OTP.
- Koden HMAC-hashas med `SIGNING_OTP_PEPPER`.
- Signaturen binds till person, Auth-identitet, signeringssession, exakt avtalsversion och dokumenthash samt IP/user-agent där de tillhandahålls.
- Signeringsförsök, expiry, replay och lockout hanteras i databasen.
- Kontraktsaktivering kräver obligatoriska signaturer, countersign, dokumenthash, slutdokument och giltig reservation.
- Uppsägning lämnar kontraktet aktivt under uppsägningstiden.
- Internflytt avslutar inte det gamla avtalet vid erbjudandeacceptans.

### RLS, grants, Storage och audit

- RLS är aktiverat på applikationstabellerna.
- Canonical policies begränsar portaldata till egen person/part eller explicit permission.
- Legacy-grants återkallas innan minimala browser-grants läggs tillbaka.
- Endast `listing-media` är publikt.
- Privata Storage-läsningar kräver organisations- och personbunden path eller dokumentpermission.
- Audit är append-only genom trigger och saknar update/delete-grants.
- Idempotens- och outboxtabeller är inte browserläsbara.

### Webb, drift och CI

- Lade till CSP, HSTS i produktion, frame-skydd, MIME-skydd, referrer policy och permissions policy.
- Lade till central brandinggrund för företagsnamn, kontaktdata, logotypmetadata och sidmetadata.
- Synkroniserade Node `22.16.0` och npm `10.9.2` i `package.json`, lockfile, `.nvmrc`, `.node-version` och CI.
- CI kör lint, typecheck, unit/static concurrency, build, Supabase reset, schema/RLS, E2E, dependency audit, dependency review och secret scan.
- Intern webhookprocessning accepterar inte längre oskyddad GET.

## 3. Canonical migrationer i exakt ordning

| Ordning | Migration | Syfte och skapade objekt | Backfill/uppgradering | Risk / breaking | Verifiering |
|---:|---|---|---|---|---|
| 1 | `20260720000100_extensions_and_enums.sql` | Extensions och 28 canonical enums. | Ingen dataändring. Legacy-monolit: markeras applicerad, körs inte igen. | Breaking om enumdefinitioner avviker i befintlig DB. | `db reset`, enumkontroll i statisk lint. |
| 2 | `20260720000200_tables_identity_properties.sql` | Organisation, identitet, RBAC, fastighet, byggnad, enhet, annons och media. | Ingen automatisk dataradering. Legacy-monolit: markeras applicerad. | Breaking vid schemaavvikelse. | `verify_schema.sql`, preflight. |
| 3 | `20260720000300_tables_applications_contracts.sql` | Ansökan, visning, erbjudande, kontrakt, uppsägning och besiktning. | Legacy-monolit: markeras applicerad. | Breaking vid schemaavvikelse. | `verify_schema.sql`, preflight. |
| 4 | `20260720000400_tables_billing_integrations.sql` | Fakturering, betalningar, externa referenser och integrationstabeller. | Legacy-monolit: markeras applicerad. | Breaking vid schemaavvikelse. | `verify_schema.sql`. |
| 5 | `20260720000500_tables_maintenance_platform.sql` | Underhåll, arbetsorder, dokument, meddelanden, API/webhooks, audit och räknare. | Legacy-monolit: markeras applicerad. | Breaking vid schemaavvikelse. | `verify_schema.sql`. |
| 6 | `20260720001000_indexes.sql` | Canonical index och unikhetsregler för grundschemat. | Legacy-monolit: markeras applicerad när index redan finns. | Kan blockeras av befintliga dubbletter. | preflight och `verify_schema.sql`. |
| 7 | `20260720001100_foreign_keys_core.sql` | Foreign keys för kärndomäner. | Legacy-monolit: markeras applicerad när constraints redan finns. | Kan blockeras av orphan rows. | schema- och preflightkontroll. |
| 8 | `20260720001200_foreign_keys_platform.sql` | Foreign keys för ekonomi, integration, underhåll och plattform. | Legacy-monolit: markeras applicerad när constraints redan finns. | Kan blockeras av orphan rows. | schema- och preflightkontroll. |
| 9 | `20260720001300_auth_functions_triggers.sql` | Auth-länk, `updatedAt`-triggers, actor-/permissionhelpers. | Ska köras även mot legacy-monolit för att uppdatera helpers. | Låg; ersätter funktioner/triggers kontrollerat. | funktions- och triggerkontroll. |
| 10 | `20260720001400_rls_policies.sql` | Default-deny RLS, säkert publikt read model och portal-/staffpolicies. | Ska köras mot legacy för att ersätta gamla publika policies. | Säkerhetsmässigt breaking: tidigare bred åtkomst stoppas. | `verify_rls.sql`. |
| 11 | `20260720001500_storage_and_grants.sql` | Nio buckets, publik annonsmedia, återkallade legacy-grants och minsta browser-grants. | Ska köras mot legacy; upsertar buckets och återkallar breda grants. | Breaking för klientkod som skrev direkt till tabeller/privata buckets. | Storage- och grantkontroll. |
| 12 | `20260724010000_core_domain_hardening.sql` | Versioner, snapshots, reservationer, signerings-/evidence-/move-tabeller, outbox, idempotens, constraints, RPC:er och audit helpers. | Preflight krävs; ingen automatisk konfliktlösning. | Hög om aktiva dubbletter/kontraktsöverlapp finns. | preflight, schema, RPC, constraints och riktiga concurrencytester. |
| 13 | `20260724015000_verified_email_otp_signing.sql` | `SigningChallenge`, OTP-claim/verify och signeringslockout. | Ingen historisk signatur backfill. | Befintlig fake-signering blir inte automatiskt juridiskt giltig. | schema, RPC och integrationstest. |
| 14 | `20260724020000_auth_rls_storage_hardening.sql` | Verifierad signuptrigger, invitation claim, personnummer-skyddsfält, append-only audit, nya RLS/Storagepolicies och grants. | Klartext-personnummer rapporteras men krypteras inte automatiskt. | Säkerhetsmässigt breaking för bred legacyåtkomst. | schema, RLS, grant och audit verifiering. |
| 15 | `20260724025000_distributed_rate_limiting.sql` | `RateLimitBucket` och atomisk `consume_rate_limit`. | Ingen backfill. | In-memory-limiters ersätts i omkopplade auth/API-flöden. | funktionskontroll och integrationstest. |

## 4. Befintlig databas – säker migrationsreconciliation

Kör inte foundation-migrationerna ovanpå en databas som redan skapats av den borttagna monoliten. Följ `SPLIT_MIGRATIONS.md`:

1. Backup/PITR-snapshot.
2. `supabase migration list`.
3. Kör read-only preflight.
4. Markera endast faktiskt registrerade legacy-versioner som `reverted`.
5. Markera foundation `00100`–`01200` som `applied` när objekten redan finns.
6. Låt `01300`, `01400`, `01500` och alla `20260724...` köras via `db push`.
7. Kör schema/RLS-verifiering efteråt.

`migration repair` ändrar migrationshistoriken, inte den faktiska databasen. Felaktig användning kan därför få historiken att ljuga om schemat.

## 5. Faktisk verifiering i denna arbetsmiljö

| Kontroll | Resultat | Faktiskt utfall |
|---|---|---|
| Node | Kördes | `v22.16.0` |
| npm | Kördes | `10.9.2` |
| `node scripts/lint.mjs` | **Godkänd med blockerande varning** | 15 canonical migrationer, inga duplicerade typ-/tabell-/index-/policyskapanden i aktiv kedja. Varning: legacy-adaptern finns kvar. |
| `node scripts/verify-concurrency-primitives.mjs` | **Godkänd statisk kontroll** | Nödvändiga SQL-primitiver/RPC-markörer hittades. Detta är inte ett verkligt parallelltest. |
| TypeScript syntax-transpilering | **Godkänd** | 160 `.ts/.tsx`-filer kunde syntaxtranspileras. |
| Funktions-/grant-signaturkontroll | **Godkänd statisk kontroll** | 38 funktioner, 34 function grants, 0 signaturmismatchar. |
| `npm ci` | **Inte godkänd** | Fastnade utan output i denna container och fick avslutas. En ofullständig `node_modules` skapades och togs bort före paketering. |
| `tsc --noEmit` | **Inte giltigt/grönt** | Exit 2 på grund av ofullständig dependencyinstallation; saknade typer för bland annat `node`, `react`, `react-dom`, `chai`, `deep-eql` och `estree`. |
| Supabase reset | **Inte körd** | `supabase`, Docker och `psql` saknas i arbetsmiljön. |
| Schema/RLS SQL | **Inte körd mot DB** | Verifieringsfiler skapade, men ingen PostgreSQL-miljö fanns. |
| Unit/integration/Vitest | **Inte körda** | Dependencyinstallationen blev inte komplett. |
| Riktiga concurrencytester | **Inte körda** | Ingen lokal Supabase/PostgreSQL. |
| Production build | **Inte körd** | Dependencyinstallationen blev inte komplett. |
| E2E | **Inte körd** | Ingen byggbar app/local Supabase i denna miljö. |
| GitHub Actions | **Inte körd** | Workflow är skapad men måste köras i repositoryt. |

Inga gröna resultat har antagits för blockerade tester.

## 6. Databasverifiering som levereras

- `supabase/tests/verify_schema.sql`: extensions, tabeller, funktioner, RLS-status, buckets och kritiska constraints/index.
- `supabase/tests/verify_rls.sql`: breda policies, legacy Storagepolicies, privata pathpolicies, förbjudna browser-write-grants och append-only audittrigger.
- `supabase/manual/20260724_preflight_backfill_report.sql`: dubbla aktiva ansökningar, flera accepterade erbjudanden, kontraktsöverlapp, klartext-personnummer och privata filer utan dokumentpost.
- `scripts/lint.mjs`: statisk migrations-, auth-, Storage-, RPC- och versionskontroll.
- `scripts/verify-concurrency-primitives.mjs`: statisk kontroll av lås-, uniqueness-, exclusion-, idempotens- och workerclaim-primitiver.

## 7. Miljövariabler

`.env.example` är uppdelad för:

- Supabase och databas;
- app-URL och cron;
- Auth, verifiering och trusted proxy;
- Storage och filkontroll;
- e-post, SMS och push;
- e-signering och OTP-pepper;
- kryptering och personnummernyckelversion;
- ekonomi/providerintegration;
- webhooks;
- rate limiting/Redis;
- observability;
- branding och juridiska länkar.

Inga riktiga hemligheter ingår.

## 8. Exakta terminalkommandon

### Lokal installation och full releasegrind

```bash
nvm install 22.16.0
nvm use 22.16.0
npm install --global npm@10.9.2
npm ci
cp .env.example .env.local
supabase start
npm run db:reset
npm run db:verify
npm run test:rls
npm run lint
npm run typecheck
npm run test:unit
npm run test:integration
npm run test:concurrency
npm run build
npm run start
npm run test:e2e
```

### Länka och pusha Supabase

```bash
supabase login
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase migration list
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -f supabase/manual/20260724_preflight_backfill_report.sql
supabase db push --dry-run
supabase db push
npm run db:verify
npm run test:rls
```

För en legacy-monolit ska kommandona i `SPLIT_MIGRATIONS.md` köras före `db push`.

### Vercel

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
npx vercel env add SUPABASE_SECRET_KEY production
npx vercel env add APP_ENCRYPTION_KEY production
npx vercel env add SIGNING_OTP_PEPPER production
npx vercel env add CRON_SECRET production
npx vercel deploy --prod
```

### Synka den levererade zippen med rsync

```bash
cd ~/Downloads
unzip -q fastighetsvard-production-hardening-phase1.zip

TARGET_DIR="/absolut/sökväg/till/ditt/fastighetsvard-projekt"
rsync -av --delete \
  --exclude='.git/' \
  --exclude='.env' \
  --exclude='.env.local' \
  --exclude='node_modules/' \
  --exclude='.next/' \
  ~/Downloads/fastighetsvard-production-hardening-phase1/ \
  "$TARGET_DIR/"
```

Kontrollera alltid `TARGET_DIR` före kommandot eftersom `--delete` tar bort filer som inte finns i leveransen.

## 9. Fullständig fillista och syfte

### Tillagda filer

| Fil | Syfte |
|---|---|
| `.github/workflows/ci.yml` | Reproducerbar lint/typecheck/test/build/DB/E2E- och säkerhetsgrind. |
| `.node-version` | Låser Node 22.16.0 för verktyg och CI. |
| `.nvmrc` | Låser Node 22.16.0 för nvm. |
| `DELIVERY_REPORT.md` | Denna verifierbara leverans- och begränsningsrapport. |
| `docs/DATABASE_RLS_STORAGE.md` | Dokumenterar databas-, RLS- och Storage-modellen. |
| `docs/DEPLOYMENT.md` | Lokal installation, Supabase-push och Vercel-deployment. |
| `docs/OPERATIONS_AND_INCIDENTS.md` | Backup-, återställnings- och incidentgrund. |
| `docs/PRODUCTION_HARDENING_PHASE1.md` | Avgränsning, genomfört och kända blockerare. |
| `docs/TEST_AND_RELEASE_GATE.md` | Obligatorisk releasegrind och faktiska lokala testresultat. |
| `scripts/e2e-smoke.mjs` | Minimal HTTP-smoke för publika kärnroutes. |
| `scripts/lint.mjs` | Statisk verifiering av canonical migrationer och säkerhetskrav. |
| `scripts/verify-concurrency-primitives.mjs` | Statisk kontroll av databasens concurrencyprimitiver. |
| `src/lib/branding.ts` | Central server-side brandingkonfiguration. |
| `src/lib/http-client-ip.ts` | Trusted-proxy-baserad klient-IP-resolver. |
| `src/lib/repositories/rental-operations.ts` | Domänspecifik RPC-repository för kritiska uthyrningsflöden. |
| `supabase/manual/20260724_preflight_backfill_report.sql` | Read-only konflikt- och backfillrapport för befintlig DB. |
| `supabase/migrations/20260724010000_core_domain_hardening.sql` | Kärntabeller, constraints, audit/outbox/idempotens och atomiska RPC:er. |
| `supabase/migrations/20260724015000_verified_email_otp_signing.sql` | OTP-signering bunden till dokumenthash. |
| `supabase/migrations/20260724020000_auth_rls_storage_hardening.sql` | Verifierad signup, claim, personskydd, append-only audit och nya policies. |
| `supabase/migrations/20260724025000_distributed_rate_limiting.sql` | Databasbaserad distribuerad rate limiting. |
| `supabase/tests/verify_rls.sql` | RLS-, grant-, Storage- och auditverifiering. |
| `supabase/tests/verify_schema.sql` | Schema-, funktions-, bucket- och constraintverifiering. |
| `tests/production-hardening.test.ts` | Regressionstester för härdningskrav i kod/migrationer. |

### Ändrade filer

| Fil | Syfte |
|---|---|
| `.env.example` | Komplett kategoriserad miljökonfiguration utan hemligheter. |
| `CHANGED_FILES.md` | Pekar på denna fullständiga fillista och uppdaterade antal. |
| `DELETE_FILES.txt` | Dokumenterar borttagna duplicerade migrationer. |
| `README.md` | Ärlig nuläges-, installations- och arkitekturöversikt. |
| `SPLIT_MIGRATIONS.md` | Canonical kedja och kontrollerad legacy-reconciliation. |
| `next.config.ts` | Säkerhetsheaders och CSP-baslinje. |
| `package-lock.json` | Synkroniserar Node engine med projektet. |
| `package.json` | Node/npm-versioner och scripts för full releasegrind. |
| `src/app/(portal)/mina-sidor/ansokningar/OfferResponseForm.tsx` | Idempotensnycklar och säkrare erbjudandesvar. |
| `src/app/(portal)/mina-sidor/ansokningar/actions.ts` | Kopplar erbjudandesvar till atomiska RPC:er. |
| `src/app/(portal)/mina-sidor/ansokningar/page.tsx` | Servergenererade idempotensnycklar och uppdaterad portaldata. |
| `src/app/(portal)/mina-sidor/avtal/[id]/actions.ts` | OTP-signering och korrekt uppsägnings-RPC. |
| `src/app/(portal)/mina-sidor/avtal/[id]/forms.tsx` | Tvåstegs-OTP och tydlig uppsägningsbekräftelse. |
| `src/app/(portal)/mina-sidor/avtal/[id]/page.tsx` | Signerings-/uppsägningsstatus och idempotensdata. |
| `src/app/(public)/annons/[slug]/ansok/ApplicationForm.tsx` | Idempotent ansökningssubmit. |
| `src/app/(public)/annons/[slug]/ansok/actions.ts` | Flyttar submit till atomic snapshot-RPC. |
| `src/app/(public)/annons/[slug]/ansok/page.tsx` | Servergenererad idempotensnyckel. |
| `src/app/(public)/auth-actions.ts` | Registrering väntar på verifieringsmejl. |
| `src/app/(public)/logga-in/page.tsx` | Visar verifieringsstatus utan falsk autoaktivering. |
| `src/app/api/internal/webhooks/process/route.ts` | Tar bort muterande GET och kräver skyddad POST. |
| `src/app/layout.tsx` | Brandingbaserad metadata och borttagen global force-dynamic. |
| `src/components/Logo.tsx` | Brandingbaserad logotyp/text. |
| `src/components/SiteFooter.tsx` | Brandingbaserad kontakt- och juridiktext. |
| `src/lib/api/auth.ts` | Databasrate-limit och trusted client IP. |
| `src/lib/api/helpers.ts` | Atomisk PostgreSQL-idempotens för API-routes. |
| `src/lib/auth.ts` | Trusted-proxy-IP och säkrare auth rate limiting. |
| `src/lib/email.ts` | Branding och OTP-/inbjudningsmejl. |
| `src/lib/services/accounts.ts` | Riktig verifierad självregistrering och separat claim. |
| `src/lib/services/applications.ts` | Kritiska ansöknings-/erbjudandeflöden via RPC. |
| `src/lib/services/contracts.ts` | OTP, dokumenthashbunden signering och korrekt uppsägning. |
| `supabase/migrations/20260720000100_extensions_and_enums.sql` | Gör enumkedjan canonical och deterministisk för tom DB. |
| `supabase/migrations/20260720000200_tables_identity_properties.sql` | Tar bort dolda duplicate guards från canonical install. |
| `supabase/migrations/20260720000300_tables_applications_contracts.sql` | Tar bort dolda duplicate guards från canonical install. |
| `supabase/migrations/20260720000400_tables_billing_integrations.sql` | Tar bort dolda duplicate guards från canonical install. |
| `supabase/migrations/20260720000500_tables_maintenance_platform.sql` | Tar bort dolda duplicate guards från canonical install. |
| `supabase/migrations/20260720001000_indexes.sql` | Canonical indexskapande och deterministisk reset. |
| `supabase/migrations/20260720001300_auth_functions_triggers.sql` | Actor-, user- och permissionhelpers för RLS/RPC. |
| `supabase/migrations/20260720001400_rls_policies.sql` | Ersätter breda legacy policies med owner/party/permission-RLS. |
| `supabase/migrations/20260720001500_storage_and_grants.sql` | Nya buckets, privat Storage och återkallade blanket grants. |
| `tests/supabase-schema.test.ts` | Uppdaterad canonical migration- och schemaförväntan. |

### Borttagna filer

| Fil | Orsak |
|---|---|
| `supabase/migrations/20260719192014_initial.sql` | Monolitisk kopia av samma schema; orsakade `type/relation already exists`. |
| `supabase/migrations/20260720000600_repair_identity_properties.sql` | Överlappade canonical identitets-/fastighetsmigrationer. |
| `supabase/migrations/20260720000700_repair_applications_contracts.sql` | Överlappade canonical ansöknings-/kontraktsmigrationer. |
| `supabase/migrations/20260720000800_repair_billing_integrations.sql` | Överlappade canonical ekonomi-/integrationsmigrationer. |
| `supabase/migrations/20260720000900_repair_maintenance_platform.sql` | Överlappade canonical underhålls-/plattformsmigrationer. |

## 10. Kvarvarande begränsningar och blockerare

### Produktionsblockerande

1. `src/lib/db.ts` och många äldre admin/read-flöden använder fortfarande den generiska Prisma-liknande adaptern, `select("*")`, Node-filtrering/sortering och falsk `$transaction`.
2. En riktig `supabase db reset`, SQL-verifiering, RLS-test, parallelltest, build och E2E måste bli gröna i CI/lokal Docker innan deployment.
3. Fullständiga personnummer finns fortfarande i legacy-kolumnen. Skyddsfält finns, men krypterad backfill, dual-write, nyckelrotation och borttagning av klartext återstår.
4. E-post-OTP är en verifierbar förbättring men är inte samma sak som BankID eller en full certifikatbaserad e-signeringsprovider. Slut-PDF-generering och providerbevis återstår.
5. Full dokumentdomän med serverstyrd upload, MIME-magic, SHA-256, viruskontroll, signed URL-downloadroute, versionslås och retention är inte komplett.
6. Samtliga legacy-RLS skrivoperationer och alla service-role-användningar är inte fullständigt migrerade/testade.
7. Legacy-databasens faktiska migrationshistorik måste verifieras innan `migration repair`; kommandona får inte köras blint.

### Viktiga

- E-postleverans ska flyttas från synkron request till transactional outbox-worker.
- Full SSRF-validering, DNS-rebinding-skydd och asynkron incoming webhookprocessor återstår.
- Ekonomiprovider/OAuth/sync cursor/conflict review är inte produktionsklar.
- Full versionerad kravmotor, ranking, fyrögonsprincip och förklarbara beslut återstår.
- Visningsväntelista, self-viewing provider, kalender och verkliga påminnelseworkers återstår.
- Full in-/avflyttning, besiktning, nyckelkvittens, skadekostnad och slutavräkning återstår.
- Entreprenörsportal och strikt arbetsorderdata-minimering återstår.
- CSP använder fortfarande `'unsafe-inline'`; nonce-/hashbaserad Next.js-policy återstår.
- Full WCAG 2.2 AA-, SEO-, sitemap-, karta-, bevaknings- och favoritgenomgång återstår.
- Branding är grundlagd men alla hårdkodade strängar är inte eliminerade.

### Feature flags / integrationer

Ingen extern e-signerings-, SMS-, push-, ekonomisk eller viruskontrollintegration markeras som fungerande enbart genom denna etapp. Sådana integrationer ska hållas avstängda tills credentials, providerimplementation och integrationstest är verifierade.

## 11. Definition of done för nästa grind

Etapp 1 får gå vidare först när följande har körts med faktiska gröna resultat:

```bash
npm ci
npm run lint
npm run typecheck
npm run test:unit
supabase start
npm run db:reset
npm run db:verify
npm run test:rls
npm run test:concurrency
npm run build
npm run test:e2e
```

Därefter ska migrationen av `src/lib/db.ts` göras domän för domän tills inga kritiska eller privata flöden längre använder emulatorn.
