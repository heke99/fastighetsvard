# Installation och deployment

## Verktyg

- Node.js 22.16.0
- npm 10.9.2
- Supabase CLI 2.109.1
- Docker Desktop
- Vercel CLI eller Vercel Git-integration

## Lokal verifiering

```bash
nvm install 22.16.0
nvm use 22.16.0
npm install -g npm@10.9.2
npm ci
cp .env.example .env.local
supabase start
npm run db:reset
npm run db:verify
npm run test:rls
npm run lint
npm run typecheck
npm run test:unit
npm run test:concurrency
npm run build
npm run dev
npm run test:e2e
```

`test:concurrency` verifierar endast att databasprimitiverna finns. Lägg därtill riktiga parallella integrationstester mot den lokala databasen före release.

## Länka och pusha Supabase

```bash
npx supabase login
npx supabase link --project-ref "$SUPABASE_PROJECT_REF"
npx supabase db diff --linked
npx supabase db push --dry-run
npx supabase db push
```

Kör först `supabase/manual/20260724_preflight_backfill_report.sql` mot befintlig miljö. Om databasen redan körde den borttagna monolitiska migrationen ska migrationshistoriken reconcileras exakt enligt `SPLIT_MIGRATIONS.md` innan `db push`. Ta backup före varje ändring och stoppa deployment om rapporten eller `migration list` visar avvikelser.

## Vercel

Sätt alla relevanta värden från `.env.example` separat för Preview och Production. Klistra in värdena utan omgivande citattecken i Vercel. Serverhemligheter får aldrig ha prefixet `NEXT_PUBLIC_`. Konfigurera dessutom Custom SMTP och FaddeBo-mallarna enligt `SUPABASE_SMTP_AND_AUTH.md`.

```bash
npx vercel link
npx vercel env add NEXT_PUBLIC_SUPABASE_URL production
npx vercel env add NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY production
npx vercel env add SUPABASE_SECRET_KEY production
npx vercel env add SUPABASE_PROJECT_REF production
npx vercel env add APP_URL production
npx vercel env add APP_ENCRYPTION_KEY production
npx vercel env add SIGNING_OTP_PEPPER production
npx vercel env add CRON_SECRET production
npm run verify:auth
npx vercel deploy --prod
```
