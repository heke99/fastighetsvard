# Östgöta El Teknik – Fastighetsplattform

Komplett webbplattform för fastighetsvärden **Östgöta El Teknik**: publik
annonsplattform (uthyrning, försäljning, lokaler, parkering), Mina sidor för
hyresgäster och bostadssökande, administrativt gränssnitt, entreprenörsportal,
REST API v1, webhooks samt providerbaserad integration mot externa
bokföringssystem.

## Teknikstack

| Del | Teknik |
| --- | --- |
| Ramverk | Next.js 15 (App Router, React 19, Server Components + Server Actions) |
| Språk | TypeScript (strict) |
| Databas | PostgreSQL via Prisma ORM |
| Styling | Tailwind CSS |
| Tester | Vitest (64 tester: idempotens, dubblettskydd, tenant-isolering, statusmaskiner m.m.) |
| Autentisering | Egen sessionshantering (httpOnly-cookies, bcrypt, kontolåsning) |

## Kom igång

```bash
# 1. Installera beroenden
npm install

# 2. Konfigurera miljön
cp .env.example .env       # fyll i DATABASE_URL m.m.

# 3. Skapa databas och kör migrationer
npx prisma migrate deploy   # (eller: npm run db:migrate)

# 4. Seeda systemroller, organisation och demodata
npm run db:seed

# 5. Starta
npm run dev                 # utveckling, http://localhost:3000
npm run build && npm start  # produktion
```

### Demokonton (från seed)

| Roll | E-post | Lösenord |
| --- | --- | --- |
| Superadmin | `admin@ostgotaelteknik.se` | `Admin123!Demo` |
| Befintlig hyresgäst | `greta.hyresgast@example.com` | `Hyresgast123!` |

### Test

```bash
npm test          # kräver testdatabasen fastighet_test (se docs/INSTALL.md)
npm run typecheck
```

## Struktur

```
prisma/schema.prisma        Normaliserad datamodell (~45 entiteter)
prisma/seed.ts              Roller, organisation, demodata
src/lib/                    Domänlager
  state-machines.ts         Kontrollerade statusövergångar (blockeras i backend)
  permissions.ts            RBAC: roller, permissions, API-scopes
  auth.ts                   Sessioner, inloggning, brute force-skydd
  audit.ts                  Revisionslogg med maskering av känsliga fält
  crypto.ts                 HMAC-webhooksignaturer, AES-256-GCM, API-nycklar
  services/                 Affärslogik (hyresgäster, avtal, ansökningar, annonser,
                            felanmälan/arbetsorder, webhooks, konton)
  integrations/             Providerbaserat bokföringslager + synk & matchning
  api/                      API-autentisering, pagination, idempotency, serializers
src/app/(public)/           Publik webb: startsida, sök, annonser, konto
src/app/(portal)/mina-sidor Hyresgäst-/sökandeportal
src/app/admin/              Administrativt gränssnitt
src/app/entreprenor/        Entreprenörsportal (ser endast egna arbetsorder)
src/app/api/v1/             REST API v1 (OpenAPI på /api/v1/openapi)
src/app/api/webhooks/       Inkommande webhooks från bokföringssystem
tests/                      Vitest-sviter
docs/                       API-, webhook-, arkitektur- och driftdokumentation
```

## Central dokumentation

- [docs/INSTALL.md](docs/INSTALL.md) – installation, migration, build, test, deploy
- [docs/API.md](docs/API.md) – REST API v1 med exempelanrop
- [docs/WEBHOOKS.md](docs/WEBHOOKS.md) – in-/utgående webhooks, signering, retries
- [docs/ARKITEKTUR.md](docs/ARKITEKTUR.md) – datamodell, statusmaskiner, säkerhet, integrationer

## Kärnprinciper

- **En person är en person** – sökande, hyresgäst, medsökande, borgensman och
  köpare är roller på samma `Person`, aldrig separata register.
- **Annons ≠ objekt** – ett objekt (`Unit`) kan ha många annonser (`Listing`) över tid.
- **Bokföringssystemet är master** för kunder/fakturor/betalningar
  (konfigurerbart per domän i `MasterDataConfig`). Plattformen skapar aldrig
  dubbletter: allt mappas via `ExternalReference` med unika externa ID:n.
- **Statusmaskiner i backend** – ogiltiga övergångar blockeras serverside.
- **Server-side authorization** – RBAC valideras i varje server action/route;
  UI-behörighet räcker aldrig. Tenant-isolering i alla queries.
- **Spårbarhet** – alla ekonomiska/juridiska förändringar loggas i `AuditEvent`
  med maskering av känsliga fält.
