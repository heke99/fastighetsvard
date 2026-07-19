-- Östgöta El Teknik Fastighetsplattform
-- Step: Idempotent repair for identity, RBAC, properties and listings
-- Safe to run in filename order. This file is transactional.

BEGIN;
SET LOCAL search_path = public, extensions;

ALTER TABLE public."Organization" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Organization" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;

ALTER TABLE public."Organization" ADD COLUMN IF NOT EXISTS "orgNumber" TEXT;

ALTER TABLE public."Organization" ADD COLUMN IF NOT EXISTS "email" TEXT;

ALTER TABLE public."Organization" ADD COLUMN IF NOT EXISTS "phone" TEXT;

ALTER TABLE public."Organization" ADD COLUMN IF NOT EXISTS "address" TEXT;

ALTER TABLE public."Organization" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Organization" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Organization_pkey'
      AND conrelid = 'public."Organization"'::regclass
  ) THEN
    ALTER TABLE public."Organization" ADD CONSTRAINT "Organization_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."MasterDataConfig" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."MasterDataConfig" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."MasterDataConfig" ADD COLUMN IF NOT EXISTS "domain" "MasterDataDomain" NOT NULL;

ALTER TABLE public."MasterDataConfig" ADD COLUMN IF NOT EXISTS "masterSystem" TEXT NOT NULL;

ALTER TABLE public."MasterDataConfig" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."MasterDataConfig" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MasterDataConfig_pkey'
      AND conrelid = 'public."MasterDataConfig"'::regclass
  ) THEN
    ALTER TABLE public."MasterDataConfig" ADD CONSTRAINT "MasterDataConfig_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "firstName" TEXT NOT NULL;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "lastName" TEXT NOT NULL;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "email" TEXT;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "phone" TEXT;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "personalNumber" TEXT;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "orgNumber" TEXT;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "isCompany" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "companyName" TEXT;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "address" TEXT;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "city" TEXT;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'SE';

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "protectedIdentity" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "gdprAnonymizedAt" TIMESTAMP(3);

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Person" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Person_pkey'
      AND conrelid = 'public."Person"'::regclass
  ) THEN
    ALTER TABLE public."Person" ADD CONSTRAINT "Person_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."PersonRole" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."PersonRole" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."PersonRole" ADD COLUMN IF NOT EXISTS "role" "PersonRoleType" NOT NULL;

ALTER TABLE public."PersonRole" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PersonRole_pkey'
      AND conrelid = 'public."PersonRole"'::regclass
  ) THEN
    ALTER TABLE public."PersonRole" ADD CONSTRAINT "PersonRole_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "authUserId" UUID NOT NULL;

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "personId" TEXT;

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "email" TEXT NOT NULL;

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "emailVerifiedAt" TIMESTAMP(3);

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "phoneVerifiedAt" TIMESTAMP(3);

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "lastLoginAt" TIMESTAMP(3);

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."User" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'User_pkey'
      AND conrelid = 'public."User"'::regclass
  ) THEN
    ALTER TABLE public."User" ADD CONSTRAINT "User_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Invitation" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Invitation" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Invitation" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."Invitation" ADD COLUMN IF NOT EXISTS "email" TEXT NOT NULL;

ALTER TABLE public."Invitation" ADD COLUMN IF NOT EXISTS "tokenHash" TEXT NOT NULL;

ALTER TABLE public."Invitation" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Invitation" ADD COLUMN IF NOT EXISTS "acceptedAt" TIMESTAMP(3);

ALTER TABLE public."Invitation" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invitation_pkey'
      AND conrelid = 'public."Invitation"'::regclass
  ) THEN
    ALTER TABLE public."Invitation" ADD CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Role" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Role" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

ALTER TABLE public."Role" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;

ALTER TABLE public."Role" ADD COLUMN IF NOT EXISTS "slug" TEXT NOT NULL;

ALTER TABLE public."Role" ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE public."Role" ADD COLUMN IF NOT EXISTS "isSystem" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Role" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Role" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Role_pkey'
      AND conrelid = 'public."Role"'::regclass
  ) THEN
    ALTER TABLE public."Role" ADD CONSTRAINT "Role_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."RolePermission" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."RolePermission" ADD COLUMN IF NOT EXISTS "roleId" TEXT NOT NULL;

