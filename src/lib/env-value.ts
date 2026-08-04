/**
 * Vercel stores environment variable values exactly as entered. A surprisingly
 * common production mistake is pasting shell syntax such as "https://..."
 * including the quote characters. Local dotenv parsers remove those quotes,
 * while Vercel does not. Keep normalization in one place so build/runtime
 * behavior is consistent in both environments.
 */
export function cleanEnvValue(value: string | undefined): string | undefined {
  if (value == null) return undefined;
  let cleaned = value.trim();

  for (let pass = 0; pass < 2; pass += 1) {
    if (cleaned.length < 2) break;
    const first = cleaned[0];
    const last = cleaned[cleaned.length - 1];
    if ((first === '"' && last === '"') || (first === "'" && last === "'")) {
      cleaned = cleaned.slice(1, -1).trim();
      continue;
    }
    break;
  }

  return cleaned || undefined;
}

export function requireEnvValue(name: string, value: string | undefined): string {
  const cleaned = cleanEnvValue(value);
  if (!cleaned) throw new Error(`Miljövariabeln ${name} saknas.`);
  return cleaned;
}

export function normalizeHttpUrl(
  value: string | undefined,
  fallback?: string
): string {
  const candidate = cleanEnvValue(value) ?? cleanEnvValue(fallback);
  if (!candidate) throw new Error("En publik applikations-URL saknas.");

  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    throw new Error(`Ogiltig URL i miljökonfigurationen: ${candidate}`);
  }

  if (parsed.protocol !== "https:" && parsed.protocol !== "http:") {
    throw new Error(`URL måste använda http eller https: ${candidate}`);
  }

  parsed.hash = "";
  parsed.search = "";
  return parsed.toString().replace(/\/$/, "");
}
