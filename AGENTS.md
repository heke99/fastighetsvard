# Agent Operating Contract

This is a long-lived production project for FaddeBo.

Before any non-trivial task:

1. Read `.agent-memory/README.md`.
2. Read `.agent-memory/current-state.md`.
3. Read `.agent-memory/open-blockers.md`.
4. Read `.agent-memory/next-actions.md`.
5. Read `.agent-memory/canonical-architecture.md`.
6. Read the relevant domain memory.
7. Inspect the actual implementation.
8. Search `.agent-memory/decisions.md` and `.agent-memory/known-failures.md`.

During work:

- Treat active code, the current database schema and executed tests as stronger evidence than memory.
- Preserve canonical flows and one source of truth per domain.
- Keep organization, authorization, RLS and Storage boundaries intact.
- Mark assumptions and unavailable runtime checks explicitly.
- Add regression tests with behavior changes.
- Never store secrets, personal identifiers or production data in project memory.
- Never claim verification that was not performed.
- Update project memory in the same change as implementation.
- Continue with the next prioritized task after completing a work unit.

Before completing:

1. Review every changed file.
2. Run relevant tests, typecheck, lint and build.
3. Verify affected database, RLS, Storage, idempotency and concurrency behavior.
4. Update `.agent-memory`.
5. Add an ADR or known-failure entry when required.
6. Record the exact resume point.

Code being written is not evidence that a capability works.
