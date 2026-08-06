# Organisationsisolering och rollmatris

## Förutsättning: produkten är enorganisations

`.agent-memory/organization-and-rls.md`:

> *"The product is single-landlord, but `organizationId` remains the legal/security
> boundary. Do not build unnecessary SaaS tenancy or remove organization
> constraints."*

Live: `Organization` har **1 rad**. Cross-organisationsisolering kan därför
**inte verifieras empiriskt** — det finns ingen andra organisation att korsa till.
Bedömningen nedan är strukturell: den beskriver vad som skulle hända om en
andra organisation lades till.

## Organisationsägarskapsmatris

`Direkt` = egen `organizationId`-kolumn. `Härledd` = via förälder.

| Entitet | Organisationsnyckel | Direkt/Härledd | Ägare | Skapare | Ansvarig | RLS | FK | Risk |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `Organization` | `id` | — | — | — | — | ✔ | — | Låg |
| `Brand` | `organizationId` | Direkt | org | — | — | ✔ | ✔ | Låg |
| `Person` | `organizationId` | Direkt | sig själv | — | — | ✔ | ✔ | Låg |
| `User` | `organizationId` | Direkt | `authUserId` | — | — | ✔ | ✔ | Låg |
| `UserRole` | — | Härledd (`User`) | — | — | — | ✘ | ✔ | Medel |
| `Role` | `organizationId` (nullbar) | Direkt/global | org | `create_custom_role` | — | ✘ | ✔ | Medel |
| `RolePermission` | — | Härledd (`Role`) | — | — | — | ✘ | ✔ | Medel |
| `PersonRole` | — | Härledd (`Person`) | — | — | — | ✔ **utan org-predikat** | ✔ | **Medel** |
| `Invitation` | `organizationId` | Direkt | — | `invitedByUserId` | — | ✘ | ✔ | Låg |
| `Property` | `organizationId` | Direkt | org | — | — | ✔ | ✔ | Låg |
| `Building` | `organizationId` | Direkt | org | — | — | ✔ | ✔ | Låg |
| `Entrance` / `Floor` | — | Härledd | org | — | — | ✘ | ✔ | Låg |
| `Unit` | `organizationId` | Direkt | org | — | — | ✔ | ✔ | Låg |
| `UnitMedia` | — | Härledd (`Unit`) | org | — | — | ✘ | ✔ | Låg |
| `Listing` | `organizationId` | Direkt | org | — | — | ✔ | ✔ | Låg |
| `Application` | `organizationId` | Direkt | `mainApplicantPersonId` | RPC | — | ✔ | ✔ | Låg |
| `ApplicationMember` | — | Härledd (`Application`) | `personId` | RPC | — | ✔ `EXISTS` | ✔ | Låg |
| `Offer` | `organizationId` | Direkt | `personId` | RPC | — | ✔ | ✔ | Låg |
| `Contract` | `organizationId` | Direkt | `ContractParty` | RPC | — | ✔ | ✔ | Låg |
| `ContractParty` | — | Härledd (`Contract`) | `personId` | RPC | — | ✔ `EXISTS` | ✔ | Låg |
| `MaintenanceRequest` | `organizationId` | Direkt | `personId` | RPC | `WorkOrder` | ✔ | ✔ | Låg |
| `MaintenanceComment` | — | Härledd (`MaintenanceRequest`) | — | `authorUserId` | — | ✔ `EXISTS` men **utan `isInternal`** | ✔ | **P1** |
| `WorkOrder` | `organizationId` | Direkt | — | RPC | `assigneeUserId` | ✔ | ✔ | Låg |
| `Supplier` | `organizationId` | Direkt | org | RPC | — | ✘ | ✔ | Låg |
| `Document` | `organizationId` | Direkt | `personId` | `uploadedByUserId` | — | ✔ | ✔ | Låg |
| `Invoice` | `organizationId` | Direkt | `personId` | integration | — | ✔ | ✔ | Låg |
| `Payment` | — | Härledd (2 steg) | — | integration | — | ✔ `EXISTS` | ✔ | Låg |
| `Notification` | `organizationId` | Direkt | `personId` | RPC | — | ✔ endast ägare | ✔ | Låg |
| `Message` | `organizationId` | Direkt | sender/recipient | — | — | ✔ | ✔ | Låg |
| `AuditEvent` | `organizationId` | Direkt | — | `actorId` | — | ✔ läs; **skriv öppen** | ✔ | **P0** |
| `OutboxEvent` | `organizationId` | Direkt | — | — | — | ✔ läs; **skriv öppen** | ✔ | **P1** |
| `ApiKey` | `organizationId` | Direkt | org | — | — | ✘ | ✔ | Låg |
| `WebhookSubscription` | `organizationId` | Direkt | org | — | — | ✘ | ✔ | Låg |

