# Organization and RLS

The product is single-landlord, but `organizationId` remains the legal/security
boundary. Do not build unnecessary SaaS tenancy or remove organization
constraints.

RLS rules:

- applicants see their person, applications and linked evidence only;
- tenants see their contract/tenancy, invoices, documents and cases only;
- staff access requires matching organization and capability;
- contractors see assigned work only;
- service role is server-only;
- Storage access must match metadata and path ownership.

Current policies cover core portal reads and private path-bound Storage.
Runtime verification against an applied database is still required. Adding a
table requires explicit RLS enablement and policies in the same migration.
