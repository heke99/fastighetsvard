# Systemgranskning och härdning – 2026-08-14

Granskningen utgick från repository, den körande Supabase-databasen
(`Fastighetsvard`, ref `dmigdfbvudzexvdnbvrj`) och den faktiska
behörighetsytan i PostgREST. Samtliga åtgärder nedan är implementerade som
migrationer i `supabase/migrations/`, applicerade mot databasen och verifierade.

## P0 – Behörighetsläcka i PostgREST-rollerna

**Problem.** Supabase default privileges ger `anon` och `authenticated`
EXECUTE på varje ny funktion i `public` och samtliga tabellprivilegier på nya
tabeller. Migrationen `20260724010000_core_domain_hardening.sql` återkallade
bara från `PUBLIC`, vilket inte tar bort rättigheter som getts till namngivna
roller. Följden:

- 40 SECURITY DEFINER-funktioner var anropbara med enbart den publika nyckeln,
  bland andra `write_audit_event` (revisionslogg utan intern kontroll),
  `enqueue_outbox_event` (kunde köa e-post/webhooks till godtycklig mottagare),
  `claim_outbox_jobs`, `complete_move_in`, `countersign_contract` och
  `activate_signed_contract`;
- tio tabeller skapade efter härdningsmigrationen – bland andra `Brand`,
  `Session`, `PasswordResetToken`, `SigningSession`, `ContractSignature`,
  `MoveInCase`, `MoveOutCase` och `Reservation` – hade kvar
  INSERT/UPDATE/DELETE/TRUNCATE för `anon` och `authenticated`. Skrivningarna
  stoppades av RLS, men enbart av RLS;
- de fyra publika katalogvyerna hade DELETE/INSERT/TRUNCATE för båda rollerna.

**Åtgärd.** `20260814083350_least_privilege_grants.sql`:

- återkallar EXECUTE från `PUBLIC`, `anon` och `authenticated` på alla
  public-funktioner och återger den till `authenticated` för exakt 27
  funktioner: RLS-hjälpfunktionerna, portalens läs- och skrivkommandon samt de
  personalkommandon som anropas med användarens egen JWT och som själva
  kontrollerar organisation och `app_has_permission`;
- `anon` har efter migrationen enbart SELECT på de fyra katalogvyerna;
- `authenticated` behåller sina SELECT-rättigheter och exakt de skrivningar som
  har en RLS-policy bakom sig (egen person, egna favoriter/bevakningar, markera
  eget meddelande och egen notis som läst, varumärke för behörig personal);
- `ALTER DEFAULT PRIVILEGES` stänger källan, så framtida migrationer inte kan
  återinföra problemet;
- `set_updated_at` fick fast `search_path`.

**Verifiering.** Negativa körningar mot det publika API:t med den publika
nyckeln: `write_audit_event`, `enqueue_outbox_event`, `change_listing_status`,
läsning av `Person` och INSERT i `Brand` svarar samtliga `401`, medan
`published_listing_catalog` fortsatt svarar `200`. Supabase security advisor
gick från 119 till 62 poster; alla anon-anropbara definer-funktioner och
`function_search_path_mutable` är borta.

## P0 – Kaskadradering av juridiska avtal

**Problem.** `Property → Unit → Contract` är kopplade med ON DELETE CASCADE.
En raderad fastighet tog med sig samtliga objekt och därmed signerade och
aktiva hyresavtal, avtalsversioner, signaturer samt in- och
utflyttningsärenden. Ingen applikationskod kan göra det säkert, eftersom
kaskaden sker inne i PostgreSQL.

**Åtgärd.** `20260814095000_deletion_guards.sql` lägger BEFORE DELETE-triggers
som gör invarianten till en del av schemat: ett avtal som lämnat `DRAFT` kan
inte raderas, varken direkt eller via kaskad, och ett objekt med
avtalshistorik kan inte raderas. Avslut sker genom uppsägnings- och
avflyttningsflödet, som bevarar posten.

## P1 – Radering saknades helt

Systemet kunde skapa fastigheter, objekt, annonser och media men inte ta bort
något. `src/lib/repositories/deletion-operations.ts` implementerar radering med
beroendekontroll före försöket, och `DangerActionForm` ger bekräftelse,
konsekvensbeskrivning och låst knapp under pågående anrop.

