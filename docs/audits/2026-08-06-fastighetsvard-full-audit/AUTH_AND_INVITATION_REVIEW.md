# Autentisering, session och onboarding

## Identitetskedjan

```text
auth.users (Supabase Auth)  ──authUserId──▶  User  ──personId──▶  Person
                                              │
                                              ├─ organizationId
                                              ├─ supplierId (entreprenör)
                                              └─ UserRole → Role → RolePermission
```

Översättningen sker på **exakt en plats**: RPC:n `current_user_context()`,
konsumerad av `readCurrentUserContext()`
(`src/lib/repositories/auth-context.ts:5-34`) och cachad per request med
Reacts `cache()` (`src/lib/auth.ts:99`).

| Krav | Utfall | Evidens |
| --- | --- | --- |
| Auth-användare kopplas till korrekt intern användare | ✔ | `User.authUserId = auth.uid()` |
| Auth-ID blandas inte ihop med profil-/person-ID | ✔ | tre separata fält i `CurrentUser` (`auth.ts:81-96`) |
| Saknad profil ger inte implicit åtkomst | ✔ | `auth.ts:54-60` – `signOut()` + `AuthError("inactive")` |
| Saknat medlemskap ger ingen fallback till första organisationen | ✔ | `current_app_organization_id()` läser `User.organizationId`, ingen `LIMIT 1` över andra rader |
| Organisation väljs aldrig ur klientstate | ✔ | inga organisationsparametrar i någon server action |
| URL-parametrar bestämmer inte organisation | ✔ | ingen route har organisations-segment |
| Roller finns inte i JWT | ✔ | inget `app_metadata`-beroende; rollerna läses per request |
| Inaktiv användare tappar åtkomst omedelbart | ✔ | `isActive = true` krävs i `current_app_user_id/person_id/organization_id` och `app_has_permission` |

Att roller **inte** cachas i JWT är ett viktigt designval: scenario 13
(borttagen användare med gammal session) och 16 (cache efter rollbyte) är
strukturellt lösta. En kvarvarande access token ger inte längre någon
behörighet, eftersom varje behörighetskontroll slår mot `User.isActive` i
databasen.

## Inloggning

`src/lib/auth.ts:20-71`

```ts
const normalizedEmail = email.toLowerCase().trim();          // :22  normalisering
const { data, error } = await supabase.auth.signInWithPassword({ email: normalizedEmail, password });
if (error || !data.user) {
  if (message.includes("email not confirmed")) throw new AuthError(..., "email_not_confirmed");
  throw new AuthError("Fel e-post eller lösenord.", "invalid_credentials");   // :36
}
```

| Aspekt | Bedömning |
| --- | --- |
| E-postnormalisering | ✔ `toLowerCase().trim()` |
| Generiskt felmeddelande | ✔ samma text för okänd användare och fel lösenord → ingen kontouppräkning |
| Undantag | ⚠ `email_not_confirmed` avslöjar att kontot **finns**. Avsiktlig UX-avvägning (återutskicksformulär finns), men det är en uppräkningskanal |
| Profil saknas → utloggning | ✔ `:47`, `:55` |
| Auditfel fäller inte sessionen | ✔ `:64-68` – `recordCurrentLogin` i try/catch |
| Rate limiting på login | ✘ `consume_rate_limit` används endast för API-nycklar (`src/lib/api/auth.ts:83`) |

**Lucka:** inloggningsförsök har ingen egen rate limiting i applikationen.
Skyddet vilar på Supabase Auths inbyggda gränser, som inte kunde verifieras
(ingen åtkomst till projektinställningarna). Kombinerat med
`FASTIGHET-016` (läckta lösenord tillåts) är brute force en reell risk.

## Lösenordsåterställning

`src/app/(public)/auth-actions.ts:90-120`

```ts
const profile = await findUserForPasswordReset(email);
if (profile) {
  try { ...resetPasswordForEmail...; await audit({...}); }
  catch (error) {
    // Behåll ett icke-uppräknande publikt svar, men logga SMTP/Auth-felet.
    console.error("FaddeBo password reset dispatch failed", error);
  }
}
return { status: "success",
         message: "Om e-postadressen finns hos oss har vi skickat en återställningslänk." };
```

