import { ListingSearchPage } from "@/components/ListingSearch";

export const metadata = { title: "Lediga bostäder" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ListingSearchPage({
    title: "Lediga bostäder",
    description: "Sök och filtrera bland våra publicerade hyreslägenheter.",
    category: "RENTAL",
    basePath: "/lediga-bostader",
    searchParams: await searchParams,
  });
}
