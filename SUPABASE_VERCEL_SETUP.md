# Supabase-native + Vercel

## 1. Skapa Supabase-projektet

Välj en europeisk region. I **Project Settings → API** kopierar du:

- Project URL
- Publishable key
- Secret key

Legacy `anon` och `service_role` fungerar som fallback, men projektet är
förberett för Supabases nyare publishable/secret-nycklar.

## 2. Lokala miljövariabler

```bash
cp .env.example .env.local
```

Minimikrav:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
APP_URL=http://localhost:3000
APP_ENCRYPTION_KEY=64_HEX_TECKEN
CRON_SECRET=MINST_16_SLUMPMÄSSIGA_TECKEN
```

Generera hemligheter:

```bash
openssl rand -hex 32
openssl rand -base64 32
```

## 3. Applicera databasen

### Alternativ A – Supabase CLI

```bash
npm ci
npx supabase login
npx supabase link --project-ref DIN_PROJECT_REF
npx supabase db push
```

Om du får `Cannot find project ref` är projektet inte länkat. Kör kommandot ovan med project ref från Supabase Project Settings.

### Alternativ B – SQL Editor utan länkning

För att reparera kontoschemat och skapa den första ägaren behöver du inte länka CLI:n. Använd dessa två filer i **Supabase Dashboard → SQL Editor**:

```text
supabase/manual/00_REPAIR_FADDEBO_AUTH_SCHEMA.sql
supabase/manual/01_CREATE_FADDEBO_OWNER.sql
```

Kör först `00_REPAIR_FADDEBO_AUTH_SCHEMA.sql`. Skapa därefter Auth-användaren under **Authentication → Users → Add user**, välj **Auto Confirm User**, och kör slutligen `01_CREATE_FADDEBO_OWNER.sql` med samma e-post i `v_owner_email`.

Canonical migrationerna skapar:

- hela fastighetsmodellen
- constraints och index
- koppling mellan `auth.users` och appens `User`
- RLS på alla applikationstabeller
- publika katalogpolicies
- privata Storage-buckets för dokument och felanmälningar
- publik bucket för fastighetsmedia

Grunddata körs från `supabase/seed.sql`. Den skapar organisation och
systemroller men inga demokonton eller standardlösenord.

## 4. Skapa första superadmin

Rekommenderad väg är SQL-filen:

```text
supabase/manual/00_REPAIR_FADDEBO_AUTH_SCHEMA.sql
supabase/manual/01_CREATE_FADDEBO_OWNER.sql
```

Den reparerar både äldre `updatedAt`-defaultvärden och en eventuell legacy-kolumn `User.passwordHash`, därefter kopplas den bekräftade Auth-användaren till rollen `superadmin` med behörigheten `*`.

Terminalbootstrap finns kvar som reserv:

```env
BOOTSTRAP_OWNER_EMAIL=info@faddebo.se
BOOTSTRAP_OWNER_PASSWORD=ett-mycket-starkt-lösenord
BOOTSTRAP_OWNER_FIRST_NAME=Förnamn
BOOTSTRAP_OWNER_LAST_NAME=Efternamn
```

```bash
npm run bootstrap:owner
```

Ta bort bootstrapvariablerna efter verifierad inloggning.

## 5. Supabase Auth-inställningar

I **Authentication → URL Configuration**:

- Site URL: produktionsdomänen
- Redirect URL lokalt: `http://localhost:3000/auth/callback`
- Redirect URL produktion: `https://DIN-DOMAN.SE/auth/callback`
- Lägg även till Vercels preview-domän om preview-inloggning ska fungera

Aktivera e-post/lösenord som provider. Lägg till `https://faddebo.se/auth/callback` som tillåten redirect. Glömt lösenord använder Resend när `RESEND_API_KEY` finns och faller annars tillbaka till Supabase Auth SMTP. Minst en av dessa leveransvägar måste därför vara korrekt konfigurerad.

## 6. Vercel Environment Variables

Sätt följande för Production:

```env
NEXT_PUBLIC_SUPABASE_URL=https://PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
APP_URL=https://DIN-DOMAN.SE
APP_ENCRYPTION_KEY=...
CRON_SECRET=...
RESEND_API_KEY=re_...
EMAIL_FROM=FaddeBo <info@faddebo.se>
SUPPORT_EMAIL=info@faddebo.se
PRIVACY_EMAIL=info@faddebo.se
LEASING_EMAIL=info@faddebo.se
FAULT_REPORT_EMAIL=felanmalan@faddebo.se
EMAIL_LOG_LINKS=false
```

Markera `SUPABASE_SECRET_KEY`, `APP_ENCRYPTION_KEY`, `CRON_SECRET` och
`RESEND_API_KEY` som känsliga. Lägg aldrig secret key i en variabel med
`NEXT_PUBLIC_`.

## 7. Vercel build

- Framework: Next.js
- Node.js: 22.x
- Install Command: `npm ci`
- Build Command: `npm run vercel-build`
- Output Directory: tom

Databasmigrationer körs separat med Supabase CLI innan deployment. Vercel ska
inte ändra databasschemat under varje build.

## 8. Cron

`vercel.json` anropar:

```text
GET /api/internal/webhooks/process
```

Vercel skickar `Authorization: Bearer <CRON_SECRET>`. Schemat är var femte
minut och kräver en Vercel-plan som tillåter den frekvensen. På Hobby kan det
ändras till exempelvis `0 3 * * *`.

## 9. Kontroll före release

```bash
npm run typecheck
npm test
npm run build
```

Kontrollera dessutom:

- Supabase migration history är grön
- RLS är aktiverat på alla publika tabeller
- produktionsdomänen finns i Auth redirect URLs
- Resend-domänen är verifierad
- inga bootstrap-lösenord finns i Git eller Vercel
- secret key förekommer inte i klientbundles
