# Current State

Last updated: 2026-08-14 08:50 Europe/Stockholm
Last verified commit: branch `claude/system-audit-hardening-rl6mgs`
Current phase: behörighetshärdning, radering, anteckningar och index
Current task: runtime-acceptans med riktiga konton

## Production status

Databasen `Fastighetsvard` (`dmigdfbvudzexvdnbvrj`) kör hela migrationskedjan.
Migrationshistoriken är backfilld, så `supabase db push` fungerar framåt.
Behörighetsytan i PostgREST är verifierad mot det publika API:t: `anon` når
enbart de fyra katalogvyerna, och samtliga administrativa RPC:er svarar `401`.

Kvar innan skarpa personuppgifter hanteras: inloggade rollflöden per roll,
Resend-leverans och browserflöden enligt `docs/TEST_AND_RELEASE_GATE.md`.

## Current source status

VERIFIED 2026-08-14 i denna miljö:

- `npm ci`, `npm run ci` (lint, tre verify-skript, typecheck, 66 Vitest-tester,
  Next-build) – allt grönt;
- fyra nya migrationer applicerade mot databasen och verifierade med
  introspektion av ACL:er, policyer och index;
- negativa säkerhetstester mot det publika API:t med den publika nyckeln;
- Supabase security advisor: 119 -> 62 poster.

Detaljerad granskningsrapport:
`docs/audits/2026-08-14-systemgranskning-och-hardning.md`.

## Database status

40 forward-migrationer. De fyra senaste:

```text
supabase/migrations/20260814083350_least_privilege_grants.sql
supabase/migrations/20260814083604_foreign_key_indexes.sql
supabase/migrations/20260814094000_notes_and_media_lifecycle.sql
supabase/migrations/20260814095000_deletion_guards.sql
```

Dessutom `20260806190000_lock_function_grants.sql` från PR #4, som låser samma
behörighetsyta med exakta signaturer och lägger interna `service_role`-kontroller
i `write_audit_event`, `enqueue_outbox_event` och `claim_idempotent_operation`.

Samtliga är applicerade i `dmigdfbvudzexvdnbvrj`.

## Verification status

Kört och grönt 2026-08-14:

- `npm run ci` inklusive `scripts/verify-function-grants.mjs`;
- behörighets- och raderingskontroller mot den aktiva databasen, i en
  transaktion som rullades tillbaka;
- negativa körningar mot det publika REST-API:t med den publika nyckeln.

Kräver psql eller riktiga konton:

- `npm run db:verify`, `npm run test:rls`, `npm run test:grants`;
- runtime-acceptans i portalerna och Resend-leverans.

## Exact resume point

`npm ci` och `npm run ci` är körda och gröna 2026-08-14. Nästa steg kräver
riktiga konton och en körande app:

1. Logga in som ägare, fastighetsvärd och hyresgäst och verifiera att varje roll
   landar på rätt dashboard.
2. Skapa fastighet, objekt och annonsutkast, ladda upp bilder, sätt omslagsbild,
   ta bort en bild och kontrollera att filen försvinner ur `listing-media`.
3. Skriv en intern anteckning på fastighet, objekt, person och felanmälan och
   bekräfta i hyresgästportalen att den inte syns någonstans.
4. Skicka en felanmälan som hyresgäst och kontrollera post i båda portalerna
   samt Resend-leverans.
5. Försök radera en fastighet med objekt och ett objekt med avtal – båda ska
   nekas med begriplig förklaring.
6. Kör `npm run db:verify` och `npm run test:rls` mot en miljö med psql.
