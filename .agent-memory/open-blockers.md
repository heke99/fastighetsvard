# Open Blockers

## BLOCKER-0001

Severity: P0  
Status: RESOLVED AND VERIFIED IN SOURCE  
Affected flow: legacy reads and administrative/integration writes  
Resolution: all callers use scoped repositories or atomic PostgreSQL RPC
commands; `src/lib/db.ts`, its generated schema metadata and counter shim were
deleted.  
Evidence: lint guard, 40 passing tests, typecheck and production build.  
Remaining gate: exercise the replacement queries/functions against PostgreSQL.

## BLOCKER-0002

Severity: P0  
Status: RESOLVED IN SOURCE; DATABASE VERIFICATION PENDING  
Affected flow: all customer-facing and legal surfaces  
Resolution: Brand model, FaddeBo configuration/copy, preserved legal identity,
seed/bootstrap and automated assertions were added.  
Remaining gate: execute and verify the forward migration against Supabase.

## BLOCKER-0003

Severity: P1  
Status: PARTIALLY RESOLVED 2026-08-14  
Affected flow: DB/RLS/Storage/concurrency production gate  
Resolved: hela kedjan är applicerad i `dmigdfbvudzexvdnbvrj`, migrationshistoriken
är registrerad, och behörighetsytan är verifierad med negativa körningar mot det
publika API:t (`anon` nekas samtliga administrativa RPC:er och all tabelläsning,
katalogvyerna svarar `200`).  
Remaining: `npm run db:verify` och `npm run test:rls` kräver psql, och äkta
parallellitetstester kräver en separat testdatabas som kan skrivas sönder.

## BLOCKER-0004

Severity: P0  
Status: RESOLVED 2026-08-14  
Affected flow: release traceability and deployment  
Resolution: arbetet sker i den canonical klonen `heke99/fastighetsvard` på
branchen `claude/system-audit-hardening-rl6mgs` med fullständig Git-historik.

## BLOCKER-0005

Severity: P0  
Status: BLOCKED — EXTERNAL AUTH/E-MAIL CONFIGURATION REQUIRED  
Affected flow: registration confirmation, staff activation and password reset  
Problem: Supabase Site URL/redirects, custom SMTP and Resend DNS/API credentials
cannot be proven from source.  
Required resolution: configure the production-like staging environment per
`docs/ACCOUNT_AND_EMAIL_SETUP.md` and execute all account flow checks.  
Acceptance criteria: verified sender identity, successful delivery, valid
callbacks, expired-link handling and correct role-specific dashboard routing.

## BLOCKER-0006

Severity: P0  
Status: BLOCKED — RUNTIME ACCEPTANCE REQUIRED  
Affected flow: exact staff roles, apartment/listing media and fault reports  
Problem: the latest migration, Storage uploads and Resend e-mails have not been
exercised against the target Supabase/Vercel environment.  
Required resolution: apply all 36 migrations, configure Resend, run the current
CI gate and complete the role/listing/fault-report acceptance matrix.  
Acceptance criteria: custom roles route correctly; wildcard protection holds;
media appears on the public listing; a tenant submission appears in both
portals with downloadable private attachments; internal, receipt and status
emails are delivered without duplicate records on provider failure.
