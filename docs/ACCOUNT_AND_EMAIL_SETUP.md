# FaddeBo – konton, ägare, personal och e-post

## Kontotyper och dashboards

| Konto | Skapas av | Startsida | Huvudåtkomst |
|---|---|---|---|
| Ägare / superadmin | Första kontot skapas och bekräftas som vanligt, därefter promoveras det via SQL eller bootstrap | `/admin` | Full behörighet `*`, inklusive att skapa fler ägare och administratörer |
| Bolagsadmin | Skapas av ägaren under **Admin → Användare & roller** | `/admin` | Full verksamhetsadministration och användarhantering, men kan inte skapa nya ägare |
| Fastighetsvärd / förvaltare | Skapas av ägare eller behörig admin | `/admin` | Fastigheter, objekt, annonser, ansökningar, visningar, avtal, felanmälningar och arbetsorder |
| Bostadssökande | Självregistrering på `/skapa-konto` | `/mina-sidor` | Profil, favoriter, bevakningar, ansökningar och meddelanden |
| Hyresgäst | Befintlig person aktiveras via inbjudan eller får hyresgästroll genom avtal | `/mina-sidor` | Avtal, fakturor, boende, dokument och felanmälan |
| Entreprenör | Skapas under **Admin → Entreprenörer** | `/entreprenor` | Endast egna arbetsorder |

Publik självregistrering kan aldrig ge personal-, admin- eller ägarbehörighet.

## 1. Installera kontoflödet utan `supabase link`

Öppna **Supabase Dashboard → SQL Editor** och kör hela:

```text
supabase/manual/00_REPAIR_FADDEBO_AUTH_SCHEMA.sql
```

Filen är idempotent och kan köras flera gånger. Den:

- gör den gamla kolumnen `User.passwordHash` valfri;
- återställer standardvärden för `createdAt` och `updatedAt`;
- säkerställer organisationen och FaddeBo-varumärket;
- sätter `info@faddebo.se` som ordinarie kontaktadress;
- installerar alla systemroller i en migration, inte bara i `seed.sql`;
- tar bort gamla Bovaro/Fastighetsvärd-triggers som kan blockera **Authentication → Users → Add user**;
- installerar ett robust verifierat självregistreringsflöde;
- installerar `provision_staff_user` för Admin → Användare & roller;
- installerar `bootstrap_faddebo_owner` för första och ytterligare ägare.

Samma SQL finns som migration:

```text
supabase/migrations/20260804090000_faddebo_account_lifecycle.sql
```

Vid ett länkat projekt kan den i stället köras med:

```bash
npx supabase link --project-ref DIN_PROJECT_REF
npx supabase db push
```

## 2. Skapa första ägaren – rekommenderad väg

1. Kör SQL-fil 00.
2. Öppna `https://faddebo.se/skapa-konto`.
3. Skapa kontot med ägarens personliga e-postadress och bekräfta mejlet.
4. Öppna `supabase/manual/01_CREATE_FADDEBO_OWNER.sql`.
5. Ändra e-post, förnamn och efternamn i funktionsanropet.
6. Kör hela filen i SQL Editor.
7. Logga in igen. Kontot ska skickas till `/admin` och visa **Ägarkonto**.

Det går även att skapa Auth-användaren under **Authentication → Users → Add user** efter att SQL-fil 00 har körts. Aktivera då **Auto Confirm User** och kör sedan owner-filen.

Kör verifieringen:

```text
supabase/manual/02_VERIFY_FADDEBO_AUTH_AND_OWNER.sql
```

Alla kontroller ska visa `PASS`, `PASS_NULLABLE` eller `PASS_NOT_PRESENT`.

## 3. Skapa första ägaren via terminal

Lägg till följande tillfälligt i `.env.local`:

```dotenv
NEXT_PUBLIC_SUPABASE_URL="https://PROJECT_REF.supabase.co"
SUPABASE_SECRET_KEY="sb_secret_..."
BOOTSTRAP_OWNER_EMAIL="agare@faddebo.se"
BOOTSTRAP_OWNER_PASSWORD="byt-till-ett-unikt-losenord-minst-12-tecken"
BOOTSTRAP_OWNER_FIRST_NAME="Förnamn"
BOOTSTRAP_OWNER_LAST_NAME="Efternamn"
```

