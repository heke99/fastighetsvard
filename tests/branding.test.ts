import { afterEach, describe, expect, it } from "vitest";
import { getBranding } from "@/lib/branding";

const original = {
  BRAND_NAME: process.env.BRAND_NAME,
  BRAND_SLUG: process.env.BRAND_SLUG,
  BRAND_COMPANY_NAME: process.env.BRAND_COMPANY_NAME,
  BRAND_LEGAL_NAME: process.env.BRAND_LEGAL_NAME,
  BRAND_ORGANIZATION_NUMBER: process.env.BRAND_ORGANIZATION_NUMBER,
};

afterEach(() => {
  for (const [key, value] of Object.entries(original)) {
    if (value === undefined) delete process.env[key];
    else process.env[key] = value;
  }
});

describe("FaddeBo identity", () => {
  it("keeps customer brand and legal entity separate", () => {
    delete process.env.BRAND_NAME;
    delete process.env.BRAND_SLUG;
    delete process.env.BRAND_COMPANY_NAME;
    delete process.env.BRAND_LEGAL_NAME;
    delete process.env.BRAND_ORGANIZATION_NUMBER;

    const brand = getBranding();
    expect(brand.brandName).toBe("FaddeBo");
    expect(brand.brandSlug).toBe("faddebo");
    expect(brand.legalName).toBe("Östgöta El Teknik AB");
    expect(brand.organizationNumber).toBe("559350-5620");
    expect(brand.legalDisplayName).toContain("FaddeBo");
    expect(brand.legalDisplayName).toContain(brand.legalName);
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
});
