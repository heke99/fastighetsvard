# Felanmälan – end-to-end

## Kedjan

```text
Hyresgäst i /mina-sidor/felanmalan/ny
  → MaintenanceForm.tsx (client component, useActionState)
  → createMaintenanceAction()        src/app/(portal)/mina-sidor/felanmalan/ny/actions.ts
      1. getCurrentUser()            → personId + organizationId ur current_user_context()
      2. readMaintenanceFiles()      → bilagor ur FormData
      3. validateMaintenanceFiles()  → antal, MIME, storlek
      4. zod-schema.safeParse()      → fältvalidering
      5. getMyRentalUnit(unitId)     → verifierar hyresförhållande
      6. createMaintenanceRequest()  src/lib/services/maintenance.ts
           → createMaintenanceRequestCommand()  src/lib/repositories/maintenance-operations.ts
               → RPC create_maintenance_request (SECURITY DEFINER, service-role-låst)
                   INSERT MaintenanceRequest + MaintenanceStatusEvent + Notification
      7. runPostCommitEffects()      → dispatchEvent(webhook) + notifyCreated(e-post)
      8. uploadMaintenanceFiles()    → Storage + Document
      9. redirect(?created=&attachments=)
```

## 1. Skapande

| Krav | Utfall | Evidens |
| --- | --- | --- |
| Hyresgästen korrekt autentiserad | ✔ | `actions.ts:38-39` – `getCurrentUser()`, redirect till `/logga-in` om `personId`/`organizationId` saknas |
| Kopplad till korrekt organisation | ✔ | `organizationId` hämtas ur `current_user_context()`, aldrig ur formuläret |
| Kopplad till korrekt objekt | ✔ | `actions.ts:62-72` – `getMyRentalUnit(data.unitId)` returnerar `null` om objektet inte hyrs |
| Objekt → byggnad → fastighet | ⚠ | `propertyId` härleds ur objektet (`unit.propertyId`). `Building` hoppas över (`FASTIGHET-017`) |
| Fastighet → hyresvärd | ✔ | En organisation; `Property.organizationId` |
| Korrekt organisationsägarskap på ärendet | ✔ | RPC får `p_organization_id` från serverkontexten |
| `created_by` sätts server-side | ✔ | `actions.ts:93` – `user.id` skickas som `actorUserId` |
| Klienten kan inte välja annan person/organisation | ✔ | Inga sådana fält i zod-schemat (`actions.ts:20-32`) |
| Validering server-side | ✔ | zod + RPC-constraints |
| Dubbelinlämning idempotent | ✘ | **Se nedan** |

### Objektbindningen är korrekt gjord

```ts
// actions.ts:59-72
let unitId: string | undefined;
let propertyId: string | undefined;
if (data.unitId !== "common") {
  const unit = await getMyRentalUnit(data.unitId);
  if (!unit) {
    return { status: "error",
             message: "Du kan bara göra felanmälan för objekt du hyr.",
             fieldErrors: { unitId: "Ogiltigt objekt." } };
  }
  unitId = data.unitId;
  propertyId = String(unit.propertyId);
}
```

Detta är det korrekta mönstret: klientens `unitId` används som *uppslagsnyckel*,
och `propertyId` härleds från den verifierade raden i stället för att accepteras
från klienten. Manipulerat `apartment_id`/`property_id` avvisas därmed.
`"common"` (allmänt utrymme) ger ärende utan objekt och fastighet, vilket är
avsiktligt.

### Idempotens saknas vid skapande

`createMaintenanceRequest` anropar `create_maintenance_request` utan
idempotensnyckel. Jämför `submit_rental_application` och `accept_rental_offer`,
som båda tar `p_idempotency_key` och `p_request_hash` och går via
`claim_idempotent_operation`.

Dubbelklick eller retry skapar därför två ärenden med olika `requestNumber`.
Formuläret är en client component; om den saknar `pending`-spärr är risken
konkret. Klassas som **P2**, se `VERIFICATION_MATRIX.md` scenario 9.

## 2. Synlighet och tilldelning

