# Domänmodell och dataägarskap

## Terminologi

| Auditens term | FaddeBos term | Tabell |
| --- | --- | --- |
| Tenant (isoleringsgräns) | Organisation | `Organization` |
| Hyresvärd | = organisationen (en-organisationsprodukt) | `Organization` |
| Förvaltare / fastighetsvärd | Personalroll | `Role` (`property-manager`) |
| Handläggare | Personalroll / arbetsordermottagare | `Role`, `WorkOrder.assigneeUserId` |
| Hyresgäst | Person med `PersonRole = TENANT` | `Person`, `PersonRole`, `ContractParty` |
| Lägenhet / lokal | Objekt | `Unit` |
| Byggnad | Byggnad | `Building` |
| Felanmälan | Felanmälan | `MaintenanceRequest` |

Två identitetsbegrepp måste hållas isär:

```text
auth.users.id  (uuid)        Supabase Auth — inloggningsidentitet
   │  User.authUserId
   ▼
User.id        (text)        Applikationskonto — bär roller och organisation
   │  User.personId
   ▼
Person.id      (text)        Människan — bär avtal, ansökningar, ärenden
```

`current_user_context()` är den enda platsen där översättningen sker.
Ingen kod i `src/` blandar ihop `auth.uid()` med `User.id` eller `Person.id`;
`readCurrentUserContext()` returnerar alla tre separat
(`src/lib/repositories/auth-context.ts:16-33`).

## Hierarki

```text
Organization
 ├── Brand                     (≤1 primär aktiv per organisation)
 ├── Property                  ── organizationId
 │    └── Building             ── organizationId + propertyId (CASCADE)
 │         └── Entrance
 │              └── Floor
 ├── Unit                      ── organizationId + propertyId [+ buildingId, nullbar]
 │    ├── UnitMedia
 │    └── Listing              ── unitId (CASCADE)
 │         ├── ListingPublication
 │         └── Application     ── mainApplicantPersonId
 │              ├── ApplicationMember   (personId, role)
 │              ├── ApplicationSnapshot (immutabel)
 │              ├── Offer      → Reservation → Contract
 │              └── Viewing / ViewingAttendee
 ├── Person                    ── organizationId
 │    ├── PersonRole           (APPLICANT / CO_APPLICANT / TENANT / CO_TENANT)
 │    └── User                 ── authUserId, personId, organizationId, supplierId
 │         └── UserRole → Role → RolePermission
 ├── Contract                  ── organizationId + unitId
 │    ├── ContractParty        (personId, role: TENANT / CO_TENANT)
 │    ├── ContractVersion      (immutabel vid låsning)
 │    ├── SigningSession → SigningChallenge → ContractSignature → EvidenceReport
 │    ├── ContractStatusEvent
 │    ├── Termination → MoveOutCase
 │    └── MoveInCase
 ├── MaintenanceRequest        ── organizationId + personId [+ unitId, propertyId]
 │    ├── MaintenanceComment
 │    ├── MaintenanceStatusEvent
 │    └── WorkOrder → Supplier / assigneeUserId
 ├── Invoice → InvoiceLine / InvoiceStatusEvent
 │    └── PaymentAllocation → Payment
 ├── Document                  ── organizationId + valfri parent
 ├── Notification / Message
 ├── AuditEvent (append-only) / OutboxEvent / OperationIdempotency
 └── ApiKey / WebhookSubscription → WebhookDelivery / InboundWebhookEvent
```

**Avvikelse:** `Unit` hänger på `propertyId` direkt och `buildingId` är nullbar
och oanvänd (0 `Building`-rader live). Se `FASTIGHET-017`.

## Ownership matrix

Kolumnen "Härledd organisation" anger hur `organizationId` fastställs när det
inte finns som egen kolumn. "RLS" anger om en policy finns; "Skydd" anger vad som
faktiskt hindrar felaktig åtkomst.

