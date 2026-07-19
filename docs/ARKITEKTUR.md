# Arkitektur

## Översikt

Plattformen är en Next.js-monolit med tre skikt:

1. **Datamodell** (`supabase/migrations/`) – normaliserad PostgreSQL-modell med RLS.
2. **Domänlager** (`src/lib`) – all affärslogik i rena serverfunktioner som
   både UI (server actions) och API-routes använder. Ingen affärslogik i
   komponenter, API:t är aldrig beroende av UI.
3. **Presentationslager** (`src/app`) – publik webb, Mina sidor, admin,
   entreprenörsportal och API-routes.

## Datamodell – huvudprinciper

- **Person**: en fysisk/juridisk person är EN rad. Roller
  (`PersonRole`: sökande, hyresgäst, medsökande, borgensman, köpare …) är
  många-till-en mot personen. Konto (`User`) pekar på personen.
  Dubblettkontroll vid varje ingång (registrering, admin, import, API, synk)
  via e-post/personnummer/externt kund-ID.
- **Fastighetshierarki**: `Organization → Property → Building → Entrance →
  Floor → Unit` med `parentUnitId` för underobjekt (t.ex. förråd till lägenhet).
- **Annons vs objekt**: `Listing` är separerad från `Unit`; ett objekt kan ha
  många annonser över tid. Avpublicering sker automatiskt vid uthyrning/
  försäljning (`unpublishListingsForUnit`).
- **Avtal**: `Contract` med `ContractParty` (flera parter), `ContractVersion`
  (signerat innehåll ändras aldrig – ny version skapas), signeringslogg och
  statushistorik. `replacesContractId` binder ihop intern flytt.
- **Ekonomi**: `Invoice`/`InvoiceLine`/`Payment`/`PaymentAllocation` +
  `ExternalReference` som mappar interna poster mot externa system.
  `MasterDataConfig` styr vilket system som är master per datadomän.
- **Räknare**: `Counter` ger atomiska löpnummer (ärende-, arbetsorder-,
  avtalsnummer) per organisation.

## Statusmaskiner

Definierade i `src/lib/state-machines.ts` och verkställda i backend – ogiltiga
övergångar kastar `InvalidTransitionError`:

- Annons: `DRAFT → SCHEDULED → PUBLISHED → PAUSED/UNPUBLISHED → COMPLETED`
- Ansökan: `DRAFT → SUBMITTED → RECEIVED → UNDER_REVIEW → (NEEDS_SUPPLEMENT) →
  QUALIFIED → VIEWING_* → OFFER_SENT → ACCEPTED → CONTRACT_SENT →
  CONTRACT_SIGNED → CLOSED` (+ `WITHDRAWN`)
- Avtal: `DRAFT → INTERNAL_REVIEW → APPROVED → SENT_FOR_SIGNING →
  PARTIALLY_SIGNED → SIGNED → ACTIVE → TERMINATED → ENDED → ARCHIVED`
- Faktura: `DRAFT → SENT → PARTIALLY_PAID/PAID/OVERDUE → REMINDED →
  COLLECTION → CREDITED` (betald kan aldrig bli obetald)
- Felanmälan: `RECEIVED → CONFIRMED → ASSESSING → ASSIGNED → BOOKED →
  IN_PROGRESS → DONE → QUALITY_CHECK → CLOSED` (+ `REOPENED`)
- Arbetsorder: `CREATED → OFFERED → ACCEPTED → BOOKED → IN_PROGRESS → DONE →
  APPROVED → INVOICED`

Alla statusförändringar skrivs till respektive `*StatusEvent`-tabell och till
revisionsloggen.

## Bokföringsintegration

Providerbaserat lager (`src/lib/integrations/provider.ts`): varje leverantör
(Fortnox, Visma, Björn Lundén, Business Central …) implementerar interfacet
`AccountingProvider` (hämta kunder/fakturor/betalningar/PDF, pusha
kunduppdateringar/avtalsreferenser) och registreras i ett register.
`mock`-providern är referensimplementation och används i test/demo.

**Synkflödet** (`src/lib/integrations/sync.ts`):

1. Anslutning autentiseras (credentials AES-256-GCM-krypterade i databasen).
2. Kunder hämtas och matchas mot personer – ordning: externt kund-ID →
   personnummer/orgnummer → e-post. Osäkra matchningar (ingen träff eller
   flera kandidater) går till granskningskön `SyncReviewItem`.
3. Fakturor upsertas idempotent på `(system, entityType, externalId)` och
   kopplas till avtal via externt avtals-ID, fakturareferens/avtalsnummer
   eller personens enda aktiva avtal.
4. Betalningar upsertas idempotent och uppdaterar fakturans betalstatus.
5. Resultatet loggas i `IntegrationSyncJob`; fel fäller inte hela jobbet.
6. Administratören rättar matchningar i granskningskön och kör om poster.

Samma upsert-kodväg används av batchsynk, API-push (`/invoices/sync`,
`/payments/sync`) och inkommande webhooks – samma dubblettskydd överallt.

## Säkerhet

- **Tenant-isolering**: allt data är knutet till `organizationId`; varje query
  i portal/admin/API filtrerar på organisation, och portalqueries dessutom på
  `personId`/`supplierId` (hyresgäst ser bara sitt, entreprenör bara sina order).
- **RBAC**: roller → permissions (`resurs:åtgärd`), kontrolleras server-side i
  varje action (`requirePermission`). Superadmin kan skapa egna roller.
- **Sessioner**: slumpade tokens, endast SHA-256-hash i databasen,
  httpOnly/secure/sameSite-cookies, revokeras vid lösenordsbyte.
- **Brute force-skydd**: kontolåsning 15 min efter 5 misslyckade försök.
- **API**: nycklar lagras hashade, scopes per resurs, IP-begränsning,
  rotation/revokering, rate limiting, idempotency-nycklar.
- **Webhooks**: HMAC-signering åt båda håll, replay-skydd via tidsstämpel,
  event-deduplicering, dead-letter-kö.
- **Revisionslogg**: `AuditEvent` för inloggningar, statusändringar, synk,
  import, export m.m. Känsliga fält (lösenord, tokens, personnummer) maskeras
  innan lagring.
- **GDPR**: registerutdrag (JSON-export), fält för skyddade personuppgifter,
  `retentionUntil` på dokument, anonymiseringsfält på person. Ekonomiska/
  juridiska poster raderas inte under lagstadgad tid.
- **Serverheaders**: `X-Frame-Options: DENY`, `nosniff`, referrer-policy m.m.
  XSS skyddas av Reacts escaping; SQL injection av Supabase Data API:s parametrisering;
  CSRF av sameSite-cookies + Next.js origin-kontroll för server actions.

## Kända avgränsningar / kvarvarande risker

- E-post/SMS-utskick är stubbar (loggas till konsol) tills SMTP/SMS-leverantör
  konfigureras; notifieringar lagras dock alltid i databasen.
- Riktiga providers (Fortnox m.fl.) kräver implementation av
  `AccountingProvider`-interfacet per leverantör (mock är referens).
- Filuppladdning (bilder/dokument) har datamodell (`Document`, `UnitMedia` med
  hash, virus-/filkontrollfält) men ingen bindning till objektlagring ännu.
- BankID-signering är förberedd via `signatureMethod` men inte integrerad.
- Rate limiting är per process (in-memory); sätt Redis framför vid horisontell
  skalning.
- Kartvy för sökresultat är inte implementerad (list-/rutnätsvy finns).
