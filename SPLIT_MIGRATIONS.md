# Canonical Supabase-migrationer

Den tidigare monolitiska initialmigrationen och fyra överlappande repair-migrationer är borttagna. `supabase/migrations` innehåller nu en enda linjär kedja med 15 filer.

## Ny lokal eller tom databas

```bash
supabase start
supabase db reset
npm run db:verify
npm run test:rls
```

## Befintlig databas som redan körde monoliten

`migration repair` ändrar endast Supabase migrationshistorik. Kommandot kör inte och återställer inte SQL. Ta därför backup/PITR-snapshot och kontrollera den faktiska databasen först.

1. Länka rätt projekt och lista lokal/remote historik:

```bash
supabase link --project-ref "$SUPABASE_PROJECT_REF"
supabase migration list
```

2. Kör den read-only preflight-rapporten:

```bash
psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 \
  -f supabase/manual/20260724_preflight_backfill_report.sql
```

3. Endast när remote-listan visar att gamla monoliten faktiskt är applicerad: markera de borttagna legacy-versionerna som `reverted`. Kör endast versioner som verkligen finns i REMOTE-kolumnen:

```bash
supabase migration repair 20260719192014 --status reverted
supabase migration repair 20260720000600 --status reverted
supabase migration repair 20260720000700 --status reverted
supabase migration repair 20260720000800 --status reverted
supabase migration repair 20260720000900 --status reverted
```

4. Eftersom monoliten redan skapade foundation-objekten ska följande foundation-versioner markeras som applicerade utan att SQL körs igen:

```bash
supabase migration repair \
  20260720000100 20260720000200 20260720000300 20260720000400 \
  20260720000500 20260720001000 20260720001100 20260720001200 \
  --status applied
```

Kör **inte** `repair --status applied` för `20260720001300`, `20260720001400` eller `20260720001500` i detta legacy-scenario. De ska exekveras av `db push` för att uppdatera auth-hjälpare, ersätta legacy-RLS och återkalla gamla breda PostgREST-grants.

5. Verifiera historiken, granska SQL-planen och pusha:

```bash
supabase migration list
supabase db push --dry-run
supabase db push
npm run db:verify
npm run test:rls
```

Stoppa vid dubbletter, överlappande bindande kontrakt, poster utan organisation/personrelation eller avvikande migrationshistorik. Använd aldrig en destruktiv reset mot produktion.