| Entitet | PK | Organisationsnyckel | Ägare | Skapare | Ansvarig | RLS | FK-skydd | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Organization` | `id` | *är gränsen* | – | – | – | ✔ egen | – | Låg |
| `Brand` | `id` | direkt | organisation | – | – | ✔ 4 policies | ✔ | Låg |
| `Person` | `id` | direkt | sig själv | – | – | ✔ egen + personal | ✔ | Låg |
| `User` | `id` | direkt | `authUserId` | – | – | ✔ `authUserId = auth.uid()` | ✔ | Låg |
| `UserRole` | `id` | via `User` | – | – | – | ✘ ingen policy | ✔ | Medel (`FASTIGHET-009`) |
| `Role` / `RolePermission` | `id` | direkt/global | organisation | `create_custom_role` | – | ✘ ingen policy | ✔ | Medel |
| `PersonRole` | `id` | **via `Person`** | person | – | – | ✔ men **utan org-predikat** | ✔ | Medel (`FASTIGHET-013`) |
| `Invitation` | `id` | direkt | – | `invitedByUserId` | – | ✘ ingen policy | ✔ | Låg (service-role) |
| `Property` | `id` | direkt | organisation | – | – | ✔ personal | ✔ | Låg |
| `Building` | `id` | direkt + `propertyId` | organisation | – | – | ✔ personal | ✔ CASCADE | Låg |
| `Unit` | `id` | direkt + `propertyId` | organisation | – | – | ✔ personal | ✔ | Medel (`FASTIGHET-017`) |
| `UnitMedia` | `id` | via `Unit` | organisation | – | – | ✘ ingen policy | ✔ | Låg |
| `Listing` | `id` | direkt | organisation | – | – | ✔ personal + publik vy | ✔ CASCADE | Låg |
| `Application` | `id` | direkt | `mainApplicantPersonId` | RPC | – | ✔ part eller personal | ✔ | Låg |
| `ApplicationMember` | `id` | **via `Application`** | `personId` | RPC | – | ✔ via `EXISTS` | ✔ CASCADE | Låg |
| `ApplicationSnapshot` | `id` | direkt | – | RPC | – | ✔ via medlemskap | ✔ | Låg (immutabel) |
| `Offer` | `id` | direkt | `personId` | RPC | – | ✔ ägare eller personal | ✔ | Låg |
| `Reservation` | `id` | direkt | – | RPC | – | ✔ personal | ✔ | Låg |
| `Contract` | `id` | direkt + `unitId` | via `ContractParty` | RPC | – | ✔ part eller personal | ✔ | Låg |
| `ContractParty` | `id` | **via `Contract`** | `personId` | RPC | – | ✔ via `EXISTS` | ✔ CASCADE | Låg |
| `ContractVersion` | `id` | **via `Contract`** | – | `createdByUserId` | – | ✔ via `EXISTS` | ✔ | Låg (immutabel) |
| `ContractSignature` | `id` | direkt | `personId` | RPC | – | ✔ ägare eller personal | ✔ RESTRICT | Låg |
| `EvidenceReport` | `id` | direkt | via `ContractParty` | RPC | – | ✔ | ✔ RESTRICT | Låg |
| `Termination` | `id` | direkt | `requestedByPersonId` | RPC | – | ✔ | ✔ | Låg |
| `MoveInCase` / `MoveOutCase` | `id` | direkt | via `ContractParty` | RPC | – | ✔ | ✔ RESTRICT | Låg |
| `MaintenanceRequest` | `id` | direkt | `personId` | `create_maintenance_request` | via `WorkOrder` | ✔ ägare eller personal | ✔ SET NULL | Låg |
| `MaintenanceComment` | `id` | **via `MaintenanceRequest`** | – | `authorUserId` | – | ✔ via `EXISTS` (endast SELECT) | ✔ | **Medel** – se nedan |
| `MaintenanceStatusEvent` | `id` | **via `MaintenanceRequest`** | – | – | – | ✔ endast ägaren | ✔ | Låg |
| `WorkOrder` | `id` | direkt | – | RPC | `assigneeUserId` | ✔ tilldelad eller personal | ✔ | Låg |
| `Supplier` | `id` | direkt | organisation | RPC | – | ✘ ingen policy | ✔ | Låg |
| `Document` | `id` | direkt | `personId` + parent | `uploadedByUserId` | – | ✔ 5 vägar | ✔ SET NULL | Låg |
| `Invoice` | `id` | direkt | `personId` | integration | – | ✔ ägare eller personal | ✔ | Låg |
| `Payment` | `id` | via `PaymentAllocation → Invoice` | – | integration | – | ✔ via join | ✔ | Låg |
| `Notification` | `id` | direkt | `personId` | RPC | – | ✔ endast ägaren | ✔ | Låg |
| `Message` | `id` | direkt | sender/recipient | – | – | ✔ part eller personal | ✔ SET NULL | Låg |
| `AuditEvent` | `id` | direkt | – | `userId`/`actorId` | – | ✔ läsning; **skrivning öppen** | ✔ SET NULL | **P0** (`FASTIGHET-001`) |
| `OutboxEvent` | `id` | direkt | – | – | – | ✔ läsning; **skrivning öppen** | ✔ | **P1** (`FASTIGHET-002`) |
| `ApiKey` | `id` | direkt | organisation | – | – | ✘ ingen policy | ✔ | Låg (hash + deny) |
| `WebhookSubscription` / `WebhookDelivery` | `id` | direkt | organisation | – | – | ✘ ingen policy | ✔ | Låg |

### Kommentar om `MaintenanceComment`

Tabellen har **endast en SELECT-policy**. Det finns ingen INSERT-policy, vilket
betyder att en hyresgäst inte kan kommentera sitt eget ärende via den
användarscopeade klienten — all kommentarsskrivning måste gå via service-role.
Det är konsekvent med resten av arkitekturen, men värt att notera: SELECT-policyn
exponerar **alla** kommentarer på ärendet för ärendets `personId`, inklusive
sådana som personalen kan ha avsett som interna.

```sql
maintenance_comment_owner_or_staff_read  SELECT {authenticated}
USING (EXISTS (SELECT 1 FROM "MaintenanceRequest" mr
               WHERE mr.id = "MaintenanceComment"."requestId"
                 AND (mr."personId" = current_app_person_id()
                      OR (mr."organizationId" = current_app_organization_id()
                          AND app_has_permission('maintenance:read')))))
