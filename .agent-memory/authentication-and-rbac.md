# Authentication and RBAC

Supabase Auth owns credentials and sessions. `User.authUserId` maps an Auth user
to the application profile; `Person` owns the human. Self-registration uses
Supabase verification and must never claim an imported person by email.
Invitation claim is an atomic, verified-email RPC.

Authorization is enforced server-side and through RLS. UI hiding is only user
experience. Existing permission strings use `resource:action` with `*`
wildcards. Existing role slugs are legacy-compatible and need a deliberate
mapping to the canonical platform/landlord/external vocabulary before removal.

MFA, support impersonation and privileged-access review are not verified.
Sensitive reads and exports require audit evidence.
