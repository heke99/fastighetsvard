# Databas, RLS och Storage

## Canonical migrationskedja

Migrationerna körs lexikografiskt i `supabase/migrations`. Den gamla monolitiska initialmigrationen och fyra överlappande repair-migrationer är borttagna.

`supabase/tests/verify_schema.sql` kontrollerar obligatoriska tabeller, index, exclusion constraint, RPC-funktioner, RLS och Storage-buckets. `supabase/tests/verify_rls.sql` kontrollerar att centrala tabeller har RLS och att privata buckets inte har den tidigare globala authenticated-policyn.

## Databasprinciper

- Kritiska statusövergångar ska ske i `SECURITY DEFINER`-funktioner med fast `search_path`.
- Actor, person, organisation och permission verifieras i databasen.
- Row locks och villkorade statusuppdateringar avgör vinnare vid samtidighet.
- Outbox-event och audit skapas i samma transaktion som domänändringen.
- Idempotensnyckel + request-hash förhindrar dubbelkörning och ändrad replay.
- Bindande kontraktsperioder skyddas med `btree_gist` och exclusion constraint.

## RLS

Browserklienter ska använda user-scoped Supabase-klient. Service role får bara användas i namngivna systemoperationer. RLS är default-deny; åtkomst ges genom egen personrelation eller explicit permission.

Audit saknar update/delete-policy och skyddas dessutom av trigger. Känslig åtkomst ska registreras genom kontrollerad serveroperation.

## Storage

Endast `listing-media` är publik. Privata objekt använder struktur:

`<organization-id>/<person-or-case-id>/<server-generated-file-name>`

Klienten får inte välja godtycklig path. Signed URL ska skapas server-side med kort TTL efter kontroll av organisation, person/ärende och permission. Databaspost och Storage-objekt ska hållas synkroniserade.