| Objekt | Regel |
| --- | --- |
| Annons | Raderas endast som utkast utan ansökningar, visningar, erbjudanden och reservationer. Publicerade annonser avpubliceras. |
| Objekt | Raderas endast utan avtal, annonser, felanmälningar, fakturor, besiktningar, in-/utflyttningsärenden och reservationer. Bilder städas ur Storage. |
| Fastighet | Raderas endast utan objekt, byggnader och felanmälningar. |
| Anteckning | Mjuk radering; revisionsloggen behåller spåret. |

## P1 – Bildhantering utan livscykel

- `UnitMedia` saknade lagringsnyckel, så en borttagen bild hade lämnat filen
  kvar i bucketen. Kolumnen `storageKey` är tillagd, bakåtfylld ur den publika
  URL:en och unik.
- MIME-typen validerades enbart mot `File.type`, som sätts av webbläsaren.
  `detectImageMimeType` läser nu filens magiska bytes server-side; JPEG, PNG,
  WebP och AVIF accepteras, allt annat avvisas oavsett vad filnamn och
  `Content-Type` påstår. Filändelsen i Storage härleds ur den verifierade typen.
- Bildtexten sanerats från sökväg och ändelse i stället för att spegla
  originalfilnamnet.
- `ListingMediaManager` ger förhandsvisning, omslagsbild och borttagning per
  bild, med både databaspost och Storage-objekt.

## P1 – Interna anteckningar

`Note` är canonical lagring för interna anteckningar på fastighet, objekt,
annons, person, ansökan, avtal, felanmälan och arbetsorder. Behörigheten ärvs
från objektet: den som får uppdatera en fastighet får skriva dess
anteckningar. Samma avbildning finns i `public.note_entity_permission` och i
`src/lib/repositories/notes.ts`. Endast en läspolicy för personal finns – en
hyresgäst saknar samtliga personalbehörigheter och kan därför aldrig läsa en
intern anteckning, oavsett väg in. Radering är mjuk.

Behörighetskontrollen vid radering utgår från anteckningens egen entitetstyp,
inte från det värde formuläret skickar.

## P2 – Index

80 främmande nycklar saknade index. `20260814083604_foreign_key_indexes.sql`
lägger 72 index för de nycklar som faktiskt joinas, filtreras eller
kaskadraderas i nuvarande kod – fastighetsstrukturen, annonser, ansökningar,
avtal, felanmälan, fakturor, dokument och integrationsköer. Rent beskrivande
nycklar på enradiga konfigurationstabeller har medvetet inget index.

## Migrationshistorik

Databasen hade hela schemat men `supabase_migrations.schema_migrations` var
tom, eftersom migrationerna körts som skript. `supabase db push` hade därför
försökt köra om hela kedjan. Historiken är nu backfilld för samtliga 36
tidigare migrationer, och de fyra nya ligger på sina egna versioner.

## Medvetna avvägningar

- **De fyra katalogvyerna behålls som SECURITY DEFINER.** Advisorn flaggar det
  som ERROR, men vyerna är avsiktliga publika projektioner av publicerade
  annonser och aktiva fastigheter. `security_invoker` skulle kräva
  anon-policies på `Listing`, `Unit`, `Property`, `UnitMedia` och `Viewing`,
  vilket vore en större läckyta än vyerna själva.
- **`Note` använder `TIMESTAMP(3)` utan tidszon** som resten av schemat.
  Blandade tidstyper vore sämre än en genomgående konvention; presentationen
  sker i `Europe/Stockholm`.
- **28 tabeller har RLS på utan policies.** Det är avsiktligt: de nås endast
  med service-rollen och ska neka `anon` och `authenticated` allt.

## Kvarstående, kräver åtgärd utanför repositoryt

- **Leaked password protection** aktiveras i Supabase Auth-inställningarna.
- **`btree_gist` ligger i `public`.** Flytt kräver att beroende index byggs om
  och bör göras i ett eget underhållsfönster.
- Löpande runtime-acceptans (verklig inloggning per roll, e-postleverans via
  Resend, browserflöden) enligt `docs/TEST_AND_RELEASE_GATE.md`.
