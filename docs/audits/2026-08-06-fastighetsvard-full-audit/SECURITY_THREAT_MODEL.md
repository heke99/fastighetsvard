# Hotmodell

Struktur per hot: skyddad tillgång · angripare · attackväg · befintligt skydd ·
verifierad svaghet · konsekvens · åtgärd · regressionstest.

## Förtroendegränser

```text
┌─ Internet (oautentiserad) ──────────────────────────────────────────┐
│  Publik webb · publik Supabase-nyckel · PostgREST-endpoint          │
└──────────────┬──────────────────────────────────────────────────────┘
               │  GRÄNS 1: Supabase Auth
┌──────────────▼──────────────────────────────────────────────────────┐
│  authenticated: sökande · hyresgäst · personal · entreprenör        │
└──────────────┬──────────────────────────────────────────────────────┘
               │  GRÄNS 2: app_has_permission / requirePermission
┌──────────────▼──────────────────────────────────────────────────────┐
│  Behörig personal inom organisationen                               │
└──────────────┬──────────────────────────────────────────────────────┘
               │  GRÄNS 3: service_role (endast serverprocess)
┌──────────────▼──────────────────────────────────────────────────────┐
│  Full databasåtkomst · RLS kringgås                                 │
└─────────────────────────────────────────────────────────────────────┘

Sidokanal: API-nyckel (Bearer) → GRÄNS 2 direkt, scope-begränsad
Sidokanal: CRON_SECRET → /api/internal/webhooks/process
Sidokanal: HMAC-signerad inkommande webhook → integrationsskrivningar
```

**GRÄNS 1 är porös.** 40 `SECURITY DEFINER`-funktioner är anropbara av `anon`;
de flesta självskyddar, två gör det inte.

---

## H-01 · Oautentiserad korruption av revisionsloggen

| | |
| --- | --- |
| Tillgång | `AuditEvent` – legal spårbarhet |
| Angripare | Vem som helst på internet |
| Attackväg | `POST /rest/v1/rpc/write_audit_event` med publik nyckel |
| Befintligt skydd | **Inget** – funktionen saknar guard; `anon` har EXECUTE |
| Verifierad svaghet | **JA** – `proacl` + funktionskropp + Supabase advisor |
| Konsekvens | Permanent förfalskad revisionshistorik (append-only, kan inte städas), lagrings-DoS |
| Åtgärd | `REVOKE ... FROM PUBLIC, anon, authenticated`; `GRANT ... TO service_role` |
| Regressionstest | `verify_rls.sql`: `has_function_privilege('anon','write_audit_event(...)','EXECUTE') = false` |

→ `FASTIGHET-001` (P0)

## H-02 · Oautentiserad injektion i outbox-kön

| | |
| --- | --- |
| Tillgång | `OutboxEvent` – asynkron leveransintention |
| Angripare | Vem som helst på internet |
| Attackväg | `POST /rest/v1/rpc/enqueue_outbox_event` |
| Befintligt skydd | **Inget** |
| Verifierad svaghet | **JA** |
| Konsekvens | I dag: lagrings-DoS och förgiftning av `idempotencyKey`. Efter att en outbox-worker byggs: **öppen e-postrelä från `info@faddebo.se`** (`p_recipient` är fritt val) |
| Åtgärd | Revoke + intern `auth.role()`-guard som i `claim_outbox_jobs` |
| Regressionstest | Samma privilegieassert + enhetstest att guarden kastar `42501` |

→ `FASTIGHET-002` (P1)

## H-03 · Hyresgäst läser interna personalanteckningar

| | |
| --- | --- |
| Tillgång | `MaintenanceComment` där `isInternal = true` |
| Angripare | Inloggad hyresgäst |
| Attackväg | `GET /rest/v1/MaintenanceComment?requestId=eq.<eget-ärende>` med egen access token |
| Befintligt skydd | Endast applikationsfrågans `.eq("isInternal", false)` |
| Verifierad svaghet | **JA** – policyn refererar inte kolumnen; `authenticated` har `SELECT` |
| Konsekvens | Interna bedömningar, kostnadsuppskattningar och entreprenörsdialog exponeras för den berörda hyresgästen |
| Åtgärd | Dela policyn i hyresgäst- (med `isInternal = false`) och personalvariant |
| Regressionstest | `verify_rls.sql`: hyresgästsession + intern kommentar → 0 rader |

→ `FASTIGHET-022` (P1)

## H-04 · IDOR mot annans ärende, avtal eller faktura

