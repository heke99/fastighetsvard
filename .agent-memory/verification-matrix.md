# Verification Matrix

Current source gate date: 2026-08-04. Historical 2026-07-25 build/test evidence
remains valid only for the source state tested on that date.

| Capability | Unit/static | Current build | E2E | DB | RLS | Storage/provider | Status |
| --- | --- | --- | --- | --- | --- | --- | --- |
| Auth/registration/verification/claim | PASS | NOT RUN | NOT RUN | NOT RUN | NOT RUN | SMTP NOT RUN | PARTIAL |
| RBAC, exact role display and organization scoping | PASS | NOT RUN | NOT RUN | NOT RUN | NOT RUN | n/a | PARTIAL |
| Custom roles and privileged wildcard protection | PASS | NOT RUN | NOT RUN | NOT RUN | NOT RUN | n/a | PARTIAL |
| Properties/buildings/units | PASS | NOT RUN | NOT RUN | NOT RUN | NOT RUN | n/a | PARTIAL |
| Listings and apartment media upload | PASS | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | PARTIAL |
| Tenant/person/contract consistency | PASS | NOT RUN | NOT RUN | NOT RUN | NOT RUN | n/a | PARTIAL |
| Applicant/profile/documents | PASS | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | PARTIAL |
| Applications/offers/reservation | PASS | NOT RUN | NOT RUN | NOT RUN | NOT RUN | n/a | PARTIAL |
| Contracts/signing | PASS | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | PARTIAL |
| Portal/billing/payments | PASS | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | PARTIAL |
| Fault reports, status and attachments | PASS | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | PARTIAL |
| Fault-report e-mail/webhook side effects | PASS | NOT RUN | NOT RUN | NOT RUN | n/a | NOT RUN | PARTIAL |
| Integrations/webhooks/outbox | PASS | NOT RUN | NOT RUN | NOT RUN | NOT RUN | NOT RUN | PARTIAL |
| Legacy-adapter retirement | PASS | historical PASS | n/a | NOT RUN | n/a | n/a | SOURCE VERIFIED |
| 36-migration chain | PASS | NOT RUN | n/a | NOT RUN | NOT RUN | NOT RUN | PARTIAL |
| FaddeBo/legal separation | PASS | NOT RUN | NOT RUN | NOT RUN | NOT RUN | n/a | PARTIAL |
| 2026-07-25 baseline: lint/typecheck/40 tests/build | PASS | PASS | n/a | n/a | n/a | n/a | HISTORICAL VERIFIED |