Kör:

```bash
npm run bootstrap:owner
```

Bootstrap-scriptet skapar eller reparerar Supabase Auth-användaren och anropar sedan den canonical SQL-funktionen. Scriptet skriver inte längre direkt till `Organization`, `Person`, `User` eller rolltabellerna.

Ta bort samtliga `BOOTSTRAP_OWNER_*` efter verifierad inloggning.

## 4. Skapa bolagsadmin, fastighetsvärd eller ytterligare ägare

1. Logga in som ägare.
2. Öppna **Admin → Användare & roller**.
3. Ange namn och e-post.
4. Välj roll:
   - **Ägare / superadmin** för ytterligare en ägare;
   - **Bolagsadmin** för administratör;
   - **Fastighetsvärd / förvaltare** för operativ fastighetsförvaltning.
5. Klicka **Skapa och skicka aktiveringsmejl**.

Systemet:

- skapar eller återanvänder endast en ofullständig Auth-användare;
- skapar Person, User och UserRole genom en server-only RPC;
- återställer databasen om en nyskapad Auth-användare inte kan provisioneras;
- skickar en länk där användaren väljer lösenord;
- låter endast en befintlig superadmin tilldela `superadmin` eller `org-admin`.

## 5. Självregistrering för bostadssökande

`/skapa-konto` skickar ett Supabase-bekräftelsemejl. När adressen bekräftas skapas:

- en `Person`;
- rollen `APPLICANT` i `PersonRole`;
- en aktiv app-profil i `User`.

Om e-postbekräftelse är avstängd i Supabase hanterar applikationen även den direkta sessionen konsekvent och skickar användaren till Mina sidor. I produktion ska e-postbekräftelse ändå vara aktiverad.

En e-postadress som redan är kopplad till en importerad person eller ett appkonto får inte automatiskt claima den personen. Använd då befintlig inbjudan, **Glömt lösenord** eller kontakta `info@faddebo.se`.

## 6. Glömt lösenord och aktiveringslänkar

Flödet finns på `/glomt-losenord`.

- Resend används när `RESEND_API_KEY` finns.
- Supabase Auth SMTP används som reserv.
- Även en Auth-användare vars app-profil tidigare misslyckats kan få en återställningslänk.
- Callbacken stöder både PKCE `code` och `token_hash`/OTP-länkar.
- Det nya lösenordet sparas endast i Supabase Auth.

Supabase Auth-inställningar:

```text
Site URL: https://faddebo.se
Redirect URL: https://faddebo.se/auth/callback
```

Aktivera Email/Password och e-postbekräftelse. Konfigurera anpassad SMTP med:

```text
Avsändarnamn: FaddeBo
Avsändaradress: info@faddebo.se
```

## 7. E-postmiljö

```dotenv
APP_URL="https://faddebo.se"
RESEND_API_KEY="re_..."
EMAIL_FROM="FaddeBo <info@faddebo.se>"
SUPPORT_EMAIL="info@faddebo.se"
PRIVACY_EMAIL="info@faddebo.se"
LEASING_EMAIL="info@faddebo.se"
FAULT_REPORT_EMAIL="felanmalan@faddebo.se"
```

Ta bort alla gamla kontaktvariabler från den tidigare domänen i Vercel. Aktiv ordinarie kontaktadress ska vara `info@faddebo.se`. Juridiskt bolagsnamn kan fortfarande vara Östgöta El Teknik AB.

## 8. Produktionskontroll

Kontrollera i denna ordning:

1. Kör SQL-fil 00 och 02.
2. Skapa en ny bostadssökande via `/skapa-konto`.
3. Bekräfta mejlet och kontrollera `/mina-sidor`.
4. Testa **Skicka bekräftelsemejlet igen**.
5. Testa **Glömt lösenord** och spara ett nytt lösenord.
6. Logga in som owner och öppna `/admin`.
7. Skapa en bolagsadmin.
8. Skapa en fastighetsvärd och kontrollera att kontot kan publicera en annons.
9. Kontrollera att sökande inte ser fakturor, avtal eller felanmälan innan personen blivit hyresgäst.
10. Kontrollera att hyresgäst ser avtal, fakturor och felanmälan.