| | |
| --- | --- |
| Tillgång | Andra personers domändata |
| Angripare | Inloggad användare |
| Attackväg | Manipulera `requestId`/`contractId`/`invoiceId` i URL eller PostgREST-anrop |
| Befintligt skydd | RLS på samtliga: `personId = current_app_person_id()` eller `EXISTS`-join mot `ContractParty`/`ApplicationMember`. Applikationsfrågorna dubblerar med `.eq("personId", personId)` |
| Verifierad svaghet | **Nej** |
| Konsekvens | — |
| Åtgärd | — |
| Regressionstest | Negativa RLS-tester i `verify_rls.sql` (kräver staging) |

## H-05 · Korskoppling till annan organisations förälderpost

| | |
| --- | --- |
| Tillgång | Dataintegritet över organisationsgräns |
| Angripare | Inloggad användare / personal |
| Attackväg | Skicka giltigt `unitId`, `personId` eller `listingId` från annan organisation till en skrivväg |
| Befintligt skydd | Alla muterande RPC:er verifierar `current_app_organization_id()` mot radens `organizationId`. `submit_rental_application` verifierar medsökande med `AND p."organizationId" = v_organization_id` och kastar `co_applicant_not_found`. `createMaintenanceAction` slår upp objektet via `getMyRentalUnit()` |
| Verifierad svaghet | **Nej** i granskade vägar |
| Konsekvens | — |
| Åtgärd | — |
| Regressionstest | Kräver två organisationer i staging; finns inte i dag |

## H-06 · Rolleskalering

| | |
| --- | --- |
| Tillgång | Administrativ behörighet |
| Angripare | Inloggad icke-personal |
| Attackväg | (a) roll i request body, (b) manipulerad JWT, (c) egen `UserRole`-insert, (d) skapa roll med `*` |
| Befintligt skydd | (a) inga rollfält accepteras; (b) roller finns inte i JWT — läses per request ur DB; (c) `UserRole` har RLS utan policy → deny; (d) `create_custom_role` är service-role-låst, kräver aktiv aktör med `roles:create` och tillåter `*` endast för superadmin |
| Verifierad svaghet | **Delvis** – `isStaffAccount()` är en deny-list; varje okänd rollslug ger `/admin`-routing |
| Konsekvens | Åtkomst till administrationsskalet. Domändata skyddas fortfarande av per-sida-`hasPermission` och `requirePermission` i alla 26 server actions |
| Åtgärd | Vänd till allow-list (`FASTIGHET-007`) |
| Regressionstest | `tests/role-routing.test.ts`: `isStaffAccount(["okand"]) === false` |

## H-07 · Läckage av service-role-nyckeln

| | |
| --- | --- |
| Tillgång | Full databasåtkomst |
| Angripare | Vem som helst |
| Attackväg | Nyckeln hamnar i klientbundlen eller i loggar |
| Befintligt skydd | `src/lib/supabase/admin.ts:1` – `import "server-only"`; nyckeln nås endast via `getSupabaseSecretKey()`; `scripts/lint.mjs` blockerar mönstret statiskt; ingen `NEXT_PUBLIC_`-prefix |
| Verifierad svaghet | **Nej** – produktionsbygget genomfördes och de delade klientchunkarna är 102 kB utan Supabase-secret-referens |
| Konsekvens | — |
| Åtgärd | — |
| Regressionstest | Befintlig lint-guard räcker |

## H-08 · Osäker filuppladdning

| | |
| --- | --- |
| Tillgång | Storage, personalens klienter |
| Angripare | Inloggad hyresgäst |
| Attackväg | Ladda upp godtyckliga bytes märkta `image/png` |
| Befintligt skydd | Antal, storlek, MIME-allowlist, filändelsesanering, `randomUUID()`-basnamn, privat bucket, signerad URL |
| Verifierad svaghet | **JA** – MIME kontrolleras endast mot klientens `Content-Type`; ingen magic byte-kontroll; `Content-Disposition` sätts inte |
| Konsekvens | Polyglot- eller PDF-baserad nyttolast levereras till personal som "bild" |
| Åtgärd | Magic byte-validering + `Content-Disposition: attachment` |
| Regressionstest | Enhetstest: fil med PNG-`Content-Type` men PDF-magic → avvisas |

→ `FASTIGHET-011` (P2)

## H-09 · Path traversal i storage

| | |
| --- | --- |
| Tillgång | Andra organisationers filer |
| Angripare | Inloggad användare |
| Attackväg | Filnamn med `../` |
| Befintligt skydd | Path byggs av serververifierade värden; filändelsen saneras till `[a-z0-9]{≤8}`; originalnamnet används aldrig i path |
| Verifierad svaghet | **Nej** |
| Åtgärd | — |

## H-10 · XSS

