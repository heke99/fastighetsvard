import { describe, it, expect } from "vitest";
import {
  sha256,
  signWebhookPayload,
  verifyWebhookSignature,
  encryptSecret,
  decryptSecret,
  generateApiKey,
} from "@/lib/crypto";

describe("webhooksignaturer", () => {
  it("verifierar korrekt signatur", () => {
    const secret = "whsec_test123";
    const body = JSON.stringify({ id: "evt_1", type: "invoice.paid" });
    const { header } = signWebhookPayload(secret, body);
    expect(verifyWebhookSignature(secret, body, header)).toBe(true);
  });

  it("avvisar fel hemlighet (fel webhooksignatur)", () => {
    const body = JSON.stringify({ id: "evt_1" });
    const { header } = signWebhookPayload("ratt-hemlighet", body);
    expect(verifyWebhookSignature("fel-hemlighet", body, header)).toBe(false);
  });

  it("avvisar manipulerad body", () => {
    const secret = "whsec_test123";
    const { header } = signWebhookPayload(secret, '{"amount":100}');
    expect(verifyWebhookSignature(secret, '{"amount":99999}', header)).toBe(false);
  });

  it("avvisar för gamla tidsstämplar (replay-skydd)", () => {
    const secret = "whsec_test123";
    const body = "{}";
    const old = Math.floor(Date.now() / 1000) - 3600;
    const { header } = signWebhookPayload(secret, body, old);
    expect(verifyWebhookSignature(secret, body, header)).toBe(false);
    // Men inom toleransen är den ok.
    expect(verifyWebhookSignature(secret, body, header, 7200)).toBe(true);
  });
});

describe("kryptering av integrations-credentials", () => {
  it("krypterar och dekrypterar", () => {
    const plaintext = JSON.stringify({ apiKey: "hemlig-nyckel" });
    const encrypted = encryptSecret(plaintext);
    expect(encrypted).not.toContain("hemlig-nyckel");
    expect(decryptSecret(encrypted)).toBe(plaintext);
  });
});

describe("API-nycklar", () => {
  it("genererar nyckel med prefix och hash", () => {
    const { key, prefix, hash } = generateApiKey();
    expect(key.startsWith("oet_")).toBe(true);
    expect(key.startsWith(prefix)).toBe(true);
    expect(hash).toBe(sha256(key));
  });
});
