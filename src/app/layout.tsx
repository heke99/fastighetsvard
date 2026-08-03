import type { Metadata } from "next";
import { getBranding } from "@/lib/branding";
import "./globals.css";

const brand = getBranding();

export const metadata: Metadata = {
  metadataBase: new URL(brand.appUrl),
  title: {
    default: `${brand.brandName} – Bostäder & lokaler`,
    template: `%s | ${brand.brandName}`,
  },
  description: brand.description,
  icons: {
    icon: "/icon.png",
    apple: "/apple-icon.png",
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
