/**
 * Seed-skript: skapar organisationen Östgöta El Teknik, systemroller,
 * en superadmin, demofastigheter, objekt, annonser och en befintlig hyresgäst.
 *
 * Körs med: npm run db:seed
 */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const SYSTEM_ROLES: { slug: string; name: string; permissions: string[] }[] = [
  { slug: "superadmin", name: "Superadmin", permissions: ["*"] },
  {
    slug: "org-admin",
    name: "Bolagsadmin",
    permissions: [
      "persons:*", "users:*", "roles:*", "properties:*", "buildings:*",
      "units:*", "listings:*", "applications:*", "viewings:*", "offers:*",
      "contracts:*", "terminations:*", "inspections:*", "invoices:*",
      "payments:*", "maintenance:*", "workorders:*", "suppliers:*",
      "documents:*", "messages:*", "notifications:*", "integrations:*",
      "webhooks:*", "apikeys:*", "imports:*", "reports:*", "audit:read", "settings:*",
    ],
  },
  {
    slug: "property-owner",
    name: "Fastighetsägare",
    permissions: [
      "properties:read", "buildings:read", "units:read", "listings:read",
      "contracts:read", "invoices:read", "payments:read", "reports:*",
      "maintenance:read", "workorders:read", "audit:read",
    ],
  },
  {
    slug: "property-manager",
    name: "Förvaltare",
    permissions: [
      "persons:*", "properties:*", "buildings:*", "units:*", "listings:*",
      "applications:*", "viewings:*", "offers:*", "contracts:*",
      "terminations:*", "inspections:*", "maintenance:*", "workorders:*",
      "suppliers:*", "documents:*", "messages:*", "invoices:read",
      "payments:read", "imports:*", "reports:read",
    ],
  },
  {
    slug: "caretaker",
    name: "Fastighetsvärd",
    permissions: [
      "properties:read", "buildings:read", "units:read", "maintenance:*",
      "workorders:*", "messages:*", "persons:read", "documents:read",
    ],
  },
  {
    slug: "leasing-agent",
    name: "Uthyrare",
    permissions: [
      "persons:*", "units:read", "units:update", "listings:*",
      "applications:*", "viewings:*", "offers:*", "contracts:*",
      "documents:*", "messages:*", "reports:read",
    ],
  },
  {
    slug: "sales-manager",
    name: "Försäljningsansvarig",
    permissions: [
      "persons:read", "units:read", "units:update", "listings:*",
      "viewings:*", "offers:*", "contracts:*", "documents:*", "messages:*", "reports:read",
    ],
  },
  {
    slug: "finance",
    name: "Ekonom",
    permissions: [
      "persons:read", "contracts:read", "invoices:*", "payments:*",
      "integrations:*", "reports:*", "audit:read",
    ],
  },
  {
    slug: "customer-service",
    name: "Kundtjänst",
    permissions: [
      "persons:read", "persons:update", "units:read", "listings:read",
      "applications:read", "applications:update", "contracts:read",
      "invoices:read", "maintenance:*", "messages:*", "documents:read",
    ],
  },
  {
    slug: "facility-worker",
    name: "Fastighetsskötare",
    permissions: ["maintenance:read", "maintenance:update", "workorders:read", "workorders:update", "units:read"],
  },
  {
    slug: "inspector",
    name: "Besiktningsman",
    permissions: ["inspections:*", "units:read", "contracts:read", "documents:create", "documents:read"],
  },
  { slug: "contractor", name: "Entreprenör", permissions: ["workorders:read", "workorders:update"] },
  { slug: "report-viewer", name: "Rapportläsare", permissions: ["reports:read"] },
];

