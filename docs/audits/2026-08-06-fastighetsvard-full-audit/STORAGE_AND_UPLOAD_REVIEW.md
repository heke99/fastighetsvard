# Storage och filuppladdning

## Buckets (live)

| Bucket | Publik | Storleksgräns | Tillåtna MIME | I repo? |
| --- | --- | --- | --- | --- |
| `application-documents` | nej | 50 MB | pdf, jpeg, png, webp | ✔ |
| `contract-drafts` | nej | 50 MB | pdf | ✔ |
| `exports` | nej | 100 MB | pdf, csv, json, zip, xlsx | ✔ |
| `inspection-files` | nej | 50 MB | jpeg, png, webp, pdf | ✔ |
| `invoice-files` | nej | 50 MB | pdf | ✔ |
| `listing-media` | **ja** | 20 MB | jpeg, png, webp, avif, pdf | ✔ |
| `maintenance-files` | nej | 50 MB | jpeg, png, webp, pdf, mp4 | ✔ |
| `property-media` | **ja** | 20 MB | jpeg, png, webp, pdf | ✘ **`FASTIGHET-006`** |
| `signed-contracts` | nej | 50 MB | pdf | ✔ |
| `tenant-documents` | nej | 50 MB | pdf, jpeg, png, webp | ✔ |

Åtta privata, två publika. `storage.objects` har 0 rader live.

## Path-konvention

```text
<organizationId>/<personId>/<requestId>/<uuid>.<ext>
     [1]              [2]
```

Storage-policyn läser exakt dessa två segment:

```sql
private_storage_owner_or_staff_read   SELECT {authenticated}
USING (bucket_id = ANY (ARRAY[...åtta privata buckets...])
   AND (storage.foldername(name))[1] = current_app_organization_id()
   AND ((storage.foldername(name))[2] = current_app_person_id()
        OR app_has_permission('documents:read')))
```

**Path byggs uteslutande av serververifierade värden**, aldrig av klientdata:

```ts
// src/lib/repositories/maintenance-files.ts:71
const storageKey =
  `${input.organizationId}/${input.personId}/${input.requestId}/${randomUUID()}.${extensionFor(file)}`;
```

`organizationId` och `personId` kommer från `current_user_context()`,
`requestId` från den nyss skapade och ägarverifierade raden, filnamnet ersätts
av `randomUUID()`. Kravet *"storage path ska inte enbart lita på klientskickade
tenant- eller user-ID:n"* är **uppfyllt**.

## Ägarverifiering före uppladdning

```ts
// maintenance-files.ts:58-67
const { data: request, error: requestError } = await admin
  .from("MaintenanceRequest")
  .select("id")
  .eq("id", input.requestId)
  .eq("organizationId", input.organizationId)
  .eq("personId", input.personId)
  .maybeSingle();
if (requestError || !request) {
  throw new Error("Felanmälan kunde inte verifieras för bilageuppladdning.");
}
```

Trippelpredikat på ärende, organisation och person innan en enda byte skrivs.
Korrekt.

## Filvalidering

| Kontroll | Status | Kommentar |
| --- | --- | --- |
| Antal filer | ✔ | max 5 (`MAX_FILES`) |
| Filstorlek | ✔ | max 10 MB i appen; 50 MB på bucketen |
| MIME-typ | ⚠ | **endast `file.type`** – klientkontrollerat (`FASTIGHET-011`) |
| Filändelse | ✔ | härleds ur filnamnet, saneras till `[a-z0-9]`, max 8 tecken |
| Magic bytes | ✘ | **utförs inte** |
| Path traversal | ✔ | `.replace(/[^a-z0-9]/g, "")` eliminerar `.`, `/`, `\` |
| Filnamnskollision | ✔ | `randomUUID()` som basnamn |
| Unicode-filnamn | ✔ | originalnamnet lagras endast i `Document.fileName` (DB), aldrig i path |
| SVG | ✔ | inte i tillåtna MIME-typer i någon bucket |
| HTML | ✔ | inte tillåten |
| Körbara filer | ✔ | inte tillåtna |
| Malware-skanning | ✘ | ingen |
| Skadlig PDF | ✘ | ingen innehållsanalys |

### MIME-kontrollen är den svaga punkten

```ts
// maintenance-files.ts:32-43
const ALLOWED_MIME_TYPES = new Set(["image/jpeg","image/png","image/webp","application/pdf"]);
...
if (!ALLOWED_MIME_TYPES.has(file.type)) { return `Filtypen ... stöds inte...`; }
```

`file.type` kommer från multipart-headerns `Content-Type` och sätts av klienten.
Samma värde propageras till Storage (`contentType`, rad 74) och till
`Document.mimeType` (rad 86). Bucketens `allowed_mime_types` kontrollerar
**samma** klientskickade värde och ger därför ingen oberoende garanti.

Konsekvensen är begränsad av att bucketen är privat och nås via signerad URL,
men innebär att godtyckliga bytes kan lagras och senare levereras till
personalens webbläsare märkta som en bild. Se `FASTIGHET-011`.

## Kompensation vid fel

```ts
// maintenance-files.ts:76-101
if (uploadError) { failed.push(file.name); continue; }        // ingen Document-rad