| Krav | Utfall | Mekanism |
| --- | --- | --- |
| Hyresgästen ser sitt ärende | ✔ | RLS `maintenance_owner_or_staff_read`: `personId = current_app_person_id()` |
| Rätt personal ser ärendet | ✔ | samma policy: `organizationId = current_app_organization_id() AND app_has_permission('maintenance:read')` |
| Obehörig personal ser inte ärendet | ✔ | permissionkravet i policyn + `hasPermission` på admin-sidan |
| Annan organisation ser inte ärendet | ✔ | organisationspredikat i policyn |
| Tilldelning endast till giltig användare | ⚠ | `create_work_order(p_assignee_user_id, ...)` – RPC:n är service-role-låst och anropas efter `requirePermission("workorders","create")`. Att mottagaren tillhör samma organisation verifieras i RPC:n; **ej runtime-testat** |
| Entreprenör ser endast tilldelat | ✔ | RLS `work_order_assignee_or_staff_read`: `assigneeUserId = current_app_user_id()` |
| Superadminåtkomst explicit och loggad | ✔ | wildcard-permission `*` i `RolePermission`; åtgärder skrivs till `AuditEvent` |

## 3. Statusmodell

Femton statusvärden, definierade som PostgreSQL-enum `MaintenanceStatus` och
speglade på fyra ställen:

| Plats | Referens |
| --- | --- |
| Databas | enum `MaintenanceStatus` |
| TypeScript | `src/lib/database-types.ts` |
| Tillståndsmaskin | `src/lib/state-machines.ts` (+ 6 tester) |
| E-postmall | `src/lib/email.ts:186-202` (`statusLabels`) |
| UI-badges | `src/components/StatusBadges.tsx` |

```text
RECEIVED · CONFIRMED · ASSESSING · NEEDS_INFO · ASSIGNED · BOOKED ·
IN_PROGRESS · WAITING_TENANT · WAITING_CONTRACTOR · WAITING_MATERIAL ·
DONE · QUALITY_CHECK · CLOSED · REJECTED · REOPENED
```

Samtliga 15 finns i `statusLabels` i e-postmallen — **ingen divergens**.
`npm run verify:consistency` verifierar synken aktivt (27 kontroller, gröna).

| Krav | Utfall |
| --- | --- |
| Tillåtna/förbjudna övergångar | ✔ `CASE`-tabell i `change_maintenance_status` + `state-machines.ts` |
| Vem får ändra status | ✔ `requirePermission("maintenance","update")` (`admin/actions.ts:520`) |
| Samtidiga statusändringar | ✔ `p_expected_status` → `optimistic_lock_conflict` (40001) |
| Historik | ✔ `MaintenanceStatusEvent` skrivs i samma transaktion |
| Timestamps | ✔ `createdAt` + `set_updated_at`-trigger |
| Återöppning / stängning / avvisning | ✔ `REOPENED`, `CLOSED`, `REJECTED` |
| Notifiering per status | ✔ `notifyStatus()` efter commit |
| Cacheinvalidering | ✔ (trivialt) alla portalsidor är `force-dynamic` |
| Optimistic updates i UI | – används inte; formulären gör full omladdning |

## 4. Kommentarer och historik

| Krav | Utfall |
| --- | --- |
| Kommentar kopplas till rätt ärende | ✔ `requestId` FK |
| Organisationen härleds säkert | ✔ via `EXISTS`-join mot `MaintenanceRequest` i RLS |
| Skapare registreras | ✔ `authorUserId` + `authorName` |
| Intern kommentar skiljs från hyresgästkommentar | ✔ kolumnen `isInternal` |
| **Interna kommentarer exponeras aldrig för hyresgästen** | ✘ **`FASTIGHET-022`** |
| Historik append-only | ✔ `MaintenanceStatusEvent` saknar UPDATE/DELETE-policy |
| Stabil tidsordning | ✔ `.order("createdAt", { ascending: true })` |
| Bilagor kopplade till rätt ärende | ✔ `Document.maintenanceRequestId` |
| Borttagen användare förstör inte historiken | ✔ `authorUserId` är nullbar; `AuditEvent.userId` är `ON DELETE SET NULL` |

Se `FASTIGHET-022`: `isInternal` filtreras i `portal-records.ts:293` men inte i
RLS-policyn, och hyresgästen har direkt `SELECT` på tabellen.

## 5. E-post och notifieringar

```ts
// src/lib/services/maintenance.ts:109-122
await runPostCommitEffects([
  { label: "created webhook",
    task: dispatchEvent(organizationId, "maintenance_request.created", {...}) },
  { label: "created email",
    task: notifyCreated(organizationId, String(request.id)) },
]);
```

