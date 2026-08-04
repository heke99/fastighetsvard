import { cleanEnvValue, normalizeHttpUrl } from "@/lib/env-value";

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

  return "http://localhost:3000";
}
