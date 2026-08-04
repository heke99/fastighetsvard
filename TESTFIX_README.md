# FaddeBo testfix 2026-08-04

Ändrade filer:

- `src/lib/app-url.ts`: canonical fallback är `https://faddebo.se` i test/CI/produktion, medan lokal utveckling fortsatt använder `http://localhost:3000` när `APP_URL` saknas.
- `src/lib/supabase/users.ts`: kontrollerar befintlig Supabase Auth-användare med paginerad `listUsers` innan en personal- eller entreprenörsinbjudan skickas.

Kör efter synkning:

```bash
npm run typecheck
npm run test:unit
npm run build
```