| Krav | Utfall | Evidens |
| --- | --- | --- |
| Rätt mottagare | ✔ intern: `brand.faultReportEmail`; kvitto: `context.person.email` |
| Rätt organisation | ✔ kontexten hämtas per `organizationId + requestId` |
| Rätt avsändare | ✔ `email.ts:62-64` tvingar `info@faddebo.se` |
| Rätt portal-URL | ✔ `${brand.appUrl}/mina-sidor/felanmalan/${id}` |
| Inga läckta interna uppgifter | ✔ interna mejlet går till personaladressen, inte hyresgästen |
| Inga andra hyresgästers uppgifter | ✔ kontexten är per ärende |
| HTML-injektion | ✔ `escapeHtml()` på alla variabler (`email.ts:25-32`) |
| Header-injektion i ämnesrad | ✔ `cleanSubject()` strippar CR/LF (`email.ts:34-36`) |
| **E-postfel rullar inte tillbaka ärendet** | ✔ post-commit + `Promise.allSettled` |
| **Retry skapar inte dubbletter** | ✔ ingen retry på e-post; ärendet är redan committat |
| Dubbla utskick | ✔ ett anrop per händelse |
| Leveransstatus / bounce | ✘ Resend-svaret loggas inte; ingen bounce-hantering |
| Audit på utskick | ✘ e-post skrivs inte till `AuditEvent` |

Punkt 10 i auditens obligatoriska testfall — *"e-postleverantören misslyckas
efter att databasen sparat ärendet"* — är **verifierat säker i källkoden**:

```ts
// maintenance.ts:88-97
async function runPostCommitEffects(effects) {
  const results = await Promise.allSettled(effects.map((e) => e.task));
  results.forEach((result, index) => {
    if (result.status === "rejected") {
      console.error(`FaddeBo maintenance ${effects[index]?.label} failed`, result.reason);
    }
  });
}
```

Ärendet är redan committat av RPC:n; ett avvisat e-postlöfte loggas och
sväljs. Användaren får `redirect(?created=<requestNumber>)` och uppmanas
alltså aldrig att skicka om. Detta är exakt det beteende
`.agent-memory/current-state.md` beskriver som åtgärdat 2026-08-04, och det
bekräftas här.

**Lucka:** eftersom utskicket varken loggas i `AuditEvent` eller får en
leveransstatus, finns ingen möjlighet att i efterhand upptäcka att ett kvitto
aldrig nådde hyresgästen.

## 6. Bilagor

Behandlas i sin helhet i [`STORAGE_AND_UPLOAD_REVIEW.md`](STORAGE_AND_UPLOAD_REVIEW.md).
Sammanfattning:

| Krav | Utfall |
| --- | --- |
| Uppladdning verifierar ärendeägarskap | ✔ `maintenance-files.ts:58-67` |
| Storage-path organisations- och personbunden | ✔ `${org}/${person}/${request}/${uuid}.${ext}` |
| Path traversal | ✔ filändelsen saneras till `[a-z0-9]{≤8}` |
| Storage lyckas men DB-insert misslyckas | ✔ **kompenseras** – `.remove([storageKey])` (`:98`) |
| DB-insert lyckas men storage misslyckas | ✔ filen räknas som `failed`, ingen `Document`-rad skapas |
| Partiell uppladdning | ✔ `attachmentStatus = "partial"` visas för användaren |
| MIME-validering | ✘ endast klientens `file.type` (`FASTIGHET-011`) |

Scenario 11 och 12 i auditens testmatris är alltså **båda korrekt hanterade** —
en av få implementationer som städar upp efter sig i båda riktningarna.

## Sammanfattande bedömning

Felanmälningsflödet är **det bäst genomarbetade flödet i systemet**.
Organisations-, person- och objektbindning sker server-side utan att lita på
klienten; sidoeffekter är post-commit; kompensation vid delvis misslyckad
uppladdning fungerar åt båda hållen; statusmodellen är synkad över fyra lager
och verifieras av 27 automatiska kontroller.

Två brister återstår:

1. **`FASTIGHET-022` (P1)** – interna kommentarer skyddas bara av
   applikationsfrågan.
2. **Idempotens saknas vid skapande (P2)** – till skillnad från
   ansöknings- och erbjudandeflödena.
