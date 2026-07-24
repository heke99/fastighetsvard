const baseUrl = (process.env.E2E_BASE_URL || "http://127.0.0.1:3000").replace(/\/$/, "");
const paths = ["/", "/lediga-bostader", "/logga-in", "/skapa-konto"];
let failed = false;
for (const path of paths) {
  try {
    const response = await fetch(`${baseUrl}${path}`, { redirect: "manual" });
    if (response.status >= 500) {
      console.error(`${path}: ${response.status}`);
      failed = true;
    } else {
      console.log(`${path}: ${response.status}`);
    }
  } catch (error) {
    console.error(`${path}: ${error instanceof Error ? error.message : String(error)}`);
    failed = true;
  }
}
if (failed) process.exit(1);
