# Domain Model

## Organization

Purpose: legal landlord and isolation boundary. Identifier: `Organization.id`.
Source: `Organization`. Invariants: legal identity is not the customer-facing
brand; organization-scoped rows must match their parent organization.

## Brand

Purpose: customer-facing FaddeBo identity. Identifier: `Brand.id`. Organization:
required. Status: ACTIVE/INACTIVE/ARCHIVED. Source: `Brand`. Invariants: at most
one primary active brand per organization; legal display remains linked to the
legal organization.

## Property → Building → Entrance/Floor → Unit

Purpose: canonical physical hierarchy. Identifiers: table `id` values. Source:
the corresponding table. Invariants: parent and child organization must match;
unit status transitions must be command-controlled.

## Listing → Application → Offer → Reservation

Purpose: rental funnel. Source: existing canonical tables plus immutable
application snapshot and RPC transitions. Accepted offers reserve exactly one
unit atomically.

## Contract and tenancy

`Contract` is currently both lease artifact and active rental relationship.
Contract versions and signing evidence are immutable. A separate canonical
`Tenancy` lifecycle is still missing and must not be simulated with another
parallel model.

## Document, invoice/payment, maintenance and events

`Document` is the metadata source; private Storage holds bytes. `Invoice` and
`Payment` own economics. `MaintenanceRequest`/`WorkOrder` own service cases.
`OutboxEvent` owns asynchronous delivery intent and `AuditEvent` owns immutable
audit evidence.