const { error: documentError } = await admin.from("Document").insert({...});
if (documentError) {
  await admin.storage.from(BUCKET).remove([storageKey]);      // städar filen
  failed.push(file.name);
  continue;
}
uploaded += 1;
```

Båda riktningarna hanteras:

| Scenario | Utfall |
| --- | --- |
| Storage lyckas, DB-insert misslyckas | Filen **raderas** → inga orphan-filer |
| DB-insert skulle lyckas men storage misslyckade | Ingen `Document`-rad skapas → inga referenser till saknade filer |
| Delvis lyckad batch | `attachmentStatus = "partial"`, visas i redirect-parametern |
| Hela batchen misslyckas | `"failed"` – ärendet finns kvar, användaren uppmanas inte skicka om |

Detta är en av få platser i systemet med explicit kompenserande transaktion,
och det är korrekt implementerat.

## Signerade URL:er

```ts
// maintenance-files.ts:108-124
export async function signMaintenanceDocuments(documents, expiresInSeconds = 3600) {
  const admin = createAdminClient();
  return Promise.all(documents.map(async (document) => {
    const { data, error } = await admin.storage
      .from(BUCKET).createSignedUrl(String(document.storageKey), expiresInSeconds);
    return { ...document, signedUrl: error ? null : data.signedUrl };
  }));
}
```

| Aspekt | Bedömning |
| --- | --- |
| Livslängd | 1 timme (default) – rimligt |
| Genereras med service-role | Ja – **funktionen gör ingen egen behörighetskontroll** |
| Anropskontrakt | Anroparen måste ha filtrerat dokumenten först |
| Faktiska anropare | `portal-records.ts` (filtrerar på `personId` + `maintenanceRequestId`), `admin-records.ts` (efter `hasPermission`) |
| `Content-Disposition` | Sätts inte → webbläsaren kan rendera inline |
| Cache-headers | Ej konfigurerade |
| URL-läckage | Signerad URL i HTML kan hamna i `Referer` vid utgående länk; ingen sådan länk hittades |

`signMaintenanceDocuments` är ett **implicit kontrakt**: den signerar allt den
får. Det fungerar i dag eftersom båda anroparna filtrerar korrekt, men funktionen
har ingen egen spärr. Rekommendation: ta emot `organizationId`/`personId` och
verifiera, eller döp om till `signAlreadyAuthorizedDocuments` så kontraktet syns.

## Åtkomst över tid

| Fråga | Svar | Evidens |
| --- | --- | --- |
| Åtkomst efter borttagen användare | Nekas | `current_app_person_id()` kräver `User.isActive = true`; utan rad → `NULL` → policyn matchar inte |
| Åtkomst efter avslutat medlemskap | Nekas | samma mekanism |
| Åtkomst efter flytt mellan objekt | **Behålls** | path innehåller `personId`, inte `unitId`. Hyresgästen behåller åtkomst till bilagor i sina *egna gamla* ärenden |
| Ny hyresgäst ser gamla ärenden | Nej | `MaintenanceRequest.personId` är den förra hyresgästens |

Att en tidigare hyresgäst behåller åtkomst till sina egna historiska ärenden är
rimligt ur GDPR-perspektiv (rätt till egna uppgifter), men bör vara ett medvetet
beslut. Det är inte dokumenterat någonstans.

## Retention och städning

| Aspekt | Status |
| --- | --- |
| Retention-policy | Ingen |
| Cleanup-jobb för föräldralösa filer | Ingen |
| Cleanup vid ärenderadering | `Document.maintenanceRequestId` är `ON DELETE SET NULL` → `Document`-raden överlever, filen likaså |
| Soft delete | `Document.archivedAt` finns och filtreras i läsningar |
| Verifiering av orphans | Ej möjlig – `storage.objects` har 0 rader live |

**Lucka:** raderas ett ärende blir `Document.maintenanceRequestId = NULL` men
raden och filen ligger kvar. Utan retention-jobb växer lagringen monotont.
Klassas som del av `FASTIGHET-014`-familjen (driftrisk), inte som eget fynd —
volymen är i dag noll.

## Listing-media

`src/lib/repositories/listing-media.ts` hanterar bilder och planritningar för
annonser. Storage-policyerna kräver
`foldername[1] = current_app_organization_id() AND app_has_permission('listings:update')`
för INSERT/UPDATE/DELETE, och tillåter publik läsning.

`npm run verify:consistency` innehåller tre riktade kontroller som passerade:

```text
PASS  Annonsadmin kan ladda upp bilder och planritningar
PASS  Annonsmedia är objekt- och organisationsavgränsad
PASS  Annonsmedia sparas canonical och visas publikt
PASS  Mediafel efter annonskapande orsakar inte dubbla annonser
```

Bucketen är publik, vilket är avsiktligt för annonsbilder.

## Sammanfattande bedömning

Storage är **organisationssäkert för de nio kända bucketarna**. Path-konventionen
matchar policyn exakt, byggs av betrodda värden och kompensationslogiken vid
uppladdningsfel fungerar i båda riktningarna.

Tre brister:

1. `FASTIGHET-006` (P1) – odokumenterad publik bucket `property-media` utan
   policytäckning och utan migration.
2. `FASTIGHET-011` (P2) – innehållsvalidering saknas; endast klientens MIME-typ.
3. Ingen retention eller orphan-städning (driftrisk, ej eget fynd i denna fas).
