# Drift, backup och incidenter

## Övervakning

Larma minst på dead-letter outboxjobb, återkommande RLS-fel, misslyckad signering, blockerad kontraktsaktivering, stoppad ekonomisynk, webhookfel och utebliven cron-körning. Loggar ska ha request/correlation ID och aldrig innehålla personnummer, OTP, tokens eller credentials.

## Backup och återställning

Aktivera Supabase PITR för produktion och dokumentera vald RPO/RTO. Storage måste säkerhetskopieras separat. Ett återställningstest ska verifiera databas, Storage-referenser, RLS, Auth-kopplingar, avtalsversioner och dokumenthashar. Inget sådant verkligt återställningstest har genomförts i denna leveransmiljö.

## Incidentrunbook

1. **Upptäck och klassificera:** dataläcka, felaktig RLS, kapat konto, komprometterad nyckel, dubbeluthyrningsförsök, felaktig aktivering, webhook/SSRF eller workerstopp.
2. **Isolera:** pausa berörd route/worker/integration, rotera nycklar, återkalla sessioner och blockera provideråtkomst.
3. **Bevara bevis:** exportera append-only audit, request IDs, providerreferenser och relevanta databassnapshots utan att exponera känsliga värden.
4. **Återställ:** använd verifierad backup/PITR, kör schema- och RLS-verifiering och jämför kontrakts-/dokumenthashar.
5. **Kommunicera:** utse incidentägare, dokumentera tidslinje och bedöm skyldighet att informera berörda och Integritetsskyddsmyndigheten.
6. **Efterarbete:** rotorsak, permanent fix, regressionstest, ny runbook och dokumenterad ansvarig.

### Särskilda första åtgärder

- Felaktig RLS/Storage: stoppa publik trafik, återkalla signed URLs och service keys, verifiera åtkomstloggar.
- Kapat administratörskonto: återkalla sessioner, återställ MFA, rotera credentials och granska audit.
- Felaktig kontraktsaktivering: blockera vidare statusändringar; ändra aldrig signerat dokument i efterhand.
- Dubbeluthyrningsförsök: behåll båda requests och databassvar som bevis; kringgå inte exclusion constraint manuellt.
- Worker/webhookstopp: stoppa nya claims, förläng inte leases blint, återspela idempotent från outbox efter fix.
