import { prisma } from "@/lib/db";

let counter = 0;

/** Skapar en isolerad organisation per test (tenant-isolering i testerna). */
export async function createTestOrg(name?: string) {
  counter++;
  const unique = `${Date.now().toString(36)}${counter}${Math.random().toString(36).slice(2, 10)}`;
  return prisma.organization.create({
    data: {
      name: name ?? `Testorg ${unique}`,
      orgNumber: `556-${unique}`,
    },
  });
}

export async function createTestProperty(organizationId: string) {
  return prisma.property.create({
    data: {
      organizationId,
      name: "Testfastigheten",
      address: "Testgatan 1",
      city: "Linköping",
    },
  });
}

export async function createTestUnit(
  organizationId: string,
  propertyId: string,
  unitNumber: string,
  overrides: Record<string, unknown> = {}
) {
  return prisma.unit.create({
    data: {
      organizationId,
      propertyId,
      unitNumber,
      type: "APARTMENT",
      status: "NOT_PUBLISHED",
      address: `Testgatan ${unitNumber}`,
      city: "Linköping",
      rooms: 2,
      livingArea: 55,
      rent: 7000,
      noticePeriodMonths: 3,
      ...overrides,
    },
  });
}

export async function createTestPerson(
  organizationId: string,
  overrides: Record<string, unknown> = {}
) {
  counter++;
  return prisma.person.create({
    data: {
      organizationId,
      firstName: "Test",
      lastName: `Person${counter}`,
      email: `test${Date.now()}-${counter}@example.com`,
      ...overrides,
    },
  });
}

export async function createPublishedListing(
  organizationId: string,
  unitId: string,
  slugSuffix: string
) {
  return prisma.listing.create({
    data: {
      organizationId,
      unitId,
      title: `Testannons ${slugSuffix}`,
      slug: `testannons-${slugSuffix}-${Date.now()}`,
      description: "En fin testlägenhet.",
      category: "RENTAL",
      status: "PUBLISHED",
      publishedAt: new Date(),
      rent: 7000,
    },
  });
}

export { prisma };
