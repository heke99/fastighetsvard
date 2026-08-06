import { afterEach, describe, expect, it } from "vitest";
import { getBranding } from "@/lib/branding";

const original = {
  BRAND_NAME: process.env.BRAND_NAME,
  BRAND_SLUG: process.env.BRAND_SLUG,
  BRAND_COMPANY_NAME: process.env.BRAND_COMPANY_NAME,
  BRAND_LEGAL_NAME: process.env.BRAND_LEGAL_NAME,
  BRAND_ORGANIZATION_NUMBER: process.env.BRAND_ORGANIZATION_NUMBER,
  BRAND_TAGLINE: process.env.BRAND_TAGLINE,
  BRAND_PHONE: process.env.BRAND_PHONE,
  BRAND_PHONE_HREF: process.env.BRAND_PHONE_HREF,
  BRAND_POSTAL_ADDRESS: process.env.BRAND_POSTAL_ADDRESS,
  APP_URL: process.env.APP_URL,
  SUPPORT_EMAIL: process.env.SUPPORT_EMAIL,
  PRIVACY_EMAIL: process.env.PRIVACY_EMAIL,
  LEASING_EMAIL: process.env.LEASING_EMAIL,
  FAULT_REPORT_EMAIL: process.env.FAULT_REPORT_EMAIL,
};

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("FaddeBo identity", () => {
  it("keeps customer brand and legal entity separate", () => {
    for (const key of Object.keys(original)) delete process.env[key];

    const brand = getBranding();
    expect(brand.brandName).toBe("FaddeBo");
    expect(brand.brandSlug).toBe("faddebo");
    expect(brand.legalName).toBe("Östgöta El Teknik AB");
    expect(brand.organizationNumber).toBe("559350-5620");
    expect(brand.legalDisplayName).toContain("FaddeBo");
    expect(brand.legalDisplayName).toContain(brand.legalName);
    expect(brand.appUrl).toBe("https://faddebo.se");
    expect(brand.tagline).toBe("Tryggt boende");
    expect(brand.phone).toBe("070-065 06 90");
    expect(brand.phoneHref).toBe("+46700650690");
    expect(brand.postalAddress).toBe("Vasavägen 19, 595 40 Mjölby");
    expect(brand.supportEmail).toBe("info@faddebo.se");
    expect(brand.privacyEmail).toBe("info@faddebo.se");
    expect(brand.leasingEmail).toBe("info@faddebo.se");
    expect(brand.faultReportEmail).toBe("felanmalan@faddebo.se");
  });

  it("supports configuration without coupling the legal name to the brand", () => {
    process.env.BRAND_NAME = "Testbrand";
    process.env.BRAND_LEGAL_NAME = "Juridiskt Testbolag AB";
    process.env.BRAND_ORGANIZATION_NUMBER = "556000-0000";

    const brand = getBranding();
    expect(brand.brandName).toBe("Testbrand");
    expect(brand.legalName).toBe("Juridiskt Testbolag AB");
    expect(brand.legalDisplayName).toContain("556000-0000");
  });

  it("keeps canonical contact addresses despite stale environment variables", () => {
    process.env.SUPPORT_EMAIL = "legacy@example.com";
    process.env.PRIVACY_EMAIL = "legacy@example.com";
    process.env.LEASING_EMAIL = "legacy@example.com";
    process.env.FAULT_REPORT_EMAIL = "legacy@example.com";

    const brand = getBranding();
    expect(brand.supportEmail).toBe("info@faddebo.se");
    expect(brand.privacyEmail).toBe("info@faddebo.se");
    expect(brand.leasingEmail).toBe("info@faddebo.se");
    expect(brand.faultReportEmail).toBe("felanmalan@faddebo.se");
  });

  it("normalizes quoted Vercel URL values", () => {
    process.env.APP_URL = '"https://faddebo.se"';
    const brand = getBranding();
    expect(brand.appUrl).toBe("https://faddebo.se");
    expect(() => new URL(brand.appUrl)).not.toThrow();
  });
});