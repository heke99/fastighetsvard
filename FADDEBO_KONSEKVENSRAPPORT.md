# FaddeBo — konsekvensgranskning av roller, hyresgäster, lägenheter och felanmälan

Datum: 2026-08-04  
Källa: uppladdat projekt `fastighetsvard-main (2).zip`

## Slutsats

De konkreta inkonsekvenser som gick att belägga i koden är korrigerade i den
här leveransen:

- personalens exakta roll visas nu i adminhuvudet, användarlistan och
  person-/hyresgästlistan;
- systemroller har samma svenska namn, beskrivning och behörigheter i kod och
  databas;
- egna roller fungerar som personalroller och leder till adminportalen;
- databasen kräver att rollskaparen är aktiv, tillhör rätt organisation och har `roles:create`;
- endast ägare/superadmin kan skapa en egen roll med fullständig `*`-åtkomst;
- hyresgäster och medhyresgäster visas från aktiva avtal på rätt objekt;
- knappar för import, registrering och inbjudan visas bara när användaren har
  motsvarande serverbehörighet;
- lägenhetsannonser kan nu få bilder och planritningar via admin;
- felanmälan sparas först och visas sedan i både hyresgästens och personalens
  portal, med privata bilagor och e-postavisering;
- fel hos Resend, webhook eller bilageuppladdning kan inte radera eller dölja
  den redan skapade felanmälan.

Detta är källkods- och statiskt verifierat. Produktion kan inte kallas
verifierad förrän migrationer, Supabase Storage, Resend, RLS och webbläsarflöden
har körts i staging/produktion.

## Tydliga personalroller

| Roll | Synligt namn | Huvudansvar |
| --- | --- | --- |
| `superadmin` | Ägare / superadmin | Full ägarbehörighet, personal och roller |
| `org-admin` | Bolagsadmin | Administrerar bolagets användare och verksamhetsflöden |
| `property-owner` | Fastighetsägare | Läsning och rapportering för beståndet |
| `property-manager` | Fastighetsvärd / förvaltare | Uthyrning, hyresgäster och operativ förvaltning |
| `caretaker` | Kvartersvärd | Boendeservice, felanmälan och arbetsorder |
| `leasing-agent` | Uthyrare | Annonser, ansökningar, visning, erbjudande och avtal |
| `sales-manager` | Försäljningsansvarig | Försäljning och kommersiella objekt |
| `finance` | Ekonom | Fakturor, betalningar och ekonomirapporter |
| `customer-service` | Kundtjänst | Personer, ärenden, meddelanden och relevanta läsvyer |
| `facility-worker` | Fastighetsskötare | Utför och uppdaterar felanmälningar och arbetsorder |
| `inspector` | Besiktningsman | Besiktningar och tillhörande dokument |
| `contractor` | Entreprenör | Endast leverantörens arbetsorder i entreprenörsportalen |
| `report-viewer` | Rapportläsare | Läsning av rapporter |

Egna roller kräver ett tydligt ansvar, exempelvis “Regional förvaltare”, samt
canonical behörigheter som `maintenance:update` eller `units:read`.

## Korrigerade flöden

### 1. Superadmin och personal

- Adminhuvudet visar personens namn/e-post och exakta rollnamn.
- “Användare & roller” skiljer mellan **personalroll** och **personroll**.
- “Hyresgäster & personer” visar även eventuell personalroll på personen.
- Aktivt respektive avstängt portalkonto visas korrekt.
- Rollnamn och behörigheter hämtas organisationsavgränsat i sessionen och personlistan.
- Rollskapande kontrolleras även i databasen mot aktiv användare och `roles:create`.
- Egna roller leder till `/admin`, men hyresgäst och entreprenör hålls kvar i
  sina respektive portaler.

### 2. Hyresgäster och objekt

- Hyresgästregistrering kräver `contracts:create`.
- CSV-import kräver `imports:create`.
- Portalaktivering/inbjudan kräver `persons:update`.
- Objektvyn visar både huvudhyresgäst och medhyresgäst från aktiva avtal.
- Ett nytt objekt måste kopplas till en fastighet i samma organisation och
  objektsnumret kontrolleras mot dubletter.

### 3. Lägenhets- och annonsuppladdning

- Bilder och planritningar kan laddas upp när annonsutkastet skapas.
- Media kan även läggas till i efterhand från annonslistan.
- Filerna valideras som JPG, PNG, WebP eller AVIF, högst 12 filer per gång och
  högst 15 MB per fil.
- Lagringsvägen innehåller organisation och objekt.
- Databasen sparar materialet i canonical `UnitMedia`.
- Den publika annonssidan använder samma `UnitMedia` för bild och planritning.
- Om mediauppladdningen misslyckas efter att annonsen skapats rapporteras
  annonsen fortfarande som skapad, så användaren inte skapar en dubblett.

### 4. Felanmälan från hyresgäst till personal

