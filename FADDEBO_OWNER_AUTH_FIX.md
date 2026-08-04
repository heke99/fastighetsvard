# FaddeBo – owner, auth och e-postfix

## Varför felet uppstod

Databasen innehöll legacy-drift från en äldre Prisma-installation:

- `Organization.updatedAt` var `NOT NULL` utan defaultvärde.
- `User.passwordHash` var fortfarande obligatoriskt trots att lösenord hanteras av Supabase Auth.

Det blockerade både bootstrap, självregistrering, personalaktivering och andra flöden som skapar en rad i `public."User"`.

## Skapa första ägaren utan `supabase link`

1. Kör `supabase/manual/00_REPAIR_FADDEBO_AUTH_SCHEMA.sql` i Supabase SQL Editor.
2. Skapa användaren under **Authentication → Users → Add user** och välj **Auto Confirm User**.
3. Öppna `supabase/manual/01_CREATE_FADDEBO_OWNER.sql`.
4. Ändra `v_owner_email`, `v_owner_first_name` och `v_owner_last_name`.
5. Kör hela filen i SQL Editor.
6. Verifieringsfrågan längst ner ska visa `role_slug = superadmin` och `permission = *`.

Samma ägarfil kan köras igen för en andra ägare efter att en ny bekräftad Auth-användare har skapats.

## Glömt lösenord

- Med `RESEND_API_KEY` skapas Supabase recovery-länken av servern och skickas från `FaddeBo <info@faddebo.se>` via Resend.
- Utan `RESEND_API_KEY` används Supabase Auth SMTP som reserv.
- `https://faddebo.se/auth/callback` måste finnas under Supabase **Authentication → URL Configuration → Redirect URLs**.
- Resend-domänen `faddebo.se` eller Supabase SMTP måste vara korrekt verifierad/konfigurerad.

## Canonical e-post

- Allmän kontakt, uthyrning och integritet: `info@faddebo.se`
- Felanmälan: `felanmalan@faddebo.se`
- UI-konfigurationen ignorerar gamla/stale kontaktvariabler och visar alltid de canonical adresserna.
