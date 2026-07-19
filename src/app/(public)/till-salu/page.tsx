import { ListingSearchPage } from "@/components/ListingSearch";

export const metadata = { title: "Bostäder till salu" };
export const dynamic = "force-dynamic";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  return ListingSearchPage({
    title: "Bostäder till salu",
    description: "Lägenheter och fastigheter som just nu är till försäljning.",
    category: "SALE",
    basePath: "/till-salu",
    searchParams: await searchParams,
  });
}
