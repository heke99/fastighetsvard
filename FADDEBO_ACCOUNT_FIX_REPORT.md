# FaddeBo – leveransrapport för konto- och adminflöde

## Levererad målbild

- Bostadssökande skapar konto på `/skapa-konto`, bekräftar e-post och får sökandedashboard på `/mina-sidor`.
- Första ägaren skapas genom vanlig registrering eller Supabase Auth och promoveras med `bootstrap_faddebo_owner`.
- Ägaren får `superadmin` och behörigheten `*` samt skickas till `/admin`.
- Ägaren kan skapa ytterligare ägare, bolagsadmin och fastighetsvärd under **Admin → Användare & roller**.
- Personal får en aktiveringslänk och väljer sitt eget lösenord.
- Glömt lösenord stöder Resend och Supabase SMTP som reserv.
- Gamla användardefinierade Bovaro/Fastighetsvärd-triggers på `auth.users` tas bort så att Supabase **Add user** inte blockeras.
- Legacykraven `Organization.updatedAt` och `User.passwordHash` repareras.
- Ordinarie kontaktadress är `info@faddebo.se`; felanmälan är `felanmalan@faddebo.se`.

## Installationsordning

1. Kör `supabase/manual/00_REPAIR_FADDEBO_AUTH_SCHEMA.sql` i Supabase SQL Editor.
2. Skapa och bekräfta ägarkontot.
3. Kör `supabase/manual/01_CREATE_FADDEBO_OWNER.sql`.
4. Kör `supabase/manual/02_VERIFY_FADDEBO_AUTH_AND_OWNER.sql`.
5. Logga in som ägare och skapa personal under **Admin → Användare & roller**.

## Utförda kontroller

- `npm run verify:accounts`: 13 av 13 godkända.
- `npm run lint`: godkänd, 33 canonical migrationer.
- TypeScript/TSX-syntax: 170 filer, 0 syntaxfel.
- Statiska hardeningtester: 21 av 21 godkända.
- SQL-struktur och synk mellan migration och manuell installationsfil: godkänd.

Full dependency-installation och Next.js-build måste köras lokalt eftersom körmiljöns interna npm-spegel saknade paketfilen för `zod@3.25.76`.
