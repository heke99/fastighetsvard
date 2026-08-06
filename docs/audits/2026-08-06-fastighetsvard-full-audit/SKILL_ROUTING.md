# Skill-routing

Projektet har 36 låsta skills i `.agents/skills` (`skills-lock.json`,
`.agents/SKILLS_LOCK.sha256`). Tabellen anger hur varje metod faktiskt användes.
En skill markeras `ACTIVATED` endast om dess metod tillämpats och genererat
observationer i rapporten.

| Skill | Status | Hur den användes / varför inte |
| --- | --- | --- |
| `acquire-codebase-knowledge` | **ACTIVATED** | Kartläggning av 242 filer, systemkarta och katalogansvar → `SYSTEM_INVENTORY.md` |
| `supabase` | **ACTIVATED** | Live-introspektion via MCP: `pg_policies`, `pg_proc.proacl`, `storage.buckets`, advisors → `FASTIGHET-001/002/004/006/009/010` |
| `supabase-postgres-best-practices` | **ACTIVATED** | RLS-mönster, `SECURITY DEFINER`, `search_path`, `FORCE RLS`, default privileges → `FASTIGHET-004/009/015` |
| `security-and-hardening` | **ACTIVATED** | Grant-analys, auktoriseringskedjan, filuppladdning → `FASTIGHET-001/002/011` |
| `security-threat-model` | **ACTIVATED** | Hotmodell per angreppsväg → `SECURITY_THREAT_MODEL.md` |
| `threat-model-analyst` | **ACTIVATED** | STRIDE-A-strukturen bakom hotmodellens kolumner (tillgång, angripare, väg, skydd, konsekvens) |
| `auth-implementation-patterns` | **ACTIVATED** | Sessionshantering, rollkälla, JWT-frånvaro, callback/redirect → `AUTH_AND_INVITATION_REVIEW.md` |
| `sql-optimization-patterns` | **ACTIVATED** | FK-index-analys via `pg_constraint`/`pg_index`, RLS-subselect-kostnad → `FASTIGHET-014` |
| `performance-optimization` | **ACTIVATED** | Klient-/server-/databasnivå → `PERFORMANCE_REVIEW.md` |
| `code-review-and-quality` | **ACTIVATED** | Flerdimensionell granskning av repositories, services, actions |
| `find-bugs` | **ACTIVATED** | NULL-jämförelsedefekten i idempotensguarden → `FASTIGHET-008`; död outbox → `FASTIGHET-005` |
| `api-and-interface-design` | **ACTIVATED** | Kontraktskonsekvens API v1 ↔ server actions ↔ RPC |
| `api-design-principles` | **ACTIVATED** | Felkoder, statuskoder, scope-modell i `src/lib/api/auth.ts` |
| `nextjs-app-router-patterns` | **ACTIVATED** | Server components, `force-dynamic`, layout-grindar, server actions |
| `vercel-react-best-practices` | **ACTIVATED** | Client/server-komponentgräns, bundlestorlek (102 kB delad) |
| `error-handling-patterns` | **ACTIVATED** | Post-commit-sidoeffekter, `Promise.allSettled`, `AuthError`/`ApiError` |
| `test-driven-development` | **ACTIVATED** | Bedömning av 50 befintliga tester och föreslagna regressionstester per finding |
| `e2e-testing-patterns` | **CONDITIONALLY ACTIVATED** | `scripts/e2e-smoke.mjs` inventerades; ingen browserdriven svit finns och ingen kunde köras utan miljö |
| `ci-cd-and-automation` | **ACTIVATED** | `npm run ci`-kedjan kördes och utvärderades → `FASTIGHET-019` |
| `deployment-pipeline-design` | **CONDITIONALLY ACTIVATED** | `vercel.json` och cron granskades; Vercel-projektkonfiguration ej åtkomlig |
| `secrets-management` | **ACTIVATED** | Service-role-nyckelns inneslutning, `.env.example`, `import "server-only"`, lint-guard |
| `sast-configuration` | **CONDITIONALLY ACTIVATED** | `scripts/lint.mjs` fungerar som projektets SAST; ingen extern skanner konfigurerad |
| `skill-scanner` | **NOT APPLICABLE** | Auditen granskar en applikation, inte agent-skills |
| `observability-and-instrumentation` | **ACTIVATED** | Konstaterad avsaknad av metrics/tracing; kölängd omätt → bidrar till `FASTIGHET-005` |
| `documentation-and-adrs` | **ACTIVATED** | Jämförelse kod ↔ `.agent-memory` ↔ `docs/` → `FASTIGHET-019/020` |
| `debugging-and-error-recovery` | **ACTIVATED** | Rotorsaksspårning från live-ACL till migrationsrad → `FASTIGHET-004` |
| `doubt-driven-development` | **ACTIVATED** | Varje hypotes kontrollerades mot både repo och live innan klassning; ledde till att flera misstänkta fynd nedgraderades (se nedan) |
| `refactor` | **CONDITIONALLY ACTIVATED** | Uppdelningsanalys utlöstes inte — ingen fil >2 000 rader (`FASTIGHET-021`) |
| `code-simplifier` | **NOT APPLICABLE** | Ändringsförbud gäller; ingen kod fick röras |
| `incremental-implementation` | **NOT APPLICABLE** | Ingen implementation i denna fas |
| `source-driven-development` | **CONDITIONALLY ACTIVATED** | Supabase default privileges verifierades mot faktiskt `proacl` i stället för mot dokumentation |
| `openapi-spec-generation` | **CONDITIONALLY ACTIVATED** | `/api/v1/openapi` inventerades som endpoint; specen genererades inte |
| `nodejs-backend-patterns` | **NOT APPLICABLE** | Ingen Express/Fastify-tjänst; allt är Next.js route handlers |
| `quality-playbook` | **NOT APPLICABLE** | Skulle kräva generering av nya tester, vilket ändringsförbudet utesluter |
| `web-design-guidelines` | **CONDITIONALLY ACTIVATED** | Statisk granskning av aria/labels/roller i portalerna; ingen renderad kontrast- eller skärmläsarmätning |
| `dataviz` | **NOT APPLICABLE** | Rapporten innehåller inga diagram utöver textbaserad systemkarta |

