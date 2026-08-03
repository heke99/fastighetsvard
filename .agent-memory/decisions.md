# Architectural Decisions

## ADR-0001: Supabase-native persistence

Status: ACCEPTED

Decision: PostgreSQL/Supabase is authoritative. Prisma runtime and Prisma-like
full-table emulation are not canonical. Critical multi-row writes use RPCs.

Evidence: package dependencies, migrations and hardening tests.

## ADR-0002: Separate brand from legal organization

Status: ACCEPTED

Decision: FaddeBo is customer-facing; Östgöta El Teknik AB, 559350-5620,
remains the legal party. A brand record belongs to the organization.

Forbidden alternative: replacing the legal name in contracts, invoices,
privacy/controller text or accounting evidence.

## ADR-0003: One-landlord organization boundary

Status: ACCEPTED

Decision: retain organization keys for security and ownership without adding
unnecessary marketplace/SaaS tenant complexity.

## ADR-0004: Owner is superadmin; public signup is applicant-only

Status: ACCEPTED

Decision: only `superadmin` is displayed and treated as the owner account. A
public registration never grants staff privileges. Staff and fastighetsvärd
accounts are created by an authorized server-side flow, and only superadmin may
assign `superadmin` or `org-admin`.

Reason: prevents privilege escalation and keeps account behavior consistent
between login routing, navigation, server permissions and PostgreSQL commands.