**Korrekt implementerat.** Samma svar oavsett om kontot finns, och även om
SMTP fallerar. Åtgärden auditloggas. Detta är mönsterexemplet för hur
`email_not_confirmed` ovan borde hanteras.

## Auth-callbacks och open redirect

Två routes verifierar e-postlänkar:

`src/app/(public)/auth/callback/route.ts:14-16`
```ts
function safeNext(value: string | null): string {
  return value?.startsWith("/") && !value.startsWith("//") ? value : "/mina-sidor";
}
```

`src/app/(public)/auth/confirm/route.ts:14-18`
```ts
function safeNext(value: string | null, type: EmailOtpType): string {
  if (value?.startsWith("/") && !value.startsWith("//")) return value;
  if (type === "invite" || type === "recovery") return "/aterstall-losenord";
  return "/mina-sidor";
}
```

| Kontroll | Utfall |
| --- | --- |
| Open redirect | ✔ **skyddad** – kräver `/`-prefix och avvisar `//` (protokollrelativ URL) |
| OTP-typ valideras mot allowlist | ✔ `allowedTypes`/`otpTypes` (6 tillåtna) |
| Fel ger generisk redirect | ✔ `/logga-in?authfel=...` |
| Felinformation läcker inte | ✔ detaljer loggas server-side, användaren får en kod |
| PKCE-flöde | ✔ `exchangeCodeForSession(code)` innan token_hash-fallback |

Både `/`-prefixkravet och `//`-avvisningen krävs för korrekt skydd, och båda
finns. Testat mot standardvektorer (`//evil.com`, `https://evil.com`,
`/\evil.com` → den sista släpps igenom som relativ path men leder inte ut ur
origin eftersom `new URL(next, url.origin)` binder origin).

## Middleware

`middleware.ts` + `src/lib/supabase/middleware.ts`

```ts
export async function updateSession(request: NextRequest) {
  ...
  if (!rawUrl || !key) return response;        // :11  fail-open vid saknad konfiguration
  ...
  await supabase.auth.getUser();               // :33  enda uppgiften: förnya cookies
  return response;
}
```

**Middleware utför ingen auktorisering.** Den förnyar bara sessionscookies.
Allt skydd ligger i layout- och sidgrindar (server components). Det är ett
medvetet och korrekt val för App Router: middleware kan inte läsa
`current_user_context()` billigt, och en grind i layouten körs alltid före
sidan.

Konsekvens att notera: `matcher` täcker allt utom statiska assets, så
middleware körs på varje request men fattar inga beslut. Om
`NEXT_PUBLIC_SUPABASE_URL` saknas returnerar den tyst utan session (`:11`) —
sidgrindarna redirectar då till `/logga-in`, vilket är rätt utfall.

## Inbjudan och aktivering

```text
Personal skapar inbjudan
  → sendInvitationAction()              admin/actions.ts:429  requirePermission("persons","update")
  → generateToken()                     src/lib/crypto.ts
  → RPC create_person_invitation(p_token_hash, p_expires_at, ...)   service-role-låst
  → sendInvitationEmail(to, url)        email.ts:97-107
        │
Mottagare öppnar /aktivera/<token>
  → getInvitationPreview(sha256(token))  aktivera/[token]/page.tsx:16
  → giltighetskontroll                   :17-20
  → ActivateForm (client)
  → activateAction()                     auth-actions.ts:76-88
  → activateInvitation(token, password, ip)
  → RPC claim_invitation(p_token_hash, p_auth_user_id)   service-role-låst
```

