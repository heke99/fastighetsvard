import { execSync } from "child_process";

const TEST_DATABASE_URL =
  "postgresql://app:app@localhost:5432/fastighet_test?schema=public";

/** Kör migrationerna mot testdatabasen innan testsviten startar. */
export default function setup() {
  execSync("npx prisma migrate deploy", {
    env: { ...process.env, DATABASE_URL: TEST_DATABASE_URL },
    stdio: "inherit",
  });
}
