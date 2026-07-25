# Project Identity

- Product: FaddeBo
- Legal organization: Östgöta El Teknik AB
- Organization number: 559350-5620
- Purpose: one-landlord property, rental and tenant platform
- Stack: Next.js 15 App Router, React 19, TypeScript strict, Supabase Auth,
  PostgreSQL/RLS/Storage, Vitest, Vercel
- Package manager/runtime contract: npm 10.9.2, Node 22.16.0
- Database migration path: `supabase/migrations`
- App entry: `src/app`
- Domain commands: `src/lib/services` and `src/lib/repositories`
- Hosting target: Vercel; database/Auth/Storage target: Supabase

UNVERIFIED: Git repository URL, branch and commit are absent from the supplied
archive.

Required verification: inspect the original clone with
`git remote -v && git branch --show-current && git rev-parse HEAD`.

Production status: not ready. Static build and legacy-adapter retirement are
green; live database/RLS/Storage, E2E, provider and deployment gates remain.
