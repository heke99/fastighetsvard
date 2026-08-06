# Executive summary

## Bedömning

FaddeBo är **arkitektoniskt välbyggt och betydligt mognare än sitt eget
projektminne påstår**, men har en systematisk defekt i hur databasrättigheter
delas ut. Defekten lämnar 40 privilegierade databasfunktioner öppna för
oautentiserade anrop. Två av dem saknar interna skyddskontroller, varav en är
stop-ship.

**Stop-ship: JA** (`FASTIGHET-001`).

## Vad som fungerar bra

Detta bör sägas först, eftersom det påverkar hur remediationen ska prioriteras:

- **Applikationsauktoriseringen är konsekvent.** Samtliga 26 server actions i
  `src/app/admin/actions.ts` anropar `requirePermission(resource, action)`.
  Samtliga 18 admin-sidor kontrollerar `hasPermission(...)` och redirectar.
  Ingen sida förlitar sig på dolt UI som enda skydd.
- **Domänkommandon är atomiska och optimistiskt låsta.** RPC:erna använder
  `FOR UPDATE`, `expected_status`-jämförelser (`optimistic_lock_conflict`,
  SQLSTATE 40001), och `claim_idempotent_operation` för replay-skydd.
- **Organisationsbindning sker server-side.** Klienten kan inte välja
  organisation, person eller skapare; värdena hämtas ur `current_user_context()`.
- **Felanmälningsflödet är korrekt bundet.** Hyresgästens objekt verifieras mot
  faktiskt hyresförhållande innan ärendet skapas, och sidoeffekter körs
  post-commit så att ett e-postfel aldrig rullar tillbaka ärendet.
- **Storage-nycklar byggs av betrodda värden** och matchar storage-policyns
  path-krav exakt.
- **Hela CI-grinden är grön**: lint, 53 verifieringskontroller, `tsc --noEmit`,
  50 enhetstester och produktionsbygge.

## De fem viktigaste fynden

### 1. `write_audit_event` är öppen för `anon` (P0, CONFIRMED)

Vem som helst med den publika Supabase-nyckeln kan skriva godtyckliga rader i
revisionsloggen. Tabellen är append-only och skyddad av
`reject_audit_mutation()`, så förfalskade rader **kan inte tas bort** av
applikationen. Legal spårbarhet förstörs permanent.
→ `FASTIGHET-001`

### 2. Grant-modellen är fel i källkoden (P1, CONFIRMED)

`REVOKE ALL ON FUNCTION ... FROM PUBLIC` tar inte bort Supabase
standardprivilegier som ges direkt till rollen `anon`. Fyra migrationer använder
det korrekta mönstret (`FROM PUBLIC, anon, authenticated`) och deras funktioner
är låsta live; alla andra är öppna. Detta är rotorsaken till fynd 1 och 3.
→ `FASTIGHET-004`

### 3. `enqueue_outbox_event` är öppen för `anon` (P1, CONFIRMED)

Oautentiserad insert i outbox-kön med fritt valbar mottagare. I dag begränsat
till lagrings-DoS och förgiftning av idempotensnycklar — men bygger man den
outbox-worker arkitekturen föreskriver blir det en öppen e-postrelä från
`info@faddebo.se`. Måste åtgärdas **före** konsumenten byggs.
→ `FASTIGHET-002`

### 4. Live-databasen har ingen migrationsliggare (P1, CONFIRMED)

`supabase_migrations.schema_migrations` är tom trots 36 migrationer i repot.
Schemat har applicerats utanför migrationskedjan. Det gör drift osynlig — och
drift finns redan bevisligen (`property-media`-bucketen, grant-tillståndet).
`supabase db push` kan i nuläget inte köras säkert.
→ `FASTIGHET-003`

### 5. Outbox-kön har ingen konsument (P1, CONFIRMED)

Sju anropsplatser skriver till `OutboxEvent`. Ingen kod läser tabellen. Cron-jobbet
processar `WebhookDelivery`, en annan tabell. Händelser som `offer.accepted` och
`application.submitted` registreras och levereras aldrig — utan larm, eftersom
kölängden inte mäts.
→ `FASTIGHET-005`

## Svar på auditens huvudfrågor

| Fråga | Svar |
| --- | --- |
| Är organisationsisoleringen verifierad? | **Delvis.** Produkten är enorganisations (1 rad i `Organization`), så isolering kan inte testas empiriskt. Strukturellt: server-side-bindning är korrekt, men två policies/funktioner saknar organisationspredikat (`FASTIGHET-012`, `FASTIGHET-013`). |
| Är RLS och serverbehörighet konsekventa? | **Nej.** RLS är på överallt, men 28 tabeller saknar policies och administrationen går helt via service-role. RLS är i praktiken inte den verksamma gränsen — applikationskoden är det. |
| Matchar databasen migrationshistoriken? | **Nej.** Ingen liggare; bekräftad drift i grants och storage. |
| Är felanmälningsflödet säkert och konsekvent? | **Ja, med reservation.** Ägarskap, organisation och objekt binds korrekt server-side; sidoeffekter är post-commit. Reservation: filvalidering litar på klientens MIME-typ (`FASTIGHET-011`). |
| Är storage organisationssäkert? | **Ja för de nio kända bucketarna.** Path-konventionen matchar policyn. Undantag: den odokumenterade publika `property-media` (`FASTIGHET-006`). |
| Visas och tillämpas roller konsekvent? | **Delvis.** Tillämpningen är konsekvent via `requirePermission`. Klassificeringen `isStaffAccount()` är dock en deny-list som gör varje okänd roll till personal (`FASTIGHET-007`). |
| Använder klient, server och databas samma datamodell? | **Ja.** `src/lib/database-types.ts` speglar enums; `tests/supabase-schema.test.ts` och de tre verify-skripten (53 kontroller) upprätthåller synk aktivt. Ingen enum-divergens hittades. |

## Kvarvarande blockerare

| Blockerare | Effekt |
| --- | --- |
| Ingen staging-databas med applicerad migrationskedja | RLS-/Storage-negativtester (`npm run test:rls`, `npm run db:verify`) kan inte köras |
| Ingen åtkomst till Vercel-/Resend-konfiguration | E-postleverans, avsändaridentitet och bounce-hantering ej verifierade |
| Ingen browserdriven E2E | UI-tillstånd, tangentbordsnavigering och skärmläsarstöd ej verifierade |
| Live-databasen är i praktiken tom | Dataintegritets- och prestandafynd är strukturella, inte statistiska |

## Rekommenderad första åtgärd

En enda migration som låser grants löser P0 och det mesta av P1:

```sql
-- Konceptuellt; exakt lista genereras ur pg_proc
REVOKE ALL ON ALL FUNCTIONS IN SCHEMA public FROM PUBLIC, anon, authenticated;
-- följt av selektiva GRANT EXECUTE ... TO authenticated / service_role
```

Den måste dock deployas, vilket kräver att `FASTIGHET-003` (migrationsliggaren)
löses först eller att åtgärden appliceras manuellt och registreras. Se
[`REMEDIATION_PLAN.md`](REMEDIATION_PLAN.md).