## Härledda kedjor och korskopplingsskydd

Auditens nyckelfråga: *kan en angripare skicka ett giltigt ID från en annan
organisation och därmed skapa en korskoppling?*

**Nej, i de granskade vägarna.** Samtliga härledda policies verifierar föräldern
i stället för att lita på det inskickade ID:t:

```text
MaintenanceComment → MaintenanceRequest → organizationId / personId
   EXISTS (SELECT 1 FROM "MaintenanceRequest" mr
           WHERE mr.id = "MaintenanceComment"."requestId" AND ...)

Payment → PaymentAllocation → Invoice → organizationId / personId
   EXISTS (SELECT 1 FROM "PaymentAllocation" pa JOIN "Invoice" i ...)
```

Samma princip i skrivvägarna. `create_maintenance_request` tar `p_unit_id` som
parameter, men anroparen (`actions.ts:62`) har redan verifierat objektet mot
hyresförhållandet via `getMyRentalUnit()`, och RPC:n är service-role-låst så den
kan inte nås direkt från en klient.

`submit_rental_application` verifierar dessutom medsökande explicit:

```sql
INSERT INTO public."ApplicationMember" ("applicationId","personId","role")
SELECT v_application_id, p."id", 'CO_APPLICANT'
FROM public."Person" p
WHERE p."id" = v_member->>'personId' AND p."organizationId" = v_organization_id;
IF NOT FOUND THEN RAISE EXCEPTION 'co_applicant_not_found' USING ERRCODE = 'P0002'; END IF;
```

En medsökande från en annan organisation avvisas. Detta är precis den kontroll
auditen efterfrågar.

## Kända luckor i organisationsbindningen

| # | Plats | Problem | Finding |
| --- | --- | --- | --- |
| 1 | `PersonRole`-policy | saknar organisationspredikat | `FASTIGHET-013` |
| 2 | `workOrderRelations()` | oanvänd `organizationId`-parameter, tre ofiltrerade service-role-frågor | `FASTIGHET-012` |
| 3 | `write_audit_event` | `p_organization_id` är fritt val för `anon` | `FASTIGHET-001` |
| 4 | `enqueue_outbox_event` | `p_organization_id` är fritt val för `anon` | `FASTIGHET-002` |

Punkt 1 och 2 är i dag utan praktisk effekt (en organisation) men bryter mot den
dokumenterade regeln och blir verkliga läckor vid en andra organisation.
Punkt 3 och 4 är verkliga redan i dag, eftersom de skriver snarare än läser.

## Roll- och behörighetsmatris

### Var varje roll finns representerad

| Lager | Representation | Auktoritativ? |
| --- | --- | --- |
| Databas | `Role.slug`, `RolePermission.permission` | **Ja** |
| Auth-metadata | — används inte | — |
| JWT | — roller finns inte i token | — |
| RPC | `app_has_permission(text)` | Ja (härledd) |
| RLS | `app_has_permission('resource:action')` | Ja (härledd) |
| Middleware | — ingen rollkontroll | — |
| Server actions | `requirePermission(resource, action)` | Nej (speglar DB) |
| Sidgrind | `hasPermission(user.permissions, r, a)` | Nej (speglar DB) |
| UI-nav | `AdminNav permissions={user.permissions}` | Nej (endast visning) |

Att roller varken finns i JWT eller i auth-metadata eliminerar hela klassen
"stale claims" och "klientvald roll". Det är matrisens starkaste egenskap.

### Effektiv behörighet per roll

