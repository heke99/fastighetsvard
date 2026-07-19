# Installation, migration, build, test och deploy

## Förutsättningar

- Node.js ≥ 20 (testat med 22)
- PostgreSQL ≥ 14 (testat med 16)

## Miljövariabler

Kopiera `.env.example` till `.env` och fyll i:

| Variabel | Obligatorisk | Beskrivning |
| --- | --- | --- |
| `DATABASE_URL` | Ja | PostgreSQL-anslutning, t.ex. `postgresql://app:app@localhost:5432/fastighet?schema=public` |
| `SESSION_SECRET` | Ja | Slumpad sträng ≥ 32 tecken för sessioner |
| `APP_ENCRYPTION_KEY` | Ja | 64 hex-tecken (32 byte). AES-256-GCM-nyckel för integrations-credentials. Generera: `openssl rand -hex 32` |
| `APP_URL` | Ja | Publik bas-URL, används i aktiverings-/återställningslänkar |
| `CRON_SECRET` | Nej | Bearer-token för `POST /api/internal/webhooks/process` (cron) |
| `SMTP_HOST` m.fl. | Nej | E-postutskick. Utan SMTP loggas länkar till serverkonsolen |

## Exakta terminalkommandon

### Installation

```bash
npm install
cp .env.example .env
# redigera .env
```

### Databas (lokalt exempel)

```bash
sudo -u postgres psql -c "CREATE USER app WITH PASSWORD 'app' CREATEDB;"
sudo -u postgres createdb -O app fastighet
sudo -u postgres createdb -O app fastighet_test   # för testsviten
```

### Migration

```bash
npx prisma migrate deploy     # produktion/CI – kör alla migrationer
npm run db:migrate:dev        # utveckling – skapar ny migration vid schemaändring
npm run db:seed               # systemroller, organisation, demodata
```

Migrationerna är verifierade att kunna köras från en helt ren databas.

### Build

```bash
npm run typecheck
npm run build
```

### Test

```bash
npm test        # kör mot fastighet_test (migrate deploy körs automatiskt först)
```

### Start / deploy

```bash
npm start                       # produktionsserver på :3000
# eller bakom process manager:
pm2 start npm --name fastighet -- start
```

För utgående webhooks med retries: schemalägg

```bash
curl -X POST -H "Authorization: Bearer $CRON_SECRET" https://<host>/api/internal/webhooks/process
```

varje minut (cron/systemd-timer). Leveranskön kan även processas manuellt från
`/admin/webhooks`.

### Deploy-checklista

1. Sätt alla miljövariabler (nya slumpade `SESSION_SECRET` och `APP_ENCRYPTION_KEY`).
2. `npm ci && npm run build`
3. `npx prisma migrate deploy`
4. Första gången: `npm run db:seed` och byt sedan lösenord på admin-kontot.
5. `npm start` bakom reverse proxy med TLS (kakor är `secure` i produktion).
6. Konfigurera cron för webhook-kön.
7. Skapa API-nycklar och integrationsanslutning under `/admin`.
