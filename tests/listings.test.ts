import { describe, it, expect } from "vitest";
import {
  changeListingStatus,
  unpublishListingsForUnit,
  searchListings,
  slugify,
} from "@/lib/services/listings";
import {
  createTestOrg,
  createTestProperty,
  createTestUnit,
  createPublishedListing,
  prisma,
} from "./helpers";

describe("annonser", () => {
  it("slugify hanterar svenska tecken", () => {
    expect(slugify("Ljus 3:a på Östgötagatan")).toBe("ljus-3-a-pa-ostgotagatan");
  });

  it("publicering följer statusmaskinen och loggar publiceringskanal", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const unit = await createTestUnit(org.id, property.id, "ANN-1");
    const listing = await prisma.listing.create({
      data: {
        organizationId: org.id,
        unitId: unit.id,
        title: "Testannons",
        slug: `ann-1-${Date.now()}`,
        description: "Beskrivning",
        category: "RENTAL",
        status: "DRAFT",
      },
    });

    const published = await changeListingStatus(org.id, listing.id, "PUBLISHED");
    expect(published.status).toBe("PUBLISHED");
    expect(published.publishedAt).not.toBeNull();

    const unitAfter = await prisma.unit.findUnique({ where: { id: unit.id } });
    expect(unitAfter?.status).toBe("PUBLISHED");

    const pubs = await prisma.listingPublication.findMany({ where: { listingId: listing.id } });
    expect(pubs.length).toBeGreaterThanOrEqual(1);

    // Avslutad annons kan inte publiceras igen.
    await changeListingStatus(org.id, listing.id, "COMPLETED");
    await expect(changeListingStatus(org.id, listing.id, "PUBLISHED")).rejects.toThrow(
      /ogiltig statusövergång/i
    );
  });

  it("avpublicerar automatiskt alla annonser när objektet hyrs ut", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const unit = await createTestUnit(org.id, property.id, "ANN-2");
    const listing = await createPublishedListing(org.id, unit.id, "ann2");

    const count = await unpublishListingsForUnit(org.id, unit.id, "Uthyrd");
    expect(count).toBe(1);

    const after = await prisma.listing.findUnique({ where: { id: listing.id } });
    expect(after?.status).toBe("COMPLETED");
  });

  it("sökning filtrerar på egenskaper, hyra och stad", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const cheap = await createTestUnit(org.id, property.id, "SOK-1", {
      rent: 5000, hasBalcony: true, city: "Motala",
    });
    const expensive = await createTestUnit(org.id, property.id, "SOK-2", {
      rent: 12000, hasBalcony: false, city: "Motala",
    });
    const l1 = await prisma.listing.create({
      data: {
        organizationId: org.id, unitId: cheap.id, title: "Billig med balkong",
        slug: `sok1-${Date.now()}`, description: "x", category: "RENTAL",
        status: "PUBLISHED", publishedAt: new Date(), rent: 5000,
      },
    });
    await prisma.listing.create({
      data: {
        organizationId: org.id, unitId: expensive.id, title: "Dyr utan balkong",
        slug: `sok2-${Date.now()}`, description: "x", category: "RENTAL",
        status: "PUBLISHED", publishedAt: new Date(), rent: 12000,
      },
    });

    const result = await searchListings({
      city: "Motala",
      rentMax: 6000,
      balcony: true,
    });
    const ids = result.items.map((i) => i.id);
    expect(ids).toContain(l1.id);
    expect(result.items.every((i) => Number(i.rent) <= 6000)).toBe(true);
  });

  it("opublicerade annonser syns aldrig i sökresultatet", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const unit = await createTestUnit(org.id, property.id, "SOK-3", { city: "Mjölby" });
    await prisma.listing.create({
      data: {
        organizationId: org.id, unitId: unit.id, title: "Utkast i Mjölby",
        slug: `sok3-${Date.now()}`, description: "x", category: "RENTAL", status: "DRAFT",
      },
    });
    const result = await searchListings({ city: "Mjölby" });
    expect(result.items.find((i) => i.title === "Utkast i Mjölby")).toBeUndefined();
  });
});

describe("favoriter", () => {
  it("en favorit per person och annons (unikt index)", async () => {
    const org = await createTestOrg();
    const property = await createTestProperty(org.id);
    const unit = await createTestUnit(org.id, property.id, "FAV-1");
    const listing = await createPublishedListing(org.id, unit.id, "fav1");
    const person = await prisma.person.create({
      data: { organizationId: org.id, firstName: "Fav", lastName: "Orit", email: `fav-${Date.now()}@example.com` },
    });

    await prisma.favorite.create({
      data: { organizationId: org.id, personId: person.id, listingId: listing.id },
    });
    await expect(
      prisma.favorite.create({
        data: { organizationId: org.id, personId: person.id, listingId: listing.id },
      })
    ).rejects.toThrow();
  });
});
