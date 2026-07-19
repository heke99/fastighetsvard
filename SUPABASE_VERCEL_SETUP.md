# Supabase + Vercel – produktionssetup

## 1. Skapa Supabase-projekt

Skapa ett projekt och spara databaslösenordet. Välj region nära användarna, exempelvis Europa.

## 2. Hämta anslutningar

I Supabase: **Project Settings → Database → Connection string**.

Använd:

- **Transaction pooler, port 6543** som `DATABASE_URL` i Vercel/runtime.
- **Session pooler, port 5432** som `DIRECT_URL` för Prisma Migrate om direkt IPv6-anslutning inte fungerar.

`DATABASE_URL` ska innehålla:

```text
?pgbouncer=true&connection_limit=1&sslmode=require
```

## 3. Hämta API-värden

I Supabase: **Project Settings → API**.

Kopiera:

- Project URL → `NEXT_PUBLIC_SUPABASE_URL`
- anon/public key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
- service_role key → `SUPABASE_SERVICE_ROLE_KEY`

Service role får endast användas server-side och får aldrig få prefixet `NEXT_PUBLIC_`.

## 4. Vercel Environment Variables

Lägg in för Production:

```env
DATABASE_URL=...
DIRECT_URL=...
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=...
SUPABASE_SERVICE_ROLE_KEY=...
APP_URL=https://DIN-DOMAN.SE
APP_ENCRYPTION_KEY=...
CRON_SECRET=...
RESEND_API_KEY=...
EMAIL_FROM=Östgöta El Teknik <noreply@DIN-VERIFIERADE-DOMAN.SE>
SUPPORT_EMAIL=info@ostgotaelteknik.se
EMAIL_LOG_LINKS=false
```

Generera hemligheter:

```bash
openssl rand -hex 32
openssl rand -base64 32
```

## 5. Kör första migreringen

Lokalt med `.env` satt:

```bash
npm ci
npx prisma generate
npx prisma migrate deploy
npm run typecheck
npm test
npm run build
```

Seed ska endast köras i en tom utvecklingsmiljö. Kör inte demo-seed i produktion utan att först ta bort standardkonton och standardlösenord.

## 6. Vercel

- Framework: Next.js
- Node.js: 22.x
- Install Command: `npm ci`
- Build Command: lämna standard eller använd `npm run vercel-build`
- Output Directory: lämna tom

`vercel.json` kör webhookkön var femte minut. Detta kräver en Vercel-plan som tillåter tätare cron än en gång per dag. På Hobby måste schemat ändras till exempelvis `0 3 * * *`.

## 7. E-post

Verifiera avsändardomänen i Resend och sätt `RESEND_API_KEY` samt `EMAIL_FROM`. Aktiverings- och återställningsmejl skickas nu på riktigt. I lokal utveckling loggas bara ett meddelande om e-postvariablerna saknas.

## 8. Säkerhetskontroll

- Lägg aldrig service role key i klientkod.
- Använd separat Supabase-projekt eller separat databas för Preview.
- Rotera nycklar vid misstänkt exponering.
- Kör inte `prisma migrate dev` mot produktion.
- Byt inte `APP_ENCRYPTION_KEY` utan plan för omkryptering.
