# Delade Supabase-migrationer

Den tidigare stora migrationen är ersatt av 15 ordnade och transaktionella SQL-filer.

## För en ny eller delvis installerad databas

1. Kör `supabase/manual/000_RESET_PARTIAL_FASTIGHETSPLATTFORM.sql` en gång i Supabase SQL Editor.
2. Kör filerna i `supabase/migrations` i filnamnsordning, från `...000100...` till `...001500...`.
3. Kör `supabase/manual/999_VERIFY_INSTALL.sql`.
4. Resultatet ska visa `installation_status = OK`, 56 av 56 tabeller och 3 storage buckets.

Reset-filen tar bort fastighetsplattformens appdata. Den raderar inte användare i `auth.users`.

## Med Supabase CLI

Efter reset kan alla migrationsfiler köras automatiskt:

```bash
npx supabase link --project-ref DITT_PROJECT_REF
npx supabase db push
```

## Viktigt

Ta bort den gamla stora migrationsfilen innan `db push`, annars försöker CLI köra både den gamla och de nya filerna.
