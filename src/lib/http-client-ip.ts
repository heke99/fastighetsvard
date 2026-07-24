import { isIP } from "node:net";

/**
 * Reads proxy headers only when TRUST_PROXY_HEADERS=true. TRUSTED_PROXY_HOPS
 * is the number of trusted proxy addresses appended to the right side of XFF.
 */
export function getTrustedClientIp(headers: Headers): string | undefined {
  const realIp = headers.get("x-real-ip")?.trim();
  if (process.env.TRUST_PROXY_HEADERS !== "true") {
    return realIp && isIP(realIp) ? realIp : undefined;
  }

  const forwarded = headers
    .get("x-forwarded-for")
    ?.split(",")
    .map((value) => value.trim())
    .filter((value) => isIP(value));
  if (forwarded?.length) {
    const trustedHops = Math.max(0, Number.parseInt(process.env.TRUSTED_PROXY_HOPS ?? "0", 10) || 0);
    const index = Math.max(0, forwarded.length - trustedHops - 1);
    return forwarded[index];
  }
  return realIp && isIP(realIp) ? realIp : undefined;
}
