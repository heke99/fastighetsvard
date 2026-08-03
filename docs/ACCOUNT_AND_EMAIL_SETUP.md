# FaddeBo – konton, roller och e-post

Den här guiden beskriver den färdiga kontostrukturen för `faddebo.se` och vilka externa inställningar som måste göras i Supabase, Resend och Vercel.

## Kontotyper

| Kontotyp | Hur kontot skapas | Standardyta | Huvudbehörighet |
|---|---|---|---|
| Ägare / superadmin | Engångsbootstrap från terminal | `/admin` | Full behörighet (`*`), skapar personal och roller |
| Fastighetsvärd / förvaltare | Skapas av ägarkontot under **Admin → Användare & roller** | `/admin` | Fastigheter, objekt, annonser, ansökningar, avtal, felanmälningar och arbetsorder |
| Bostadssökande | Självregistrering på `/skapa-konto` och e-postbekräftelse | `/mina-sidor` | Profil, favoriter, bevakningar, ansökningar och meddelanden |
| Hyresgäst | Sökandekonto med hyresgästroll eller importerad hyresgäst som aktiverar sin inbjudan | `/mina-sidor` | Sökandefunktioner samt avtal, fakturor, boende och felanmälningar |
| Entreprenör | Skapas under **Admin → Entreprenörer** med valfritt portalkonto | `/entreprenor` | Endast egna tilldelade arbetsorder |

Publik självregistrering kan inte skapa personal-, fastighetsvärds- eller ägarbehörighet.

## 1. Databas och migration

Kör samtliga canonical migrationer, inklusive:

```text
supabase/migrations/20260803230000_faddebo_accounts_and_roles.sql
```

Migrationen:

- sätter `info@faddebo.se` som ordinarie kontakt- och dataskyddsadress;
- behåller `felanmalan@faddebo.se` för felanmälningar i applikationskonfigurationen;
- döper rollen `property-manager` till **Fastighetsvärd / förvaltare**;
- begränsar ägar- och bolagsadminroller till befintlig superadmin;
- kräver behörigheten `users:create` för att skapa personal.

Vid ny databas:

```bash
supabase db push
# eller lokalt
supabase db reset
```

## 2. Skapa första ägarkontot

Lägg följande endast tillfälligt i `.env.local`:

```dotenv
BOOTSTRAP_OWNER_EMAIL="info@faddebo.se"
BOOTSTRAP_OWNER_PASSWORD="ett-unikt-losenord-med-minst-12-tecken"
BOOTSTRAP_OWNER_FIRST_NAME="Förnamn"
BOOTSTRAP_OWNER_LAST_NAME="Efternamn"
```

Kör därefter:

```bash
npm run bootstrap:owner
```

Verifiera att kontot kan logga in på `https://faddebo.se/logga-in` och öppna `/admin`. Ta sedan bort samtliga `BOOTSTRAP_OWNER_*` från `.env.local` och från Vercel. Bootstrapkommandot är idempotent och kan användas för att reparera ägarkontot, men uppgifterna ska inte ligga kvar permanent.

## 3. Skapa fastighetsvärd

1. Logga in med ägarkontot.
2. Öppna **Administration → Användare & roller**.
3. Ange namn och e-post.
4. Välj rollen **Fastighetsvärd / förvaltare**.
5. Klicka **Skapa och skicka aktiveringsmejl**.

Systemet skapar kontot atomiskt, genererar en engångslänk och skickar ett mejl där fastighetsvärden väljer lösenord. Ett vanligt administratörskonto kan inte tilldela `superadmin` eller `org-admin`; det kan endast ägarkontot göra.

## 4. Supabase Auth

I Supabase Dashboard under **Authentication → URL Configuration**:

```text
Site URL: https://faddebo.se
Redirect URL: https://faddebo.se/auth/callback
```

Lägg även till eventuell Vercel Preview-URL separat för testmiljön. Wildcards bör endast användas för kontrollerade previewdomäner.

Under **Authentication → Providers → Email**:

- aktivera Email/Password;
- kräv e-postbekräftelse för nya användare;
- stäng inte av bekräftelsen, eftersom applikationen avsiktligt stoppar självregistrering när verifiering saknas.

Konfigurera anpassad SMTP i Supabase så att registreringsbekräftelser skickas som FaddeBo och inte från en standardavsändare. Använd:

```text
Avsändarnamn: FaddeBo
Avsändaradress: info@faddebo.se
```

Bekräftelselänken går till `/auth/callback` och därefter till sökandens Mina sidor.

## 5. Resend och applikationsmejl

Verifiera domänen `faddebo.se` hos Resend och konfigurera DNS-posterna som Resend visar. Lägg sedan in följande i Vercel:

```dotenv
RESEND_API_KEY="re_..."
EMAIL_FROM="FaddeBo <info@faddebo.se>"
SUPPORT_EMAIL="info@faddebo.se"
PRIVACY_EMAIL="info@faddebo.se"
LEASING_EMAIL="info@faddebo.se"
FAULT_REPORT_EMAIL="felanmalan@faddebo.se"
APP_URL="https://faddebo.se"
```

Resend används av applikationen för personalaktivering, återställning av lösenord och andra systemmejl. Supabase SMTP används för Supabase egna registreringsbekräftelser.

## 6. Kontrollflöden före publicering

Verifiera följande i produktionslik testmiljö:

1. Sökande skapar konto och kan inte logga in före e-postbekräftelse.
2. Bekräftelselänken öppnar `/mina-sidor` och skapar korrekt sökandeprofil.
3. **Skicka bekräftelsemejlet igen** fungerar.
4. **Glömt lösenord** skickar länk och kräver att lösenordet upprepas.
5. Ägarkontot går till `/admin` efter inloggning och ser hela administrationen.
6. Ägarkontot skapar en fastighetsvärd som får aktiveringsmejl och kan publicera annonser.
7. Sökande ser inte avtal, fakturor eller felanmälan innan personen är hyresgäst.
8. Hyresgäst ser avtal, fakturor, boende och felanmälan.
9. Entreprenörskonto går till `/entreprenor` och ser endast den egna leverantörens arbetsorder.
10. Publik navigation innehåller inte **Till salu** eller **Parkeringar**.
11. Ordinarie kontakt går till `info@faddebo.se` och felanmälningar till `felanmalan@faddebo.se`.

## 7. Säkerhetsregler

- Lägg aldrig `SUPABASE_SECRET_KEY`, service-role-nyckel eller bootstraplösenord i klientkod.
- Låt endast serverkod skapa personalanvändare.
- Behåll e-postverifiering för självregistrering.
- Ta bort bootstrapvariabler efter första verifierade inloggningen.
- Ge fastighetsvärdar rollen `property-manager`; ge inte `superadmin` i onödan.
