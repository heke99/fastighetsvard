# Known Failures

## FAILURE-0001: Generic adapter scaled and transacted incorrectly

Status: RESOLVED IN SOURCE

Resolution: migrated reads to scoped queries and multi-row writes to domain
RPCs; deleted the adapter and Prisma-shaped generated metadata. Lint and tests
prevent regression. Runtime query plans and command behavior remain part of
the database gate.

## FAILURE-0002: Local database verification unavailable

Status: BLOCKED

Evidence: Docker is absent in the current environment. No approved remote test
database credentials were supplied.

Resolution: run Supabase reset/push plus schema, RLS, Storage and concurrency
tests in an approved test environment.

## FAILURE-0003: Supabase CLI default config path is read-only here

Status: ENVIRONMENTAL

Evidence: the CLI attempted to create `/root/.supabase` and failed with EROFS.

Resolution: run in the normal developer/CI environment or set a writable CLI
config directory; do not weaken application filesystem permissions.
