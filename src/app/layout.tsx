import type { Metadata } from "next";
import { getBranding } from "@/lib/branding";
import "./globals.css";

const brand = getBranding();

export const metadata: Metadata = {
  metadataBase: new URL(brand.appUrl),
  title: {
    default: `${brand.companyName} – Bostäder & lokaler`,
    template: `%s | ${brand.companyName}`,
  },
  description: brand.description,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
