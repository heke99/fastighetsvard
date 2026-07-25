# Security Model

- Supabase Auth verifies identity.
- Server guards verify application authorization.
- RLS is the final row boundary for user-scoped clients.
- Service-role clients are server-only and must apply explicit organization
  predicates.
- Storage is private and path/metadata-bound.
- Critical commands are idempotent PostgreSQL transactions.
- Accepted/signed/finalized artifacts are immutable.
- Audit is append-only and redacts secrets/personal numbers.

Security acceptance requires negative cross-user, cross-organization,
contractor, sensitive-field and immutable-document tests. Static inspection is
not a substitute for runtime RLS/Storage tests.