ALTER TABLE public."RolePermission" ADD COLUMN IF NOT EXISTS "permission" TEXT NOT NULL;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'RolePermission_pkey'
      AND conrelid = 'public."RolePermission"'::regclass
  ) THEN
    ALTER TABLE public."RolePermission" ADD CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."UserRole" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."UserRole" ADD COLUMN IF NOT EXISTS "userId" TEXT NOT NULL;

ALTER TABLE public."UserRole" ADD COLUMN IF NOT EXISTS "roleId" TEXT NOT NULL;

ALTER TABLE public."UserRole" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;

ALTER TABLE public."UserRole" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UserRole_pkey'
      AND conrelid = 'public."UserRole"'::regclass
  ) THEN
    ALTER TABLE public."UserRole" ADD CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "designation" TEXT;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "address" TEXT NOT NULL;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "city" TEXT NOT NULL;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "municipality" TEXT;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "country" TEXT NOT NULL DEFAULT 'SE';

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "ownerName" TEXT;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "managerName" TEXT;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "yearBuilt" INTEGER;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "yearRenovated" INTEGER;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "energyClass" TEXT;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "insuranceInfo" TEXT;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "contactInfo" TEXT;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "emergencyPhone" TEXT;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE';

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Property" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Property_pkey'
      AND conrelid = 'public."Property"'::regclass
  ) THEN
    ALTER TABLE public."Property" ADD CONSTRAINT "Property_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Building" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Building" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Building" ADD COLUMN IF NOT EXISTS "propertyId" TEXT NOT NULL;

ALTER TABLE public."Building" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;

ALTER TABLE public."Building" ADD COLUMN IF NOT EXISTS "address" TEXT;

ALTER TABLE public."Building" ADD COLUMN IF NOT EXISTS "yearBuilt" INTEGER;

ALTER TABLE public."Building" ADD COLUMN IF NOT EXISTS "floorsCount" INTEGER;

ALTER TABLE public."Building" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Building" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Building_pkey'
      AND conrelid = 'public."Building"'::regclass
  ) THEN
    ALTER TABLE public."Building" ADD CONSTRAINT "Building_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Entrance" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Entrance" ADD COLUMN IF NOT EXISTS "buildingId" TEXT NOT NULL;

ALTER TABLE public."Entrance" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;

ALTER TABLE public."Entrance" ADD COLUMN IF NOT EXISTS "address" TEXT;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Entrance_pkey'
      AND conrelid = 'public."Entrance"'::regclass
  ) THEN
    ALTER TABLE public."Entrance" ADD CONSTRAINT "Entrance_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Floor" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Floor" ADD COLUMN IF NOT EXISTS "entranceId" TEXT NOT NULL;

ALTER TABLE public."Floor" ADD COLUMN IF NOT EXISTS "level" INTEGER NOT NULL;

ALTER TABLE public."Floor" ADD COLUMN IF NOT EXISTS "name" TEXT;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Floor_pkey'
      AND conrelid = 'public."Floor"'::regclass
  ) THEN
    ALTER TABLE public."Floor" ADD CONSTRAINT "Floor_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "propertyId" TEXT NOT NULL;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "buildingId" TEXT;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "entranceId" TEXT;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "floorId" TEXT;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "parentUnitId" TEXT;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "unitNumber" TEXT NOT NULL;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "apartmentNumber" TEXT;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "type" "UnitType" NOT NULL;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "status" "UnitStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "address" TEXT NOT NULL;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "postalCode" TEXT;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "city" TEXT NOT NULL;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "area" TEXT;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "floorLevel" INTEGER;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "rooms" DECIMAL(4,1);

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "livingArea" DECIMAL(8,2);

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "secondaryArea" DECIMAL(8,2);

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "rent" DECIMAL(12,2);

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "price" DECIMAL(14,2);

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "operatingCost" DECIMAL(12,2);

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "deposit" DECIMAL(12,2);

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "availableFrom" TIMESTAMP(3);

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "noticePeriodMonths" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "hasElevator" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "hasBalcony" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "hasPatio" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "hasStorage" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "hasParking" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "furnished" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "accessible" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "petsAllowed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "smokingAllowed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "internetIncluded" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "tvIncluded" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "heatingIncluded" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "waterIncluded" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "electricityIncluded" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "shortTermAllowed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "seniorHousing" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "studentHousing" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "description" TEXT;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "internalNotes" TEXT;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Unit" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Unit_pkey'
      AND conrelid = 'public."Unit"'::regclass
  ) THEN
    ALTER TABLE public."Unit" ADD CONSTRAINT "Unit_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."UnitMedia" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."UnitMedia" ADD COLUMN IF NOT EXISTS "unitId" TEXT NOT NULL;