async function main() {
  console.log("Seedar databasen …");

  // Organisation
  const org = await prisma.organization.upsert({
    where: { orgNumber: "556000-0000" },
    create: {
      name: "Östgöta El Teknik AB",
      orgNumber: "556000-0000",
      email: "info@ostgotaelteknik.se",
      phone: "013-10 00 00",
      address: "Industrigatan 12, 582 55 Linköping",
    },
    update: {},
  });

  // Master-konfiguration: bokföringssystemet äger kunder/fakturor/betalningar.
  for (const domain of ["CUSTOMERS", "INVOICES", "PAYMENTS", "CREDIT_NOTES"] as const) {
    await prisma.masterDataConfig.upsert({
      where: { organizationId_domain: { organizationId: org.id, domain } },
      create: { organizationId: org.id, domain, masterSystem: "accounting" },
      update: {},
    });
  }

  // Systemroller (globala – organizationId null)
  const roleMap = new Map<string, string>();
  for (const r of SYSTEM_ROLES) {
    let role = await prisma.role.findFirst({ where: { organizationId: null, slug: r.slug } });
    if (!role) {
      role = await prisma.role.create({
        data: {
          organizationId: null,
          slug: r.slug,
          name: r.name,
          isSystem: true,
          permissions: { create: r.permissions.map((permission) => ({ permission })) },
        },
      });
    }
    roleMap.set(r.slug, role.id);
  }

  // Superadmin
  const adminEmail = "admin@ostgotaelteknik.se";
  let admin = await prisma.user.findUnique({ where: { email: adminEmail } });
  if (!admin) {
    const adminPerson = await prisma.person.create({
      data: {
        organizationId: org.id,
        firstName: "Admin",
        lastName: "Administratör",
        email: adminEmail,
      },
    });
    admin = await prisma.user.create({
      data: {
        organizationId: org.id,
        personId: adminPerson.id,
        email: adminEmail,
        passwordHash: await bcrypt.hash("Admin123!Demo", 12),
        emailVerifiedAt: new Date(),
      },
    });
    await prisma.userRole.create({
      data: { userId: admin.id, roleId: roleMap.get("superadmin")! },
    });
    console.log(`Superadmin skapad: ${adminEmail} / Admin123!Demo`);
  }

  // Demofastighet med objekt
  let property = await prisma.property.findFirst({
    where: { organizationId: org.id, name: "Kvarteret Eken" },
  });
  if (!property) {
    property = await prisma.property.create({
      data: {
        organizationId: org.id,
        name: "Kvarteret Eken",
        designation: "Eken 3",
        address: "Ekgatan 10-14",
        postalCode: "582 45",
        city: "Linköping",
        municipality: "Linköping",
        yearBuilt: 1968,
        yearRenovated: 2015,
        energyClass: "C",
        emergencyPhone: "013-10 00 01",
        buildings: {
          create: [
            { organizationId: org.id, name: "Hus A", address: "Ekgatan 10", floorsCount: 4 },
            { organizationId: org.id, name: "Hus B", address: "Ekgatan 12", floorsCount: 4 },
          ],
        },
      },
    });

    const property2 = await prisma.property.create({
      data: {
        organizationId: org.id,
        name: "Strandhuset",
        designation: "Strand 1",
        address: "Strandvägen 2",
        postalCode: "602 22",
        city: "Norrköping",
        municipality: "Norrköping",
        yearBuilt: 2001,
        energyClass: "B",
        emergencyPhone: "013-10 00 01",
      },
    });

    const unitsData = [
      { unitNumber: "1101", type: "APARTMENT", address: "Ekgatan 10", city: "Linköping", area: "Vasastaden", floorLevel: 1, rooms: 2, livingArea: 58, rent: 7400, hasBalcony: true, status: "NOT_PUBLISHED", propertyId: property.id },
      { unitNumber: "1102", type: "APARTMENT", address: "Ekgatan 10", city: "Linköping", area: "Vasastaden", floorLevel: 2, rooms: 3, livingArea: 74, rent: 9200, hasBalcony: true, hasElevator: true, status: "NOT_PUBLISHED", propertyId: property.id },
      { unitNumber: "1201", type: "APARTMENT", address: "Ekgatan 12", city: "Linköping", area: "Vasastaden", floorLevel: 1, rooms: 1, livingArea: 34, rent: 5600, studentHousing: true, status: "NOT_PUBLISHED", propertyId: property.id },
      { unitNumber: "2101", type: "APARTMENT", address: "Strandvägen 2", city: "Norrköping", area: "Saltängen", floorLevel: 3, rooms: 4, livingArea: 96, rent: 12100, hasBalcony: true, hasElevator: true, petsAllowed: true, status: "NOT_PUBLISHED", propertyId: property2.id },
      { unitNumber: "P-01", type: "PARKING", address: "Ekgatan 10", city: "Linköping", area: "Vasastaden", rent: 650, status: "NOT_PUBLISHED", propertyId: property.id },
      { unitNumber: "L-01", type: "COMMERCIAL", address: "Ekgatan 14", city: "Linköping", area: "Vasastaden", livingArea: 120, rent: 14500, status: "NOT_PUBLISHED", propertyId: property.id },
      { unitNumber: "S-01", type: "APARTMENT_SALE", address: "Strandvägen 2", city: "Norrköping", area: "Saltängen", floorLevel: 5, rooms: 3, livingArea: 82, price: 3195000, hasBalcony: true, hasElevator: true, status: "NOT_PUBLISHED", propertyId: property2.id },
    ] as const;

    for (const u of unitsData) {
      await prisma.unit.create({
        data: {
          organizationId: org.id,
          propertyId: u.propertyId,
          unitNumber: u.unitNumber,
          type: u.type,
          status: u.status,
          address: u.address,
          city: u.city,
          area: u.area,
          floorLevel: "floorLevel" in u ? u.floorLevel : null,
          rooms: "rooms" in u ? u.rooms : null,
          livingArea: "livingArea" in u ? u.livingArea : null,
          rent: "rent" in u ? u.rent : null,
          price: "price" in u ? u.price : null,
          hasBalcony: "hasBalcony" in u ? Boolean(u.hasBalcony) : false,
          hasElevator: "hasElevator" in u ? Boolean(u.hasElevator) : false,
          petsAllowed: "petsAllowed" in u ? Boolean(u.petsAllowed) : false,
          studentHousing: "studentHousing" in u ? Boolean(u.studentHousing) : false,
        },
      });
    }
    console.log("Fastigheter och objekt skapade.");
  }

  // Publicerade annonser
  const listingCount = await prisma.listing.count({ where: { organizationId: org.id } });
  if (listingCount === 0) {
    const listingsData: { unitNumber: string; title: string; category: "RENTAL" | "SALE" | "COMMERCIAL" | "PARKING"; slug: string; featured?: boolean; description: string }[] = [
      { unitNumber: "1102", title: "Ljus 3:a med balkong i Vasastaden", category: "RENTAL", slug: "ljus-3a-vasastaden-1102", featured: true, description: "Rymlig trerummare med balkong i söderläge, nyrenoverat kök och hiss i huset. Nära city, universitetet och grönområden." },
      { unitNumber: "1201", title: "Smart 1:a för student nära universitetet", category: "RENTAL", slug: "student-1a-1201", description: "Perfekt studentbostad med effektiv planlösning. Gångavstånd till Campus Valla. El och internet ingår i hyran." },
      { unitNumber: "2101", title: "Stor 4:a med sjöutsikt på Strandvägen", category: "RENTAL", slug: "stor-4a-strandvagen-2101", featured: true, description: "Familjevänlig fyrarummare högst upp med balkong och fri utsikt över Motala ström. Husdjur välkomna." },
      { unitNumber: "P-01", title: "Parkeringsplats Ekgatan", category: "PARKING", slug: "parkering-ekgatan-p01", description: "Utomhusplats med motorvärmaruttag i anslutning till Kvarteret Eken." },
      { unitNumber: "L-01", title: "Butikslokal 120 m² i gatuplan", category: "COMMERCIAL", slug: "butikslokal-ekgatan-l01", description: "Flexibel lokal i gatuplan med stora skyltfönster. Passar butik, kontor eller showroom." },
      { unitNumber: "S-01", title: "Till salu: 3:a med bästa läget i Saltängen", category: "SALE", slug: "till-salu-3a-saltangen-s01", featured: true, description: "Välplanerad trerummare på våning 5 med balkong i väster. Låg avgift, hiss och garage i huset." },
    ];
    for (const l of listingsData) {
      const unit = await prisma.unit.findFirst({
        where: { organizationId: org.id, unitNumber: l.unitNumber },
      });
      if (!unit) continue;
      await prisma.listing.create({
        data: {
          organizationId: org.id,
          unitId: unit.id,
          title: l.title,
          slug: l.slug,
          description: l.description,
          category: l.category,
          status: "PUBLISHED",
          publishedAt: new Date(),
          rent: unit.rent,
          price: unit.price,
          moveInDate: new Date(Date.now() + 45 * 24 * 3600 * 1000),
          contactName: "Uthyrningen, Östgöta El Teknik",
          contactEmail: "uthyrning@ostgotaelteknik.se",
          contactPhone: "013-10 00 00",
          featured: l.featured ?? false,
          seoTitle: l.title,
          seoDescription: l.description.slice(0, 160),
          publications: { create: [{ channel: "web", publishedAt: new Date() }] },
        },
      });
      await prisma.unit.update({ where: { id: unit.id }, data: { status: "PUBLISHED" } });
    }
    console.log("Annonser publicerade.");
  }

  // Befintlig hyresgäst med aktivt (importerat) avtal + konto
  const tenantEmail = "greta.hyresgast@example.com";
  let tenantPerson = await prisma.person.findFirst({
    where: { organizationId: org.id, email: tenantEmail },
  });
  if (!tenantPerson) {
    const unit = await prisma.unit.findFirst({
      where: { organizationId: org.id, unitNumber: "1101" },
    });
    tenantPerson = await prisma.person.create({
      data: {
        organizationId: org.id,
        firstName: "Greta",
        lastName: "Hyresgäst",
        email: tenantEmail,
        phone: "070-123 45 67",
        personalNumber: "198501011234",
        roles: { create: [{ role: "TENANT" }] },
      },
    });
    if (unit) {
      await prisma.contract.create({
        data: {
          organizationId: org.id,
          unitId: unit.id,
          contractNumber: "HK-2022-1",
          type: "RESIDENTIAL",
          status: "ACTIVE",
          startDate: new Date("2022-03-01"),
          noticePeriodMonths: 3,
          rent: 7400,
          isImported: true,
          activatedAt: new Date("2022-03-01"),
          invoiceReference: "HK-2022-1",
          parties: {
            create: [{ personId: tenantPerson.id, role: "TENANT", signedAt: new Date("2022-02-15"), signatureMethod: "manual" }],
          },
          versions: {
            create: [{ versionNumber: 1, content: { rent: 7400, startDate: "2022-03-01", imported: true } }],
          },
          statusHistory: { create: [{ toStatus: "ACTIVE", comment: "Importerat befintligt avtal" }] },
        },
      });
      await prisma.unit.update({ where: { id: unit.id }, data: { status: "RENTED" } });
      // Extern kundmappning mot mock-bokföringssystem.
      await prisma.externalReference.create({
        data: {
          organizationId: org.id,
          externalSystem: "mock",
          entityType: "customer",
          externalId: "CUST-1001",
          personId: tenantPerson.id,
          syncStatus: "synced",
          lastSyncedAt: new Date(),
        },
      });
    }
    await prisma.user.create({
      data: {
        organizationId: org.id,
        personId: tenantPerson.id,
        email: tenantEmail,
        passwordHash: await bcrypt.hash("Hyresgast123!", 12),
        emailVerifiedAt: new Date(),
      },
    });
    console.log(`Demohyresgäst skapad: ${tenantEmail} / Hyresgast123!`);
  }

  // Mock-integrationsanslutning med demodata
  const existingConn = await prisma.integrationConnection.findFirst({
    where: { organizationId: org.id, provider: "mock" },
  });
  if (!existingConn) {
    await prisma.integrationConnection.create({
      data: {
        organizationId: org.id,
        provider: "mock",
        name: "Mock bokföringssystem (demo)",
        webhookSecret: "whsec_demo_mock_secret",
        settings: {
          invoices: [
            {
              externalId: "INV-9001",
              invoiceNumber: "2026-1001",
              externalCustomerId: "CUST-1001",
              invoiceDate: "2026-06-25",
              dueDate: "2026-07-31",
              periodStart: "2026-07-01",
              periodEnd: "2026-07-31",
              totalAmount: 7400,
              vatAmount: 0,
              paidAmount: 0,
              currency: "SEK",
              status: "sent",
              ocr: "202610011",
              bankgiro: "123-4567",
              reference: "HK-2022-1",
              lines: [
                { description: "Hyra juli 2026, lgh 1101", quantity: 1, unitPrice: 7400, vatRate: 0, amount: 7400 },
              ],
            },
            {
              externalId: "INV-9000",
              invoiceNumber: "2026-0901",
              externalCustomerId: "CUST-1001",
              invoiceDate: "2026-05-25",
              dueDate: "2026-06-30",
              periodStart: "2026-06-01",
              periodEnd: "2026-06-30",
              totalAmount: 7400,
              vatAmount: 0,
              paidAmount: 7400,
              currency: "SEK",
              status: "paid",
              ocr: "202609011",
              bankgiro: "123-4567",
              reference: "HK-2022-1",
              lines: [
                { description: "Hyra juni 2026, lgh 1101", quantity: 1, unitPrice: 7400, vatRate: 0, amount: 7400 },
              ],
            },
          ],
          payments: [
            {
              externalId: "PAY-5000",
              externalInvoiceId: "INV-9000",
              amount: 7400,
              currency: "SEK",
              paidAt: "2026-06-27",
              method: "bankgiro",
              reference: "202609011",
            },
          ],
        },
      },
    });
    console.log("Mock-integration skapad (kör synk från /admin/integrationer).");
  }

  console.log("Seed klar.");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
