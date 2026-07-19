import { ListingSearchPage } from "@/components/ListingSearch";

export const metadata = { title: "Parkeringsplatser" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ListingSearchPage({
    title: "Lediga parkeringsplatser",
    description: "Parkeringsplatser och garage i anslutning till våra fastigheter.",
    category: "PARKING",
    basePath: "/parkering",
    searchParams: await searchParams,
  });
}
