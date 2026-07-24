export interface BrandingConfig {
  companyName: string;
  legalName: string;
  organizationNumber: string;
  portalName: string;
  tagline: string;
  description: string;
  appUrl: string;
  supportEmail: string;
  privacyEmail: string;
  leasingEmail: string;
  faultReportEmail: string;
  phone: string;
  phoneHref: string;
  emergencyPhone: string;
  emergencyPhoneHref: string;
  postalAddress: string;
}

function value(name: string, fallback: string): string {
  return process.env[name]?.trim() || fallback;
}

/**
 * Icke-hemlig white-label-konfiguration. Värdena läses på servern/build-steget
 * och kan ändras per miljö utan kodändring.
 */
export function getBranding(): BrandingConfig {
  const companyName = value("BRAND_COMPANY_NAME", "Östgöta El Teknik");
  return {
    companyName,
    legalName: value("BRAND_LEGAL_NAME", `${companyName} AB`),
    organizationNumber: value("BRAND_ORGANIZATION_NUMBER", "559350-5620"),
    portalName: value("BRAND_PORTAL_NAME", "Mina sidor"),
    tagline: value("BRAND_TAGLINE", "Fastigheter"),
    description: value(
      "BRAND_DESCRIPTION",
      `${companyName} äger, förvaltar och hyr ut bostäder och lokaler.`
    ),
    appUrl: value("APP_URL", "http://localhost:3000"),
    supportEmail: value("SUPPORT_EMAIL", "info@example.se"),
    privacyEmail: value("PRIVACY_EMAIL", "dataskydd@example.se"),
    leasingEmail: value("LEASING_EMAIL", "uthyrning@example.se"),
    faultReportEmail: value("FAULT_REPORT_EMAIL", "felanmalan@example.se"),
    phone: value("BRAND_PHONE", "070-000 00 00"),
    phoneHref: value("BRAND_PHONE_HREF", "+46700000000"),
    emergencyPhone: value("BRAND_EMERGENCY_PHONE", "013-000 00"),
    emergencyPhoneHref: value("BRAND_EMERGENCY_PHONE_HREF", "+461300000"),
    postalAddress: value("BRAND_POSTAL_ADDRESS", "Adress saknas"),
  };
}
