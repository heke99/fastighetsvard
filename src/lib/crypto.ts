import {
  createHash,
  createHmac,
  randomBytes,
  createCipheriv,
  createDecipheriv,
  timingSafeEqual,
} from "crypto";

export function sha256(input: string): string {
  return createHash("sha256").update(input).digest("hex");
}

export function hmacSha256(secret: string, payload: string): string {
  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function generateToken(bytes = 32): string {
  return randomBytes(bytes).toString("base64url");
}

export function generateApiKey(): { key: string; prefix: string; hash: string } {
  const key = `oet_${randomBytes(32).toString("base64url")}`;
  return { key, prefix: key.slice(0, 12), hash: sha256(key) };
}

export function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a);
  const bb = Buffer.from(b);
  if (ba.length !== bb.length) return false;
  return timingSafeEqual(ba, bb);
}

function encryptionKey(): Buffer {
  const hex = process.env.APP_ENCRYPTION_KEY;
  if (!hex || hex.length !== 64) {
    throw new Error("APP_ENCRYPTION_KEY måste vara 64 hex-tecken (32 byte)");
  }
  return Buffer.from(hex, "hex");
}

/** AES-256-GCM-kryptering för integrations-credentials. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", encryptionKey(), iv);
  const enc = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return `${iv.toString("base64")}.${tag.toString("base64")}.${enc.toString("base64")}`;
}

export function decryptSecret(ciphertext: string): string {
  const [ivB64, tagB64, dataB64] = ciphertext.split(".");
  const decipher = createDecipheriv(
    "aes-256-gcm",
    encryptionKey(),
    Buffer.from(ivB64, "base64")
  );
  decipher.setAuthTag(Buffer.from(tagB64, "base64"));
  return Buffer.concat([
    decipher.update(Buffer.from(dataB64, "base64")),
    decipher.final(),
  ]).toString("utf8");
}

/**
 * Signatur för utgående webhooks: `t=<unix>,v1=<hmac>` där hmac beräknas
 * över `<timestamp>.<body>`. Mottagaren kan verifiera och avvisa gamla
 * tidsstämplar (replay-skydd).
 */
export function signWebhookPayload(secret: string, body: string, timestamp?: number) {
  const t = timestamp ?? Math.floor(Date.now() / 1000);
  const signature = hmacSha256(secret, `${t}.${body}`);
  return { header: `t=${t},v1=${signature}`, timestamp: t, signature };
}

export function verifyWebhookSignature(
  secret: string,
  body: string,
  header: string,
  toleranceSeconds = 300
): boolean {
  const parts = Object.fromEntries(
    header.split(",").map((p) => p.split("=") as [string, string])
  );
  const t = parseInt(parts["t"] ?? "", 10);
  const v1 = parts["v1"];
  if (!t || !v1) return false;
  const age = Math.abs(Math.floor(Date.now() / 1000) - t);
  if (age > toleranceSeconds) return false;
  const expected = hmacSha256(secret, `${t}.${body}`);
  return safeEqual(expected, v1);
}