```

Om `MaintenanceComment` har en kolumn för intern/extern synlighet filtreras den
**inte** av policyn. Se `MAINTENANCE_REQUEST_FLOW.md` §4 för fullständig
bedömning.

## Härledda organisationskedjor

De längsta härledningskedjorna, och hur de skyddas:

```text
MaintenanceComment → MaintenanceRequest → organizationId
   Skydd: EXISTS-join i RLS-policyn. Klientens requestId kan inte förfalskas,
   eftersom joinen verifierar föräldern mot current_app_person_id().

Document → maintenanceRequestId → MaintenanceRequest.personId
   Skydd: fyra alternativa EXISTS-vägar i document_related_person_or_staff_read.

PaymentAllocation → Invoice → personId / organizationId
   Skydd: EXISTS-join mot Invoice.

Payment → PaymentAllocation → Invoice → organizationId
   Skydd: två-stegs EXISTS-join. Längsta kedjan i systemet.
```

**Ingen** av dessa litar på ett klientskickat ID utan att verifiera föräldern.
Det är det viktigaste positiva fyndet i datamodellen: en angripare kan inte
skapa en korskoppling genom att skicka ett giltigt ID från en annan kontext.

## Soft delete

Systemet använder i huvudsak **hard delete med RESTRICT/SET NULL** snarare än
soft delete. Undantag: `Document.archivedAt` (används i
`admin-records.ts:166` med `.is("archivedAt", null)`), och statusfält som
`ARCHIVED`/`RESCINDED` på `Contract`, `Listing` och `Brand`.

Det finns ingen global `deletedAt`-konvention, och därför heller ingen risk att
soft-deletade poster råkar visas som aktiva — den frågeställningen är
**inte tillämplig** på denna modell.

## Typkonsekvens kod ↔ databas

`src/lib/database-types.ts` speglar databasens enums (`MaintenanceStatus`,
`ContractStatus`, `ApplicationStatus`, `ListingStatus`, `UnitStatus`,
`WorkOrderStatus`, `MaintenancePriority`, `ContractPartyRole` m.fl.).

Synken upprätthålls aktivt av tre mekanismer:

1. `tests/supabase-schema.test.ts` (2 tester)
2. `tests/state-machines.test.ts` (6 tester) mot `src/lib/state-machines.ts`
3. `npm run verify:consistency` — 27 kontroller, bl.a. att de 13 TypeScript-
   rollernas permissionsuppsättningar exakt matchar SQL-migrationen

Samtliga passerade i denna audit. **Ingen enum-divergens, inga duplicerade
typer och inga handskrivna typer som avviker från databasen påträffades.**