1. Hyresgästen väljer ett objekt som hen faktiskt hyr, eller allmänt utrymme.
2. Felanmälan skapas atomiskt med ärendenummer, första statushändelse,
   revisionsspår och notis i portalen.
3. JPG, PNG, WebP och PDF kan bifogas, högst 5 filer och 10 MB per fil.
4. Bilagor lagras privat under organisation/person/ärende och kopplas till
   `Document.maintenanceRequestId`.
5. Ärendet visas direkt under **Mina sidor → Felanmälan**.
6. Samma ärende visas under **Admin → Förvaltning → Felanmälningar** för roller
   med `maintenance:read`.
7. Ett internt mejl skickas till `felanmalan@faddebo.se`.
8. Hyresgästen får mottagningsmejl och statusmejl till sin registrerade adress.
9. Statushistorik och bilagor syns i portalen.
10. Resend- eller webhookfel loggas efter databascommit och kan inte rulla
    tillbaka ärendet.

## Sidomenyer

Personalportalen har **Felanmälningar** under **Förvaltning** och visar länken
endast för användare med `maintenance:read`.

Hyresgästportalen har **Felanmälan** som hyresgästspecifik meny. Sökande utan
aktiv hyresgästrelation ser inte hyresgästfunktionerna.

## Databasändring som måste köras

Senaste migration:

```text
supabase/migrations/20260804120000_role_context_consistency.sql
```

Den gör följande:

- uppdaterar svenska namn och beskrivningar för 13 systemroller;
- synkroniserar exakt canonical behörighetsuppsättning och tar bort gamla
  överflödiga systemrollsbehörigheter;
- ersätter `create_custom_role` med beskrivning, behörighetsvalidering och kontroll av aktiv behörig aktör;
- blockerar global `*` för andra än aktiv superadmin i rätt organisation;
- lägger till exakta `roleNames` i `current_user_context()`;
- organisationsavgränsar roller, behörigheter och länkad person.

## Verifiering som utfördes här

Följande passerade:

```text
Static hardening checks: 36 migrationer
Konto/livscykel: 16 av 16 kontroller
Login/dashboard: 10 av 10 kontroller
Roll/hyresgäst/media/felanmälan: 27 av 27 kontroller
TypeScript-syntax: 27 av 27 ändrade TS/TSX-filer
Systemrollsmatchning: 13 av 13 roller, exakt samma permissions i TS och SQL
```

## Verifiering som inte kunde köras här

`npm ci` stoppades av miljöns interna npm-register, som returnerade HTTP 404 för
den låsta filen `zod-3.25.76.tgz`. Därför är följande inte godkänt i den här
miljön:

- komplett `npm run typecheck` med installerade deklarationer;
- Vitest;
- Next.js produktionsbuild;
- verklig migration mot Supabase;
- RLS- och Storage-negativtester;
- verklig Resend-leverans;
- webbläsartest av alla roller och portaler.

Inga dependency-versioner ändrades för att maskera registerfelet.

## Exakt körordning i canonical projekt

```bash
npm ci
npm run lint
npm run verify:accounts
npm run verify:login-dashboard
npm run verify:consistency
npm run typecheck
npm run test:unit
npm run build
supabase db push
npm run db:verify
npm run test:rls
```

Miljön behöver minst:

```env
RESEND_API_KEY=...
EMAIL_FROM=FaddeBo <info@faddebo.se>
NEXT_PUBLIC_APP_URL=https://faddebo.se
```

Supabase-migrationerna skapar bucketarna `listing-media` och
`maintenance-files`. Kontrollera efter `db push` att den första är publik och
den andra privat.

## Manuell acceptanstest i staging

1. Logga in som ägare och kontrollera märket **Ägare / superadmin**.
2. Skapa en egen roll med `maintenance:read, maintenance:update`; skapa personal
   med rollen och kontrollera adminrouting, sidomeny och rollvisning.
3. Försök skapa en roll med en aktiv användare utan `roles:create`, och försök därefter skapa `*` med en icke-superadmin; båda ska avslås.
4. Registrera en hyresgäst och medhyresgäst med aktivt avtal; kontrollera båda i
   personlistan och på objektet.
5. Kontrollera att en roll utan import-/avtals-/personuppdateringsbehörighet inte
   ser motsvarande knappar.
6. Skapa ett objekt och annonsutkast med en bild och planritning; publicera och
   kontrollera materialet på `/annons/<slug>`.
7. Lägg till ytterligare media från annonslistan och kontrollera mediaräknaren.
8. Logga in som hyresgäst och skicka felanmälan med bild och PDF.
9. Kontrollera ärendenummer, portalvisning, adminvisning, privata bilagelänkar,
   internt mejl och hyresgästens kvitto.
10. Ändra status som fastighetsvärd och kontrollera status i båda portalerna och
    statusmejlet.
11. Testa med felaktig Resend-nyckel: ärendet ska fortfarande finnas exakt en
    gång i båda portalerna.
12. Testa två organisationer och verifiera att roller, personer, objekt, media
    och felanmälningar inte kan korsläsas.
