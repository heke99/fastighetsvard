# UI, portaler och konsekvens

> **Metodbegränsning.** Ingen browserdriven verifiering kunde göras (ingen
> körande app, ingen Playwright-svit). Bedömningarna nedan är **statisk
> kodgranskning**. Kontrastvärden, faktiskt fokusbeteende och skärmläsarutfall
> är därför `NOT VERIFIED`.

## Portalöversikt

| Portal | Rutt | Grind | Sidor |
| --- | --- | --- | --- |
| Publik webb | `/` | ingen | 22 |
| Sökande/hyresgäst | `/mina-sidor` | `defaultDashboardForRoles() === "/mina-sidor"` | 17 |
| Administration | `/admin` | `isStaffAccount()` + per sida `hasPermission()` | 18 |
| Entreprenör | `/entreprenor` | `isContractorAccount()` + `supplierId` | 1 |

Det finns **ingen separat superadminportal** — superadmin är `/admin` med
wildcard-permission `*`. Det är konsekvent med enorganisationsmodellen.

## Grindmönstret

Samtliga tre skyddade portaler följer samma mönster i sin layout:

```tsx
// src/app/admin/layout.tsx:12-15
const user = await getCurrentUser();
if (!user) redirect("/logga-in?next=/admin");
if (!isStaffAccount(user.roleSlugs)) redirect(defaultDashboardForRoles(user.roleSlugs));
```

```tsx
// src/app/(portal)/mina-sidor/layout.tsx:10-13
const user = await getCurrentUser();
if (!user) redirect("/logga-in?next=/mina-sidor");
const dashboardHref = defaultDashboardForRoles(user.roleSlugs);
if (dashboardHref !== "/mina-sidor") redirect(dashboardHref);
```

```tsx
// src/app/entreprenor/layout.tsx:11-18
if (!user) redirect("/logga-in?next=/entreprenor");
if (!isContractorAccount(user.roleSlugs)) redirect(defaultDashboardForRoles(user.roleSlugs));
if (!user.supplierId) redirect("/?kontofel=entreprenor-saknar-leverantor");
```

**Bra:** alla tre använder samma `defaultDashboardForRoles()` för omdirigering,
vilket eliminerar redirect-loopar mellan portalerna. Entreprenörslayouten har
dessutom en explicit loopbrytare för felkonfigurerade konton (`:17-18`) — en
detalj som ofta glöms.

**Är dolt UI enda behörighetskontrollen?** Nej. Varje admin-sida gör en egen
kontroll:

```tsx
// src/app/admin/hyresgaster/page.tsx:15-18
const user = await getCurrentUser();
if (!user?.organizationId || !hasPermission(user.permissions, "persons", "read")) {
  redirect("/admin");
}
```

```tsx
// src/app/admin/revisionslogg/page.tsx:14-17
if (!user?.organizationId || !hasPermission(user.permissions, "audit", "read")) {
  redirect("/admin");
}
```

Och varje mutation kontrolleras separat — 26 `requirePermission()`-anrop i
`src/app/admin/actions.ts`. Dolda knappar (`canImport`, `canInvite`,
`canCreateTenant`, rad 23-25) är rent kosmetiska.

**Undantaget** är `MaintenanceComment.isInternal`, där filtreringen bara finns i
frågan och inte i radgränsen (`FASTIGHET-022`).

## Konsekvens

| Aspekt | Bedömning |
| --- | --- |
| Sidomenyer | ✔ `AdminNav`, `PortalNav`, `SiteHeader` är delade komponenter |
| Rollnamn | ✔ `getRoleDisplayNames(roleSlugs, roleNames)` – exakta namn från DB, inte hårdkodade etiketter |
| Statusnamn | ✔ `StatusBadges.tsx` + `email.ts:186-202` täcker alla 15 `MaintenanceStatus`-värden |
| Samma datakälla för samma information | ✔ portalen läser via `portal-records.ts`, admin via `admin-records.ts`; båda mot samma tabeller |
| Organisationskontext | ✔ alltid ur `current_user_context()` |
| Fastighetskontext | ⚠ `Building` hoppas över (`FASTIGHET-017`) — byggnadsgrupperade vyer blir tomma |
| Språk | ✔ genomgående svenska, inkl. felmeddelanden och e-post |

`npm run verify:consistency` (27 kontroller) verifierar aktivt att
personalportalen och hyresgästportalen visar samma bilagor, att objektvyn visar
både hyresgäst och medhyresgäst, och att annonsmedia visas publikt.

## Tillstånd och formulär

