import { cleanEnvValue, normalizeHttpUrl } from "@/lib/env-value";

const CANONICAL_APP_URL = "https://faddebo.se";
const LOCAL_APP_URL = "http://localhost:3000";

export function getAppUrl(): string {
  const configured = cleanEnvValue(process.env.APP_URL);
  if (configured) return normalizeHttpUrl(configured);

  const productionHost = cleanEnvValue(process.env.VERCEL_PROJECT_PRODUCTION_URL);
  if (productionHost) {
    return normalizeHttpUrl(
      productionHost.startsWith("http") ? productionHost : `https://${productionHost}`
    );
  }

  const vercelHost = cleanEnvValue(process.env.VERCEL_URL);
  if (vercelHost) {
    return normalizeHttpUrl(
      vercelHost.startsWith("http") ? vercelHost : `https://${vercelHost}`
    );
  }

  // Local utveckling ska fortsätta fungera utan APP_URL. I test, CI och annan
  // produktionslik miljö används däremot den canonical FaddeBo-adressen så att
  // aktiverings-, återställnings- och verifieringslänkar aldrig pekar mot localhost.
  return process.env.NODE_ENV === "development" ? LOCAL_APP_URL : CANONICAL_APP_URL;
}