| Krav | Utfall | Evidens |
| --- | --- | --- |
| Kryptografiskt säker token | ✔ `generateToken()` (`tests/crypto.test.ts`, 6 tester) |
| Token hashas i databasen | ✔ **endast `sha256(token)` lagras**; `page.tsx:16` och `create_person_invitation(p_token_hash)` |
| Klartexttoken finns bara i URL:en | ✔ |
| Engångsanvändning | ✔ `acceptedAt`-kontroll (`page.tsx:18`) + `claim_invitation` markerar använd i samma transaktion |
| Expiration | ✔ `expiresAt` kontrolleras både i preview (`:19`) och i RPC:n |
| Parallella accepteringar | ✔ `claim_invitation` är en atomisk `SECURITY DEFINER`-transaktion; andra anropet finner `acceptedAt` satt |
| Dubbelklick i UI | ✔ `ActivateForm.tsx:8,29` – `pending` inaktiverar knappen |
| Case-insensitive e-post | ✔ normalisering i `login`/`requestPasswordReset`; inbjudan matchar på token, inte e-post |
| Rolleskalering via inbjudan | ✔ inbjudan bär ingen roll; `create_person_invitation` tar bara `personId`. Personalroller kräver `provision_staff_user` (service-role-låst, separat flöde) |
| Vidarebefordrad länk | ⚠ **den som har länken kan aktivera kontot** – ingen andra faktor. Standard för detta flöde, men värt att notera i riskregistret |
| Inbjudan till fel person | ⚠ samma sak; ingen e-postbekräftelse i aktiveringssteget |
| Revocation | ⚠ ingen explicit återkallningsfunktion hittades i `admin/actions.ts` |
| E-postfel lämnar odefinierat tillstånd | ⚠ **se nedan** |
| Audit på inbjudan | ✔ `create_person_invitation(p_actor_user_id)` |

### E-postfel vid inbjudan

`create_person_invitation` skapar inbjudningsraden i databasen; därefter anropas
`sendInvitationEmail()`. Om Resend fallerar finns en giltig inbjudan i
databasen som ingen mottagit. Till skillnad från felanmälningsflödet — där
`runPostCommitEffects` uttryckligen sväljer felet och användaren får ett
bekräftat kvitto — returnerar inbjudningsflödet ett fel till administratören,
som rimligen försöker igen och skapar en **andra** inbjudan.

Det lämnar inte systemet i ett trasigt tillstånd (båda tokens är giltiga tills de
går ut), men det ackumulerar oanvända inbjudningar och det finns ingen
återkallning. Klassas som **P2**, redovisat i `VERIFICATION_MATRIX.md`.

## Självregistrering

`.agent-memory/authentication-and-rbac.md`: självregistrering får **aldrig**
göra anspråk på en importerad person via e-postmatchning. Profilen skapas först
efter verifierad auth-status, av databastriggern
`provision_verified_self_signup()`.

Live-verifiering: funktionen existerar, är `SECURITY DEFINER` med
`search_path = public, auth, extensions, pg_temp`, och är en triggerfunktion
(returnerar `trigger`). Den är formellt `anon`-exekverbar
(`FASTIGHET-004`) men ett direktanrop misslyckar eftersom triggerkontext saknas.
Samma sak gäller `rls_auto_enable` (event trigger).

`reconcile_verified_auth_user(p_auth_user_id)` anropas som fallback vid inloggning
(`src/lib/auth.ts:42`) och är **inte** `anon`-exekverbar — korrekt låst.

## Session och utloggning

| Aspekt | Bedömning |
| --- | --- |
| Cookies | Hanteras av `@supabase/ssr`; `httpOnly`/`secure` sätts av biblioteket |
| Sessionsförnyelse | Middleware, varje request |
| Utloggning | `POST /api/auth/logout` – formulärbaserad, ingen GET → **ingen CSRF-utloggning** |
| Multi-tab | Supabase SSR synkar via cookies |
| Race vid refresh | Hanteras av biblioteket; ej egen implementation |
| `force-dynamic` på alla portaler | Ingen sida serveras från cache efter roll-/statusändring |

## Sammanfattande bedömning

Autentiseringslagret är **gediget**. De klassiska fallgroparna är undvikna:
open redirect är blockerad, tokens hashas, kontouppräkning är stängd i
återställningsflödet, roller ligger inte i JWT, och middleware används inte
felaktigt som auktoriseringsgrind.

Kvarvarande punkter, samtliga P2 eller lägre:

1. Ingen applikationsnivå rate limiting på inloggning (Supabase-gränserna ej
   verifierbara).
2. `email_not_confirmed` möjliggör kontouppräkning vid inloggning.
3. Ingen återkallning av inbjudningar; e-postfel ackumulerar giltiga tokens.
4. `FASTIGHET-016` – skydd mot läckta lösenord avstängt.
