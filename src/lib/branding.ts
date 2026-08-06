import { getAppUrl } from "@/lib/app-url";
import { cleanEnvValue } from "@/lib/env-value";

export interface BrandingConfig {
  brandName: string;
  brandSlug: string;
  legalName: string;
  legalDisplayName: string;
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
  return cleanEnvValue(process.env[name]) ?? fallback;
}

const GENERAL_EMAIL = "info@faddebo.se";
const FAULT_REPORT_EMAIL = "felanmalan@faddebo.se";

/**
 * Icke-hemlig FaddeBo-konfiguration. Juridiska uppgifter kan konfigureras per
 * miljö, medan kontaktadresserna är låsta till den canonical faddebo.se-domänen.
 */
export function getBranding(): BrandingConfig {
  const brandName = value("BRAND_NAME", "FaddeBo");
  const legalName = value("BRAND_LEGAL_NAME", "Östgöta El Teknik AB");
  const organizationNumber = value("BRAND_ORGANIZATION_NUMBER", "559350-5620");
  return {
    brandName,
    brandSlug: value("BRAND_SLUG", "faddebo"),
    legalName,
    legalDisplayName: value(
      "BRAND_LEGAL_DISPLAY_NAME",
      `${brandName} – ett varumärke inom ${legalName}, org.nr ${organizationNumber}`
    ),
    organizationNumber,
    portalName: value("BRAND_PORTAL_NAME", "Mina sidor"),
    tagline: value("BRAND_TAGLINE", "Tryggt boende"),
    description: value(
      "BRAND_DESCRIPTION",
      `${brandName} förvaltar bostäder och lokaler i Vadstena, Boxholm och Skänninge.`
    ),
    appUrl: getAppUrl(),
    // FaddeBo is a single-brand installation. Contact addresses are canonical
    // constants so stale Vercel variables cannot reintroduce the old domain.
    supportEmail: GENERAL_EMAIL,
    privacyEmail: GENERAL_EMAIL,
    leasingEmail: GENERAL_EMAIL,
    faultReportEmail: FAULT_REPORT_EMAIL,
    phone: value("BRAND_PHONE", "070-065 06 90"),
    phoneHref: value("BRAND_PHONE_HREF", "+46700650690"),
    emergencyPhone: value("BRAND_EMERGENCY_PHONE", "013-000 00"),
    emergencyPhoneHref: value("BRAND_EMERGENCY_PHONE_HREF", "+461300000"),
    postalAddress: value("BRAND_POSTAL_ADDRESS", "Vasavägen 19, 595 40 Mjölby"),
  };
}