| Aspekt | Utfall |
| --- | --- |
| Laddningsstatus | ✔ `useActionState` → `pending` |
| Felstatus | ✔ `state.status === "error"` med `role="alert"` |
| Fältfel | ✔ `state.fieldErrors[...]` med `.form-error` |
| Dubbelsubmit | ✔ `disabled={pending}` – verifierat i `MaintenanceForm.tsx:130` och `ActivateForm.tsx:29` |
| Bekräftelsedialoger | ⚠ ej verifierat för destruktiva åtgärder (t.ex. radering av API-nyckel) |
| Optimistic updates | – används inte; full omladdning efter action |
| Skeleton states | ✘ inga `loading.tsx`-filer hittades |
| Suspense-gränser | ✘ inga |
| Stale data | ✔ eliminerat av `force-dynamic` |
| Back navigation | ✔ redirect-baserat flöde, inga POST-tillbaka-problem |
| Deep links | ✔ `?next=`-parametern bevaras och saneras (`safeNext`) |
| Felaktiga redirects | ✔ open redirect blockerad |

**Saknade `loading.tsx`** är den tydligaste UX-luckan: eftersom varje sida är
`force-dynamic` och gör minst en databasrundtur (`current_user_context()`) plus
domänfrågor, får användaren ingen visuell återkoppling under serverrendering.
Klassas som P3.

## Tillgänglighet (statisk granskning)

| Kontroll | Iakttagelse |
| --- | --- |
| `<label htmlFor>` | ✔ konsekvent, inkl. `sr-only`-etiketter för sökfält (`hyresgaster/page.tsx:34`) |
| `role="alert"` på fel | ✔ `ActivateForm.tsx:13`, `aktivera/[token]/page.tsx:35` |
| `aria-label` på landmärken | ✔ `aria-label="Dina roller"` (`admin/layout.tsx:30`), `aria-label="Mina sidor-meny"` (`mina-sidor/layout.tsx:26`) |
| Skip link-mål | ✔ `id="huvudinnehall"` på `<main>` i alla tre layouter |
| `noValidate` + serverfel | ✔ `ActivateForm.tsx:11` – medveten server-side-validering |
| `autoComplete` | ✔ `new-password` på lösenordsfält |
| Semantiska element | ✔ `<header>`, `<main>`, `<aside>`, `<form>` |
| Rubrikhierarki | ✔ en `<h1>` per sida i granskade filer |
| Färgkontrast | **NOT VERIFIED** – kräver rendering. Palett `brand-700`/`brand-800` på vitt samt `text-stone-500`/`text-stone-600` bör mätas |
| Fokusordning och synligt fokus | **NOT VERIFIED** |
| Skärmläsare | **NOT VERIFIED** |
| Tangentbordsnavigering | **NOT VERIFIED** |

Grundstrukturen är genomgående korrekt uppmärkt. Projektet har dessutom en
publik `/tillganglighet`-sida, vilket tyder på medveten ambition.

## Tabeller och datamängder

| Aspekt | Iakttagelse |
| --- | --- |
| Filtrering | ✔ `method="GET"` med `searchParams` – bokmärkbart och tillbaka-vänligt |
| Sökning | ✔ `?q=` i persondlistan |
| Sortering | ⚠ ingen kolumnsortering i UI |
| **Pagination** | ✘ **saknas genomgående** |
| Virtualisering | ✘ ingen |
| Hårda gränser | ⚠ `admin-records.ts:166` – `.limit(2000)` på dokument |

Avsaknaden av pagination är den största skalbarhetsrisken i UI-lagret. Med
`.limit(2000)` som enda broms kommer admin-vyerna att rendera hela tabeller när
datamängden växer. I dag är live-tabellerna tomma, så problemet är latent.
Klassas som P2 och redovisas i `PERFORMANCE_REVIEW.md`.

## Mobil

Tailwind-klasserna använder genomgående responsiva prefix
(`sm:`, `lg:`), t.ex. `lg:grid-cols-[240px_1fr]` i portalens layout och
`flex-wrap` i admin-headern. Strukturellt mobilanpassat; **faktisk rendering
NOT VERIFIED**.

## Sammanfattande bedömning

UI-lagret är konsekvent och auktoriseringsmässigt sunt: dolt UI är aldrig det
enda skyddet, layout- och sidgrindar dubblerar varandra, och alla mutationer
går genom `requirePermission`.

Bristerna är UX- och skalbarhetsrelaterade snarare än säkerhetsrelaterade:

1. Ingen pagination (P2)
2. Inga `loading.tsx`/Suspense-gränser (P3)
3. Ingen kolumnsortering (P3)
4. Tillgänglighet kan inte verifieras utan rendering (blockerad)
