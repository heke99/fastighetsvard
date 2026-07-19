import { ListingSearchPage } from "@/components/ListingSearch";

export const metadata = { title: "Lediga lokaler" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ListingSearchPage({
    title: "Lediga lokaler",
    description: "Kontor, butiker och lagerlokaler för ditt företag.",
    category: "COMMERCIAL",
    basePath: "/lokaler",
    searchParams: await searchParams,
  });
}
