# FaddeBo – Supabase Auth, SMTP och e-postmallar

## Vad som använder vilken nyckel

Vanlig registrering, e-postbekräftelse, glömt lösenord och vanlig inloggning använder
`NEXT_PUBLIC_SUPABASE_URL` och `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY`.

`SUPABASE_SECRET_KEY` (eller äldre `SUPABASE_SERVICE_ROLE_KEY`) används endast i
serverkod för:

- att skapa och bjuda in ägare, admin, fastighetsvärdar och entreprenörer;
- att tilldela roller och skapa app-profiler;
- bootstrap/reparation av ett verifierat Auth-konto.

En saknad secret/service-role-nyckel orsakar alltså inte felaktigt lösenord vid vanlig
inloggning. Den gör däremot att Admin → Användare & roller inte kan skicka inbjudningar.
Nyckeln får aldrig heta `NEXT_PUBLIC_*` eller skickas till webbläsaren.

## Vercel – värden utan citattecken

I Vercels Environment Variables ska värdet skrivas direkt. Skriv exempelvis:

```text
APP_URL = https://faddebo.se
```

Skriv inte:

```text
APP_URL = "https://faddebo.se"
```

Projektet normaliserar nu av misstag inklistrade citattecken, men de ska ändå tas bort i
Vercel. Samma regel gäller Supabase-URL och nycklar.

Obligatoriska produktionsvariabler:

```text
APP_URL=https://faddebo.se
NEXT_PUBLIC_SUPABASE_URL=https://DIN_PROJECT_REF.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
SUPABASE_PROJECT_REF=DIN_PROJECT_REF
```

Äldre projekt kan använda `SUPABASE_SERVICE_ROLE_KEY` i stället för
`SUPABASE_SECRET_KEY`. Lägg endast in en av dem.

## Databas

Kör i Supabase SQL Editor, i ordning:

1. `supabase/manual/00_REPAIR_FADDEBO_AUTH_SCHEMA.sql`
2. `supabase/manual/03_APPLY_FADDEBO_AUTH_SMTP_LOGIN_HARDENING.sql`
3. `supabase/manual/01_CREATE_FADDEBO_OWNER.sql` när Auth-användaren finns
4. `supabase/manual/04_VERIFY_FADDEBO_AUTH_SMTP_LOGIN.sql`

Detta kräver inte `supabase link`.

Koden i detta repo förutsätter tabeller som `public."Organization"`, `public."User"`
och `public."Role"`. Om Vercel pekar på ett annat Supabase-projekt med ett annat schema
kommer Auth-lösenordet eventuellt att godkännas, men FaddeBo-profilen kan inte läsas.
Kör `npm run verify:auth` för att upptäcka fel projekt och saknade migrationer.

## Anpassad SMTP i Supabase

Öppna Supabase Dashboard → Authentication → SMTP Settings och aktivera Custom SMTP.
Använd uppgifterna från er SMTP-leverantör och följande avsändare:

```text
Sender name: FaddeBo
Sender email: info@faddebo.se
```

Kontrollera att SMTP-kontot eller domänen verkligen får skicka som
`info@faddebo.se`. Konfigurera SPF, DKIM och DMARC enligt leverantörens instruktioner.

Auth-mejl skickas nu av Supabase via denna SMTP-konfiguration:

- bekräftelse efter självregistrering;
- nytt bekräftelsemejl;
- personal- och entreprenörsinbjudan;
- återställning av lösenord;
- e-poständring och eventuell magic link.

`RESEND_API_KEY` behövs inte för Auth-mejlen. Resend kan fortfarande användas av andra
applikationsmejl som inte tillhör Supabase Auth.

## URL Configuration

Supabase Dashboard → Authentication → URL Configuration:

```text
Site URL: https://faddebo.se
```

Tillåt minst:

```text
https://faddebo.se/auth/confirm
https://faddebo.se/auth/callback
https://faddebo.se/aterstall-losenord
http://localhost:3000/auth/confirm
http://localhost:3000/auth/callback
http://localhost:3000/aterstall-losenord
```

Lägg till kontrollerade Vercel Preview-domäner separat när de används.

## FaddeBo-mallarna i Hosted Supabase

Hosted Supabase läser inte automatiskt mallfilerna från Git-repot. Öppna
Authentication → Email Templates och kopiera innehållet från följande filer:

| Supabase-mall | Ämne | Fil |
|---|---|---|
| Confirm signup | Bekräfta ditt FaddeBo-konto | `supabase/templates/confirmation.html` |
| Invite user | Aktivera ditt FaddeBo-konto | `supabase/templates/invite.html` |
| Reset password | Återställ ditt lösenord hos FaddeBo | `supabase/templates/recovery.html` |
| Magic link | Din inloggningslänk till FaddeBo | `supabase/templates/magic_link.html` |
| Change email | Bekräfta din nya e-postadress hos FaddeBo | `supabase/templates/email_change.html` |

Mallarna använder `TokenHash` och länkar till `/auth/confirm`. Den routen verifierar
engångstoken server-side, lagrar Supabase-sessionen i säkra cookies och skickar sedan
användaren till Mina sidor eller sidan där lösenord väljs.

Stäng av click tracking hos SMTP-leverantören för Auth-mejl om leverantören skriver om
länkarna.

## Flöden

### Bostadssökande

1. Personen skapar konto på `/skapa-konto`.
2. Supabase skickar FaddeBo-mallen Confirm signup via SMTP.
3. Länken verifierar e-postadressen via `/auth/confirm`.
4. Databastriggern skapar sökandeprofil och aktiverar kontot.
5. Personen kan logga in och öppna `/mina-sidor`.

### Admin eller fastighetsvärd

1. Ägaren öppnar Admin → Användare & roller.
2. Systemet använder secret/service-role-nyckeln och `inviteUserByEmail`.
3. Supabase skickar FaddeBo-mallen Invite user via SMTP.
4. En pending app-profil skapas med vald roll men är inaktiv.
5. Mottagaren klickar länken, verifieras och väljer lösenord.
6. Triggern aktiverar den redan tilldelade rollen. En publik registrering kan aldrig
   skapa admin- eller ägarbehörighet.

### Glömt lösenord

1. Personen anger e-post på sidan Glömt lösenord.
2. Supabase skickar Recovery-mallen via SMTP.
3. `/auth/confirm` skapar recovery-sessionen.
4. Personen väljer ett nytt lösenord på `/aterstall-losenord`.

## Verifiering

Lokalt, med `.env.local`:

```bash
npm run verify:auth
npm run lint
npm run typecheck
npm test
npm run build
```

Verifieringen visar uttryckligen om secret/service-role-nyckeln är ogiltig, om fel
Supabase-projekt används eller om FaddeBos PascalCase-tabeller/migrationer saknas.