| | |
| --- | --- |
| Tillgång | Sessioner |
| Angripare | Inloggad användare |
| Attackväg | Injicerad markup i ärendetext, kommentar eller e-post |
| Befintligt skydd | React escapar som standard; **ingen** `dangerouslySetInnerHTML` i `src/`; e-postmallar escapar via `escapeHtml()` (`email.ts:25-32`); SVG/HTML avvisas av alla buckets |
| Verifierad svaghet | **Nej** |
| Åtgärd | Överväg Content-Security-Policy-header (saknas i `next.config.ts`) |

## H-11 · CSRF

| | |
| --- | --- |
| Tillgång | Muterande operationer |
| Angripare | Extern webbplats |
| Attackväg | Cross-origin POST mot server action eller `/api/auth/logout` |
| Befintligt skydd | Next.js server actions har inbyggt origin-skydd; auth-cookies sätts av `@supabase/ssr` med `SameSite`; utloggning är POST |
| Verifierad svaghet | **Nej** (ej penetrationstestat) |
| Åtgärd | — |

## H-12 · SSRF via utgående webhook

| | |
| --- | --- |
| Tillgång | Interna nätverksresurser |
| Angripare | Personal med `webhooks:create` |
| Attackväg | Registrera en `WebhookSubscription.url` mot `169.254.169.254` eller `localhost` |
| Befintligt skydd | `requirePermission("webhooks","update")`; 10 s timeout (`webhooks.ts:85`) |
| Verifierad svaghet | **LIKELY** – ingen URL-allowlist eller IP-blockering hittades i `src/lib/services/webhooks.ts` eller `admin/actions.ts:724-734` |
| Konsekvens | Betrodd personal kan få servern att anropa interna adresser. Svaret returneras inte till användaren (endast statuskod loggas), vilket begränsar exfiltrering till blind SSRF |
| Åtgärd | Validera att URL:en är `https`, publik IP och inte länklokal/privat |
| Regressionstest | Enhetstest som avvisar `http://169.254.169.254/`, `http://localhost`, `http://10.0.0.1` |

## H-13 · SQL injection

| | |
| --- | --- |
| Tillgång | Databasen |
| Angripare | Alla |
| Attackväg | Injektion via query-parametrar |
| Befintligt skydd | All åtkomst via PostgREST-klienten (parametriserad) eller RPC med typade argument. Inga strängkonkatenerade frågor hittades. `EXECUTE format(...)` används endast i `rls_auto_enable` mot `pg_event_trigger_ddl_commands()`, dvs. inte användarindata |
| Verifierad svaghet | **Nej** |
| Åtgärd | — |

## H-14 · Webhook-spoofing och replay

| | |
| --- | --- |
| Tillgång | Ekonomidata (fakturor, betalningar, kunder) |
| Angripare | Vem som helst som känner endpoint-URL:en |
| Attackväg | Förfalskad `POST /api/webhooks/accounting/<provider>` |
| Befintligt skydd | HMAC-verifiering mot `connection.webhookSecret`; tidsstämpel i signaturen med 5 min tolerans; idempotens per (organisation, provider, eventId); ogiltig signatur auditloggas |
| Verifierad svaghet | **Nej** |
| Konsekvens | — |
| Åtgärd | — |
| Not | `route.ts:100-104` returnerar medvetet 200 även vid processfel, med granskningskö. Rimlig designavvägning |

## H-15 · Rate abuse och brute force

| | |
| --- | --- |
| Tillgång | Konton, API |
| Angripare | Vem som helst |
| Attackväg | Massinloggningsförsök eller API-flooding |
| Befintligt skydd | API-nycklar: `consume_rate_limit` 300/60 s per nyckel (service-role-låst, atomisk upsert). **Inloggning: ingen applikationsnivå-gräns** |
| Verifierad svaghet | **LIKELY** – Supabase Auths inbyggda gränser kunde inte verifieras (ingen projektåtkomst) |
| Konsekvens | Förstärks av `FASTIGHET-016` (läckta lösenord tillåts) och avsaknad av MFA |
| Åtgärd | Applicera `consume_rate_limit` på `login`-vägen med IP + e-post som subjekt |
| Regressionstest | Integrationstest: 11:e försöket inom fönstret nekas |

## H-16 · Kontouppräkning

| | |
| --- | --- |
| Tillgång | Vetskap om vilka e-postadresser som är kunder |
| Angripare | Vem som helst |
| Attackväg | Jämför svar från inloggning och lösenordsåterställning |
| Befintligt skydd | Återställning: **korrekt** – identiskt svar oavsett om kontot finns, även vid SMTP-fel (`auth-actions.ts:116-119`). Inloggning: generiskt `invalid_credentials` |
| Verifierad svaghet | **JA, begränsad** – `email_not_confirmed` (`auth.ts:30-35`) avslöjar att kontot existerar |
| Konsekvens | Angripare kan avgöra om en adress är registrerad men obekräftad |
| Åtgärd | Medveten UX-avvägning; dokumentera eller ersätt med generiskt svar plus separat återutskicksflöde |

