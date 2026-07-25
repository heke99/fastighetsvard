# API Contracts

REST v1 routes live in `src/app/api/v1`; OpenAPI is served by
`src/app/api/v1/openapi/route.ts`. API keys are organization-scoped, hashed and
scope-checked. Mutating API requests use PostgreSQL-backed idempotency helpers.

Public contracts must use validated DTOs and never expose personal numbers,
secret hashes, provider credentials or internal-only notes. Breaking contract
changes require versioning and updated tests/docs.

UNVERIFIED: generated OpenAPI/schema parity and runtime authorization for every
route. Required verification: contract-test all routes against a migrated test
database.
