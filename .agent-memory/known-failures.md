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

## FAILURE-0004: Internal npm mirror is missing locked Zod tarball

Status: ENVIRONMENTAL / OPEN

Evidence: on 2026-08-03 `npm ci` returned HTTP 404 for
`zod-3.25.76.tgz` from the configured internal package mirror.

Impact: post-change typecheck, Vitest and Next production build could not be
executed in this environment. Static project lint and Node syntax check passed.

Resolution: rerun the release gate in normal development/CI with a complete npm
registry. Do not change dependency versions solely to hide the mirror failure.

## FAILURE-0005: Current role/media/maintenance runtime gate unavailable

Status: ENVIRONMENTAL / OPEN

Evidence: the source archive has no Git metadata, no approved Supabase staging
credentials and no usable dependency installation in this runtime.

Impact: migration `20260804120000_role_context_consistency.sql`, real role
sessions, listing-media uploads, private maintenance attachments and Resend
receipt/internal/status e-mails are source/static verified only.

Resolution: apply the archive to the canonical clone, install locked
dependencies from a complete registry, push all migrations to staging and run
the acceptance matrix in `FADDEBO_KONSEKVENSRAPPORT.md`.
