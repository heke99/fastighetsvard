import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: {
    default: "Östgöta El Teknik – Bostäder & Lokaler",
    template: "%s | Östgöta El Teknik",
  },
  description:
    "Östgöta El Teknik hyr ut och säljer lägenheter, lokaler och parkeringsplatser i Östergötland.",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="sv">
      <body className="min-h-screen flex flex-col">{children}</body>
    </html>
  );
}