**Summering:** 24 `ACTIVATED`, 7 `CONDITIONALLY ACTIVATED`, 5 `NOT APPLICABLE`.

## Vad `doubt-driven-development` förändrade

Metoden var avgörande för rapportens tillförlitlighet. Fyra hypoteser som såg ut
som allvarliga fynd avfärdades eller nedgraderades efter kontroll:

1. **"Admin-sidor saknar auktorisering."** En första sökning efter
   `requirePermission|requireStaff|requireUser` gav noll träffar i
   `src/app/admin/*/page.tsx`. Kontroll av filinnehållet visade att sidorna
   använder `getCurrentUser()` + `hasPermission()` + `redirect()`. **Inget fynd.**

2. **"Tabeller med grants till `anon` är exponerade."** `PasswordResetToken` och
   `Session` har `SELECT/INSERT/UPDATE/DELETE` för `authenticated` och `SELECT`
   för `anon`. Kontroll av `relrowsecurity` + policyantal visade att RLS är på
   utan policies → deny all. Nedgraderat från P0 till P2 (`FASTIGHET-009`).

3. **"`enqueue_outbox_event` är en öppen e-postrelä."** Sökning efter en
   outbox-konsument visade att ingen finns; cron-jobbet processar en annan
   tabell. Nedgraderat från P0 till P1, med explicit eskaleringsvillkor
   (`FASTIGHET-002`) — och gav i stället upphov till `FASTIGHET-005`.

4. **"`isStaffAccount()` låter vilken sökande som helst nå `/admin`."**
   Kontroll visade att sökande har tomma `roleSlugs` (rollerna ligger i
   `PersonRole`, inte `UserRole`), och att varje admin-sida gör en egen
   permissionkontroll. Nedgraderat från P0 till P1 (`FASTIGHET-007`).

Samma metod bekräftade däremot `FASTIGHET-001` i tre oberoende led: funktionens
kropp (ingen guard), dess `proacl` (`anon=X`), och Supabases egen
säkerhetsadvisor.
