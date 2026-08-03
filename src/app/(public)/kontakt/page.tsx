import { getBranding } from "@/lib/branding";

export const metadata = { title: "Kontakt" };

export default function ContactPage() {
  const brand = getBranding();
  return (
    <div className="mx-auto max-w-3xl px-4 py-10 sm:px-6">
      <h1 className="text-2xl font-bold text-stone-900 sm:text-3xl">Kontakta oss</h1>
      <p className="mt-2 text-stone-600">
        Vi hjälper dig med frågor om lediga objekt, ditt hyresförhållande, fakturor
        och felanmälningar.
      </p>
      <div className="mt-8 grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold text-stone-900">Kundtjänst</h2>
          <p className="mt-1 text-sm text-stone-600">Vardagar 08–11</p>
          <p className="mt-2 text-sm">
            <a href={`tel:${brand.phoneHref}`} className="font-medium text-brand-700">{brand.phone}</a>
          </p>
          <p className="text-sm">
            <a href={`mailto:${brand.supportEmail}`} className="font-medium text-brand-700">{brand.supportEmail}</a>
          </p>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-stone-900">Jour – akuta fel</h2>
          <p className="mt-1 text-sm text-stone-600">Dygnet runt</p>
          <p className="mt-2 text-sm">
            <a href={`tel:${brand.emergencyPhoneHref}`} className="font-medium text-brand-700">{brand.emergencyPhone}</a>
          </p>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-stone-900">Uthyrning</h2>
          <p className="mt-2 text-sm">
            <a href={`mailto:${brand.leasingEmail}`} className="font-medium text-brand-700">{brand.leasingEmail}</a>
          </p>
        </div>
        <div className="card p-5">
          <h2 className="font-semibold text-stone-900">Besöksadress</h2>
          <address className="mt-2 text-sm not-italic text-stone-600">
            {brand.legalName}<br />
            {brand.postalAddress}
          </address>
        </div>
      </div>
    </div>
  );
}
