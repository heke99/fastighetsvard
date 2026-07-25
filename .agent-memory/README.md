# FaddeBo Project Memory

This Git-versioned memory gives future sessions a compact, verified resume
point. It is navigation and decision history, not runtime source of truth.

## Required read order

1. `AGENTS.md`
2. `current-state.md`
3. `open-blockers.md`
4. `next-actions.md`
5. `canonical-architecture.md`
6. Relevant domain documents
7. `decisions.md` and `known-failures.md`

## Authority

Active code → current database schema → executed tests → runtime evidence →
canonical documentation → active ADRs → this memory → old reports.

Record evidence and label uncertainty `UNVERIFIED:` with a concrete
`Required verification:`. Move superseded decisions or stale reports to
`archive/`; never blend incompatible models.

Update memory in the same task as code. Only executed, passing work belongs in
`completed-work.md`. Keep `current-state.md` short and always leave an exact
file/function/command resume point.

Never store credentials, `.env` contents, tokens, private keys, personal
numbers, tenant documents, customer data, production rows, full conversations,
chain of thought, large terminal logs or source-file copies here.