## H-17 · Race conditions

| | |
| --- | --- |
| Tillgång | Objekt, avtal, erbjudanden, inbjudningar |
| Angripare | Inloggad användare |
| Attackväg | Parallella accept/inlämna/aktivera |
| Befintligt skydd | `FOR UPDATE` på alla lästa rader i muterande RPC:er; `expected_status` → `optimistic_lock_conflict` (40001); `claim_idempotent_operation` med `PROCESSING`-lease och `operation_already_processing` (55P03); unika index på reservation och `idempotencyKey`; `accept_rental_offer` kontrollerar aktiv reservation och bindande avtal före insert; UI-knappar inaktiveras via `pending` |
| Verifierad svaghet | **Delvis** – `create_maintenance_request` saknar idempotensnyckel (se `MAINTENANCE_REQUEST_FLOW.md`) |
| Konsekvens | Dubbla felanmälningar vid retry |
| Åtgärd | Lägg till `p_idempotency_key`/`p_request_hash` analogt med `submit_rental_application` |
| Regressionstest | `scripts/verify-concurrency-primitives.mjs` finns; kräver databas |

## H-18 · Mass assignment

| | |
| --- | --- |
| Tillgång | Privilegierade fält |
| Angripare | Inloggad användare |
| Attackväg | Extra fält i formulär eller API-body |
| Befintligt skydd | Zod-scheman med explicita fältlistor (`actions.ts:20-32`); RPC:er tar namngivna typade parametrar, aldrig ett generiskt objekt; `Object.fromEntries(formData.entries())` matas genom `safeParse` som strippar okända fält |
| Verifierad svaghet | **Nej** |
| Åtgärd | — |

## H-19 · Läckage av signerade URL:er

| | |
| --- | --- |
| Tillgång | Privata dokument |
| Angripare | Mottagare av delad länk |
| Attackväg | Signerad URL vidarebefordras eller läcker via `Referer` |
| Befintligt skydd | 1 timmes livslängd; URL:er genereras per request och lagras inte |
| Verifierad svaghet | **POSSIBLE** – `signMaintenanceDocuments()` gör ingen egen behörighetskontroll utan förlitar sig på att anroparen filtrerat. Båda nuvarande anropare gör det korrekt |
| Konsekvens | En framtida anropare som glömmer filtrera signerar godtyckliga dokument |
| Åtgärd | Flytta behörighetskontrollen in i funktionen eller gör kontraktet explicit i namnet |

## H-20 · Känsliga uppgifter i loggar

| | |
| --- | --- |
| Tillgång | Personuppgifter |
| Angripare | Den med logglagringsåtkomst |
| Attackväg | `console.error` med felobjekt |
| Befintligt skydd | Loggarna innehåller felmeddelanden och typer, inte payloads. `email.ts:68` loggar `to=` och ämnesrad — men endast när `RESEND_API_KEY` saknas, dvs. i utveckling eller när `EMAIL_LOG_LINKS === "true"` |
| Verifierad svaghet | **POSSIBLE** – om `EMAIL_LOG_LINKS=true` sätts i produktion loggas mottagaradress och aktiveringslänkar i klartext |
| Konsekvens | Aktiveringslänkar i loggar möjliggör kontoövertagande |
| Åtgärd | Blockera `EMAIL_LOG_LINKS` när `NODE_ENV === "production"` |

---

## Sammanställning

| Hot | Verifierad svaghet | Prioritet |
| --- | --- | --- |
| H-01 revisionslogg | **JA** | P0 |
| H-02 outbox | **JA** | P1 |
| H-03 interna kommentarer | **JA** | P1 |
| H-06 rolleskalering (routing) | Delvis | P1 |
| H-08 filuppladdning | JA | P2 |
| H-12 SSRF via webhook | LIKELY | P2 |
| H-15 brute force | LIKELY | P2 |
| H-16 kontouppräkning | JA (begränsad) | P2 |
| H-17 race (felanmälan) | Delvis | P2 |
| H-19 signerade URL:er | POSSIBLE | P3 |
| H-20 loggar | POSSIBLE | P3 |
| H-04, H-05, H-07, H-09, H-10, H-11, H-13, H-14, H-18 | **Nej** | — |

Nio av tjugo hot har inget verifierat problem. Det är ett starkt resultat för
kärnflödena; problemen koncentreras till grant-modellen och till affärsregler
som implementerats i frågelagret i stället för i radgränsen.
