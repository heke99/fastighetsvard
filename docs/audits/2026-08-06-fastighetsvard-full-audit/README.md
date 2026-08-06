# Fastighetsvärd (FaddeBo) – fullständig system-, databas- och säkerhetsaudit

Datum: 2026-08-06
Auditör: automatiserad granskning (Claude Code), evidensbaserad

## Index

| Dokument | Innehåll |
| --- | --- |
| [`EXECUTIVE_SUMMARY.md`](EXECUTIVE_SUMMARY.md) | Sammanfattning, stop-ship-bedömning, topp 5 |
| [`SYSTEM_INVENTORY.md`](SYSTEM_INVENTORY.md) | Systemkarta, appar, routes, RPC:er, jobb, miljö |
| [`SKILL_ROUTING.md`](SKILL_ROUTING.md) | Skill-routing med motivering per metod |
| [`DATA_MODEL_AND_OWNERSHIP.md`](DATA_MODEL_AND_OWNERSHIP.md) | Domänmodell, entiteter, ägarskap, ownership matrix |
| [`TENANT_AND_ROLE_MATRIX.md`](TENANT_AND_ROLE_MATRIX.md) | Organisationsisolering + roll-/behörighetsmatris |
| [`DATABASE_AND_MIGRATION_REVIEW.md`](DATABASE_AND_MIGRATION_REVIEW.md) | Migrationskedja, schema drift, FK, index, prestanda |
| [`RLS_AND_RBAC_REVIEW.md`](RLS_AND_RBAC_REVIEW.md) | RLS-policies, grants, SECURITY DEFINER, RBAC |
| [`MAINTENANCE_REQUEST_FLOW.md`](MAINTENANCE_REQUEST_FLOW.md) | Felanmälan end-to-end |
| [`STORAGE_AND_UPLOAD_REVIEW.md`](STORAGE_AND_UPLOAD_REVIEW.md) | Buckets, path-konventioner, filvalidering |
| [`AUTH_AND_INVITATION_REVIEW.md`](AUTH_AND_INVITATION_REVIEW.md) | Auth, session, inbjudan, onboarding |
| [`UI_AND_CONSISTENCY_REVIEW.md`](UI_AND_CONSISTENCY_REVIEW.md) | Portaler, UI-konsekvens, tillgänglighet |
| [`PERFORMANCE_REVIEW.md`](PERFORMANCE_REVIEW.md) | Klient-, server- och databasprestanda |
| [`SECURITY_THREAT_MODEL.md`](SECURITY_THREAT_MODEL.md) | Hotmodell per angreppsväg |
| [`FINDINGS.md`](FINDINGS.md) | Samtliga findings med evidens |
| [`VERIFICATION_MATRIX.md`](VERIFICATION_MATRIX.md) | Synk-/konsekvensmatris + obligatoriska testfall |
| [`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md) | Prioriterad åtgärdsplan |

## Scope

Hela kodbasen (`src/`, `supabase/`, `scripts/`, `tests/`), den **live-deployade**
Supabase-databasen, samt konsekvens mellan kod, migrationer, RLS, Storage, API,
notifieringar och UI.

## Auditens utgångspunkt

| Post | Värde |
| --- | --- |
| Repository | `heke99/fastighetsvard` |
| Startcommit | `d9c7cfe5c78272f76af5ace23dee0c647c66d489` |
| Branch | `claude/fastighetsvärd-system-audit-r8sfxu` |
| Arbetskatalog vid start | ren (`git status --short` tom) |
| Produktionskod ändrad | **Nej** |

> **Avvikelse från uppdragsbeskrivningen (§2.2).** Uppdraget angav branchen
> `audit/fastighetsvard-full-review-2026-08-06`. Sessionens operativa kontrakt
> binder allt arbete till `claude/fastighetsvärd-system-audit-r8sfxu` och
> förbjuder push till annan branch. Den designerade branchen har därför använts.
> Branchen utgår från `origin/main` (`d9c7cfe`), som är identisk med startcommit.

## Miljöer som verifierats

| Miljö | Status | Metod |
| --- | --- | --- |
| Repository / migrationskälla | **Verifierad** | statisk granskning av 36 migrationer |
| Live Supabase (`Fastighetsvard`, ref `dmigdfbvudzexvdnbvrj`, eu-west-1, PG 17.6) | **Verifierad (read-only)** | `pg_catalog`-introspektion via MCP |
| Lokal Supabase-stack | Ej tillgänglig | ingen Docker/lokal instans |
| Vercel / Resend / SMTP | **Ej verifierad** | ingen åtkomst till leverantörskonfiguration |

**Live-databas verifierad: Ja** (schema, policies, grants, funktioner, buckets,
constraints, index och dataintegritet). Endast läsoperationer utfördes.

## Findings per prioritet

| Prioritet | Antal | Finding-ID |
| --- | --- | --- |
| P0 | 1 | 001 |
| P1 | 8 | 002, 003, 004, 005, 006, 007, 008, 022 |
| P2 | 10 | 009, 010, 011, 012, 013, 014, 015, 016, 017, 018 |
| P3 | 3 | 019, 020, 021 |
| **Totalt** | **22** | |

Status: **19 CONFIRMED**. Tre findings har delad klassning där exploaterbarheten
inte kunnat testas i runtime: `FASTIGHET-007` (CONFIRMED i kod / LIKELY i
praktik), `FASTIGHET-008` (CONFIRMED logik / POSSIBLE påverkan) och
`FASTIGHET-014` (CONFIRMED struktur / POSSIBLE påverkan).
0 NOT VERIFIED, 0 BLOCKED.

## Stop-ship-status

**JA — stop-ship.**

`FASTIGHET-001` är bekräftad: en **oautentiserad** part med den publika
Supabase-nyckeln kan skriva godtyckliga rader i den append-only och
oföränderliga revisionsloggen `AuditEvent`. Loggen är den legala
spårbarhetskällan och kan inte städas av applikationen, vilket gör korruptionen
permanent.

Systemet ska enligt `README.md` ändå inte hantera skarpa personuppgifter innan
blockerarna i `docs/PRODUCTION_HARDENING_PHASE1.md` är stängda. Denna audit
bekräftar att den bedömningen fortfarande gäller.

## Viktigaste blockerare

1. **Grant-modellen är felaktig i källkoden.** `REVOKE ... FROM PUBLIC` tar inte
   bort Supabase standardprivilegier som ger `anon`/`authenticated` EXECUTE.
   40 SECURITY DEFINER-funktioner är åtkomliga för `anon` live.
2. **Live-databasen saknar migrationsliggare.** `supabase_migrations` är tom
   trots 36 migrationer i repot. Schemats ursprung går inte att bevisa och
   `supabase db push` kan inte köras säkert.
3. **Outbox saknar konsument.** Asynkron leveransintention skrivs men behandlas
   aldrig.
4. **RLS är inte den faktiska gränsen.** 28 tabeller har RLS på utan policies;
   praktiskt taget all administration går via service-role.

## Rekommenderad åtgärdsordning

1. `FASTIGHET-001`, `FASTIGHET-004`, `FASTIGHET-008` – lås funktionsrättigheter (P0/P1, en migration)
2. `FASTIGHET-002` – oautentiserad outbox-skrivning (ingår i samma migration)
3. `FASTIGHET-003` – återställ migrationsliggaren / baseline
4. `FASTIGHET-022` – interna kommentarer i radgränsen
5. `FASTIGHET-007` – rollklassificering till allow-list
6. `FASTIGHET-005`, `FASTIGHET-006` – outbox-konsument och storage drift
7. Därefter P2 enligt [`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md)

## Metod och begränsningar

- Endast läsoperationer mot databasen (`SELECT` mot `pg_catalog`/domäntabeller).
- Inga mutationer, inga `EXPLAIN ANALYZE` på skrivande frågor.
- Inga skarpa personuppgifter, nycklar eller tokens återges i rapporten.
- Live-databasen innehåller i praktiken testdata (1 organisation, 2 användare,
  4 fastigheter, 1 objekt, 0 avtal, 0 felanmälningar). Dataintegritetskontroller
  är därför strukturellt starka men statistiskt svaga.
- Browser-E2E, verklig e-postleverans och providerflöden är **ej** verifierade.
