# Integrations

Current code has e-mail, accounting provider abstractions, inbound/outbound
webhooks and synchronization jobs. Every provider must define timeout, retry,
idempotency, correlation ID, webhook verification, test mode, structured logs
and dead-letter behavior.

Provider credentials are encrypted/server-only and never stored in memory.
Accounting imports must preserve external references and reconcile rather than
silently duplicate people, contracts, invoices or payments.

Email, SMS, production signing, identity verification and accounting runtime
delivery are NOT RUN in the supplied environment.