ALTER TABLE public."UnitMedia" ADD COLUMN IF NOT EXISTS "kind" "MediaKind" NOT NULL;

ALTER TABLE public."UnitMedia" ADD COLUMN IF NOT EXISTS "url" TEXT NOT NULL;

ALTER TABLE public."UnitMedia" ADD COLUMN IF NOT EXISTS "caption" TEXT;

ALTER TABLE public."UnitMedia" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."UnitMedia" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UnitMedia_pkey'
      AND conrelid = 'public."UnitMedia"'::regclass
  ) THEN
    ALTER TABLE public."UnitMedia" ADD CONSTRAINT "UnitMedia_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "unitId" TEXT NOT NULL;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "slug" TEXT NOT NULL;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "category" "ListingCategory" NOT NULL;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "publishAt" TIMESTAMP(3);

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "applicationDeadline" TIMESTAMP(3);

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "moveInDate" TIMESTAMP(3);

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "rent" DECIMAL(12,2);

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "price" DECIMAL(14,2);

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "contactName" TEXT;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "contactEmail" TEXT;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "requirementProfile" TEXT;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "queueRules" TEXT;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "seoTitle" TEXT;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "seoDescription" TEXT;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "featured" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "unpublishedAt" TIMESTAMP(3);

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Listing" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Listing_pkey'
      AND conrelid = 'public."Listing"'::regclass
  ) THEN
    ALTER TABLE public."Listing" ADD CONSTRAINT "Listing_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ListingPublication" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ListingPublication" ADD COLUMN IF NOT EXISTS "listingId" TEXT NOT NULL;

ALTER TABLE public."ListingPublication" ADD COLUMN IF NOT EXISTS "channel" TEXT NOT NULL;

ALTER TABLE public."ListingPublication" ADD COLUMN IF NOT EXISTS "publishedAt" TIMESTAMP(3);

ALTER TABLE public."ListingPublication" ADD COLUMN IF NOT EXISTS "unpublishedAt" TIMESTAMP(3);

ALTER TABLE public."ListingPublication" ADD COLUMN IF NOT EXISTS "externalUrl" TEXT;

ALTER TABLE public."ListingPublication" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ListingPublication_pkey'
      AND conrelid = 'public."ListingPublication"'::regclass
  ) THEN
    ALTER TABLE public."ListingPublication" ADD CONSTRAINT "ListingPublication_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Favorite" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Favorite" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Favorite" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."Favorite" ADD COLUMN IF NOT EXISTS "listingId" TEXT NOT NULL;

ALTER TABLE public."Favorite" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Favorite_pkey'
      AND conrelid = 'public."Favorite"'::regclass
  ) THEN
    ALTER TABLE public."Favorite" ADD CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."SavedSearch" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."SavedSearch" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."SavedSearch" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."SavedSearch" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;

ALTER TABLE public."SavedSearch" ADD COLUMN IF NOT EXISTS "criteria" JSONB NOT NULL;

ALTER TABLE public."SavedSearch" ADD COLUMN IF NOT EXISTS "emailAlerts" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public."SavedSearch" ADD COLUMN IF NOT EXISTS "smsAlerts" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."SavedSearch" ADD COLUMN IF NOT EXISTS "lastNotifiedAt" TIMESTAMP(3);

ALTER TABLE public."SavedSearch" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."SavedSearch" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SavedSearch_pkey'
      AND conrelid = 'public."SavedSearch"'::regclass
  ) THEN
    ALTER TABLE public."SavedSearch" ADD CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

COMMIT;