| Roll | Routing | Läsa | Skapa | Ändra | Radera |
| --- | --- | --- | --- | --- | --- |
| `superadmin` | `/admin` | allt (`*`) | allt | allt | allt |
| `org-admin` | `/admin` | organisationens data | de flesta resurser | de flesta | begränsat |
| `property-owner` | `/admin` | fastighet/objekt/ekonomi | — | — | — |
| `property-manager` | `/admin` | fastighet, objekt, annons, ansökan, avtal, felanmälan | ja | ja | begränsat |
| `caretaker` | `/admin` | felanmälan, arbetsorder | arbetsorder | status | — |
| `leasing-agent` | `/admin` | annons, ansökan, visning, erbjudande | ja | ja | — |
| `sales-manager` | `/admin` | uthyrningsfunnel | ja | ja | — |
| `finance` | `/admin` | faktura, betalning | ja | ja | — |
| `customer-service` | `/admin` | person, ärende, meddelande | begränsat | begränsat | — |
| `facility-worker` | `/admin` | arbetsorder | — | status | — |
| `inspector` | `/admin` | besiktning | besiktning | besiktning | — |
| `report-viewer` | `/admin` | rapporter | **—** | **—** | **—** |
| `contractor` | `/entreprenor` | endast tilldelade arbetsorder | — | status | — |
| hyresgäst (`PersonRole = TENANT`) | `/mina-sidor` | eget boende, avtal, faktura, ärende, dokument | felanmälan | profil | — |
| sökande (inga `roleSlugs`) | `/mina-sidor` | egna ansökningar, favoriter, bevakningar | ansökan | profil | favoriter |
| **okänd/anpassad roll** | **`/admin`** | beror på `RolePermission` | — | — | — |

Sista raden är `FASTIGHET-007`: `isStaffAccount()` är en deny-list, så varje
rollslug som inte är exakt `contractor` eller `tenant` routas till `/admin`.
Data skyddas fortfarande av per-sida-kontrollerna, men klassificeringen är
fail-open.

### Verifierade rollegenskaper

| Krav | Utfall | Evidens |
| --- | --- | --- |
| Konsekventa rollnamn över lager | ✔ | `verify:consistency` – 13 TypeScript-rollers permissionsuppsättningar matchar SQL exakt |
| En auktoritativ rollkälla | ✔ | `current_user_context()` |
| Klienten kan inte välja privilegierad roll | ✔ | inga rollfält i formulär eller server actions |
| Roll ur request body litas aldrig på | ✔ | — |
| Superadmin ej implicit organisationsmedlem | ✔ | `organizationId` krävs även för superadmin |
| Organisationsadmin kan inte administrera annan organisation | ✔ strukturellt | organisationspredikat i alla admin-frågor; ej empiriskt testbart |
| Hyresgäst ser endast egna uppgifter | ⚠ | ✔ för ärenden/avtal/fakturor; ✘ för interna kommentarer (`FASTIGHET-022`) |
| Read-only är read-only | ✔ strukturellt | `report-viewer` saknar `:create/:update/:delete`; ej runtime-testat |
| Borttagen/avstängd användare tappar åtkomst | ✔ | `isActive`-krav i alla kontextfunktioner |
| Medlemskapsändring får genomslag | ✔ | ingen JWT-cachning; `force-dynamic` |
| Gammal JWT ger ingen kvarstående åtkomst | ✔ | roller slås upp per request |
| Service role exponeras aldrig i klienten | ✔ | `import "server-only"` + lint-guard |
| Server actions = API-kontroller | ✔ | båda via permissionslagret |
| Rolleskalering via onboarding | ✔ | `provision_staff_user`, `create_custom_role`, `claim_invitation` alla service-role-låsta; `*` endast för superadmin |

## UI vs server vs databas

| Vad UI visar | Vad servern tillåter | Vad databasen tillåter |
| --- | --- | --- |
| `AdminNav` döljer poster utan permission | Sidan redirectar utan permission | RLS nekar utan `app_has_permission` |
| Knappar döljs (`canImport`, `canInvite`, `canCreateTenant`) | Server action kastar `AuthError("forbidden")` | RPC:n är service-role-låst |
| Interna kommentarer visas inte i portalen | Frågan filtrerar `isInternal = false` | **RLS filtrerar inte** ← avvikelsen |
| Revisionsloggen kräver `audit:read` | Sidan redirectar | RLS kräver org + permission för läsning; **skrivning är öppen för `anon`** ← avvikelsen |

Två rader av tolv avviker. I båda fallen är UI och server strängare än
databasen — dvs. skyddet skulle försvinna om någon kringgår applikationen, vilket
är exakt vad `FASTIGHET-001` och `FASTIGHET-022` beskriver.
