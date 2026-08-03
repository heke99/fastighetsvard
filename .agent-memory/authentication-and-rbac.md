# Authentication and RBAC

Supabase Auth owns credentials and sessions. `User.authUserId` maps an Auth user
to the application profile; `Person` owns the human.

## Canonical account classes

- `superadmin`: the single owner class. It receives wildcard permission, lands
  on `/admin` and is the only class allowed to assign `superadmin` or
  `org-admin`.
- `property-manager`: Fastighetsvärd / förvaltare. It lands on `/admin` and can
  manage properties, units, listings, applications, contracts and maintenance
  according to seeded permissions.
- applicant: public self-registration without a staff role. It lands on
  `/mina-sidor` and sees applicant functions.
- tenant: applicant/person with `TENANT` person role. It additionally sees
  housing, contracts, invoices and fault reporting.

Role routing is centralized in `src/lib/role-routing.ts`. Navigation hiding is
only user experience; server permission checks and RLS remain authoritative.

## Account creation

Self-registration uses Supabase `signUp`, requires e-mail verification and must
never claim an imported person by e-mail. The app profile is created only after
verified Auth state by the database trigger.

The owner account is created or repaired by the one-time
`scripts/bootstrap-admin.mjs` command exposed as `npm run bootstrap:owner`.
Bootstrap environment variables must be removed after verified login.

Staff accounts are created by an authorized server action. Auth creation uses
`claim_mode=staff_invitation`; app profile and role assignment are completed by
the atomic `provision_staff_user` RPC. The user receives a recovery link and
chooses a password. No shared staff password is displayed or stored.

## E-mail flows

- Signup confirmation: Supabase Auth SMTP.
- Confirmation resend: Supabase Auth `resend`.
- Staff activation and password recovery: server-generated Supabase recovery
  link delivered through the application e-mail provider.
- Default sender/support/privacy/leasing: `info@faddebo.se`.
- Fault-report address: `felanmalan@faddebo.se`.

MFA, support impersonation and privileged-access review remain unverified.
Sensitive reads and exports require audit evidence.
