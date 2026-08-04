# Canonical Flows

1. Property → building → unit → publishable listing.
2. Verified applicant → profile/household/evidence → idempotent submission →
   immutable snapshot.
3. Eligibility/review → viewing → offer → atomic accept/reservation.
4. Contract version → verified signing bound to document hash → activation →
   tenancy/move-in.
5. Portal → invoices/payments/documents/messages/maintenance.
6. Notice → inspection → keys/final settlement → move-out → unit preparation.

Implemented core RPCs cover submission, offer acceptance, signing, contract
activation and notice/move-in/out primitives. Eligibility, selection,
independent tenancy, inspections and full end-to-end orchestration remain
partial or missing.

## 2026-08-04 clarified flows

- Property → unit → listing draft → validated image/floorplan upload to
  organization/unit path → `UnitMedia` → public listing gallery.
- Active contract → primary/co-tenant parties → unit/person/admin views.
- Tenant fault report → atomic request/status event/in-app notification →
  private validated attachments → internal shared-mail alert and tenant receipt
  → staff status processing → portal history and tenant status e-mail.
- E-mail, webhook and attachment side effects occur after the domain write and
  cannot roll back or falsely hide an already-created request/listing.
