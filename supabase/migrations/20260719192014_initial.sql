-- Supabase-native schema for Östgöta El Teknik Fastighetsplattform
-- Generated from the previous relational model; no Prisma runtime is required.

BEGIN;

SET LOCAL search_path = public, extensions;

CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'MasterDataDomain'
  ) THEN
    CREATE TYPE public."MasterDataDomain" AS ENUM ('CUSTOMERS', 'INVOICES', 'PAYMENTS', 'CREDIT_NOTES', 'REMINDERS', 'LEDGER', 'CONTRACTS');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'PersonRoleType'
  ) THEN
    CREATE TYPE public."PersonRoleType" AS ENUM ('APPLICANT', 'TENANT', 'CO_APPLICANT', 'GUARANTOR', 'BUYER', 'CONTACT', 'HOUSEHOLD_MEMBER');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'PropertyStatus'
  ) THEN
    CREATE TYPE public."PropertyStatus" AS ENUM ('ACTIVE', 'UNDER_RENOVATION', 'SOLD', 'ARCHIVED');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'UnitType'
  ) THEN
    CREATE TYPE public."UnitType" AS ENUM ('APARTMENT', 'APARTMENT_SALE', 'COMMERCIAL', 'OFFICE', 'RETAIL', 'WAREHOUSE', 'GARAGE', 'PARKING', 'STORAGE', 'STUDENT', 'SHORT_TERM', 'LAND', 'PROPERTY_SALE');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'UnitStatus'
  ) THEN
    CREATE TYPE public."UnitStatus" AS ENUM ('DRAFT', 'NOT_PUBLISHED', 'UPCOMING', 'PUBLISHED', 'APPLICATION_OPEN', 'VIEWING', 'OFFER_SENT', 'RESERVED', 'CONTRACT_SENT', 'RENTED', 'FOR_SALE', 'BIDDING', 'SOLD', 'RENOVATING', 'BLOCKED', 'NOT_RENTABLE', 'ARCHIVED');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'MediaKind'
  ) THEN
    CREATE TYPE public."MediaKind" AS ENUM ('IMAGE', 'VIDEO', 'FLOORPLAN', 'DOCUMENT');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ListingCategory'
  ) THEN
    CREATE TYPE public."ListingCategory" AS ENUM ('RENTAL', 'SALE', 'COMMERCIAL', 'PARKING');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ListingStatus'
  ) THEN
    CREATE TYPE public."ListingStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'PUBLISHED', 'PAUSED', 'UNPUBLISHED', 'COMPLETED');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ApplicationStatus'
  ) THEN
    CREATE TYPE public."ApplicationStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'RECEIVED', 'UNDER_REVIEW', 'NEEDS_SUPPLEMENT', 'QUALIFIED', 'NOT_QUALIFIED', 'VIEWING_OFFERED', 'VIEWING_BOOKED', 'OFFER_SENT', 'ACCEPTED', 'DECLINED', 'CONTRACT_SENT', 'CONTRACT_SIGNED', 'CLOSED', 'WITHDRAWN');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ApplicationMemberRole'
  ) THEN
    CREATE TYPE public."ApplicationMemberRole" AS ENUM ('MAIN_APPLICANT', 'CO_APPLICANT', 'HOUSEHOLD_MEMBER', 'CHILD', 'GUARANTOR');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ViewingKind'
  ) THEN
    CREATE TYPE public."ViewingKind" AS ENUM ('INDIVIDUAL', 'GROUP', 'DIGITAL', 'SELF_SERVICE');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ViewingAttendeeStatus'
  ) THEN
    CREATE TYPE public."ViewingAttendeeStatus" AS ENUM ('INVITED', 'BOOKED', 'WAITLISTED', 'CHECKED_IN', 'ATTENDED', 'NO_SHOW', 'CANCELLED');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'OfferStatus'
  ) THEN
    CREATE TYPE public."OfferStatus" AS ENUM ('SENT', 'ACCEPTED', 'DECLINED', 'EXPIRED', 'WITHDRAWN');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ContractType'
  ) THEN
    CREATE TYPE public."ContractType" AS ENUM ('RESIDENTIAL', 'COMMERCIAL', 'PARKING', 'GARAGE', 'STORAGE', 'SHORT_TERM', 'SUBLEASE', 'ADDENDUM', 'GUARANTEE');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ContractStatus'
  ) THEN
    CREATE TYPE public."ContractStatus" AS ENUM ('DRAFT', 'INTERNAL_REVIEW', 'APPROVED', 'SENT_FOR_SIGNING', 'PARTIALLY_SIGNED', 'SIGNED', 'ACTIVE', 'TERMINATED', 'ENDED', 'RESCINDED', 'ARCHIVED');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ContractPartyRole'
  ) THEN
    CREATE TYPE public."ContractPartyRole" AS ENUM ('LANDLORD', 'TENANT', 'CO_TENANT', 'GUARANTOR');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'TerminationStatus'
  ) THEN
    CREATE TYPE public."TerminationStatus" AS ENUM ('REQUESTED', 'CONFIRMED', 'INSPECTION_BOOKED', 'COMPLETED', 'CANCELLED');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'InspectionType'
  ) THEN
    CREATE TYPE public."InspectionType" AS ENUM ('PRE_MOVE_OUT', 'FINAL', 'MOVE_IN');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'InvoiceStatus'
  ) THEN
    CREATE TYPE public."InvoiceStatus" AS ENUM ('DRAFT', 'SENT', 'PARTIALLY_PAID', 'PAID', 'OVERDUE', 'REMINDED', 'COLLECTION', 'CREDITED', 'CANCELLED', 'DISPUTED');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'SyncJobStatus'
  ) THEN
    CREATE TYPE public."SyncJobStatus" AS ENUM ('PENDING', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ReviewItemStatus'
  ) THEN
    CREATE TYPE public."ReviewItemStatus" AS ENUM ('PENDING', 'RESOLVED', 'REJECTED');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'MaintenanceStatus'
  ) THEN
    CREATE TYPE public."MaintenanceStatus" AS ENUM ('RECEIVED', 'CONFIRMED', 'ASSESSING', 'NEEDS_INFO', 'ASSIGNED', 'BOOKED', 'IN_PROGRESS', 'WAITING_TENANT', 'WAITING_CONTRACTOR', 'WAITING_MATERIAL', 'DONE', 'QUALITY_CHECK', 'CLOSED', 'REJECTED', 'REOPENED');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'MaintenancePriority'
  ) THEN
    CREATE TYPE public."MaintenancePriority" AS ENUM ('LOW', 'NORMAL', 'HIGH', 'URGENT');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'WorkOrderStatus'
  ) THEN
    CREATE TYPE public."WorkOrderStatus" AS ENUM ('CREATED', 'OFFERED', 'ACCEPTED', 'REJECTED', 'BOOKED', 'IN_PROGRESS', 'DONE', 'APPROVED', 'INVOICED', 'CANCELLED');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'DocumentType'
  ) THEN
    CREATE TYPE public."DocumentType" AS ENUM ('CONTRACT', 'TERMINATION', 'INSPECTION_PROTOCOL', 'KEY_RECEIPT', 'INFO_LETTER', 'INVOICE', 'CREDIT_NOTE', 'PAYMENT_PLAN', 'POWER_OF_ATTORNEY', 'SUBLEASE', 'TRANSFER', 'GUARANTEE', 'SALE_DOCUMENT', 'ENERGY_DECLARATION', 'FLOORPLAN', 'OTHER');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'NotificationChannel'
  ) THEN
    CREATE TYPE public."NotificationChannel" AS ENUM ('EMAIL', 'SMS', 'IN_APP', 'PUSH');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'WebhookDeliveryStatus'
  ) THEN
    CREATE TYPE public."WebhookDeliveryStatus" AS ENUM ('PENDING', 'DELIVERED', 'FAILED', 'DEAD_LETTER');
  END IF;
END
$enum$;

-- CreateEnum
DO $enum$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type t
    JOIN pg_namespace n ON n.oid = t.typnamespace
    WHERE n.nspname = 'public'
      AND t.typname = 'ImportJobStatus'
  ) THEN
    CREATE TYPE public."ImportJobStatus" AS ENUM ('PREVIEW', 'RUNNING', 'COMPLETED', 'COMPLETED_WITH_ERRORS', 'FAILED', 'ROLLED_BACK');
  END IF;
END
$enum$;

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Organization" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "name" TEXT NOT NULL,
    "orgNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "address" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Organization_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."MasterDataConfig" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "domain" "MasterDataDomain" NOT NULL,
    "masterSystem" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MasterDataConfig_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Person" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "firstName" TEXT NOT NULL,
    "lastName" TEXT NOT NULL,
    "email" TEXT,
    "phone" TEXT,
    "personalNumber" TEXT,
    "orgNumber" TEXT,
    "isCompany" BOOLEAN NOT NULL DEFAULT false,
    "companyName" TEXT,
    "address" TEXT,
    "postalCode" TEXT,
    "city" TEXT,
    "country" TEXT NOT NULL DEFAULT 'SE',
    "protectedIdentity" BOOLEAN NOT NULL DEFAULT false,
    "gdprAnonymizedAt" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Person_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."PersonRole" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "personId" TEXT NOT NULL,
    "role" "PersonRoleType" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PersonRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."User" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "authUserId" UUID NOT NULL,
    "organizationId" TEXT,
    "personId" TEXT,
    "email" TEXT NOT NULL,
    "emailVerifiedAt" TIMESTAMP(3),
    "phoneVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "supplierId" TEXT,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Invitation" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "acceptedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invitation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Role" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT,
    "name" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Role_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."RolePermission" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "roleId" TEXT NOT NULL,
    "permission" TEXT NOT NULL,

    CONSTRAINT "RolePermission_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."UserRole" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "propertyId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserRole_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Property" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "designation" TEXT,
    "address" TEXT NOT NULL,
    "postalCode" TEXT,
    "city" TEXT NOT NULL,
    "municipality" TEXT,
    "country" TEXT NOT NULL DEFAULT 'SE',
    "ownerName" TEXT,
    "managerName" TEXT,
    "yearBuilt" INTEGER,
    "yearRenovated" INTEGER,
    "energyClass" TEXT,
    "insuranceInfo" TEXT,
    "contactInfo" TEXT,
    "emergencyPhone" TEXT,
    "status" "PropertyStatus" NOT NULL DEFAULT 'ACTIVE',
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Property_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Building" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,
    "yearBuilt" INTEGER,
    "floorsCount" INTEGER,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Building_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Entrance" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "buildingId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "address" TEXT,

    CONSTRAINT "Entrance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Floor" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "entranceId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT,

    CONSTRAINT "Floor_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Unit" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "propertyId" TEXT NOT NULL,
    "buildingId" TEXT,
    "entranceId" TEXT,
    "floorId" TEXT,
    "parentUnitId" TEXT,
    "unitNumber" TEXT NOT NULL,
    "apartmentNumber" TEXT,
    "type" "UnitType" NOT NULL,
    "status" "UnitStatus" NOT NULL DEFAULT 'DRAFT',
    "address" TEXT NOT NULL,
    "postalCode" TEXT,
    "city" TEXT NOT NULL,
    "area" TEXT,
    "floorLevel" INTEGER,
    "rooms" DECIMAL(4,1),
    "livingArea" DECIMAL(8,2),
    "secondaryArea" DECIMAL(8,2),
    "rent" DECIMAL(12,2),
    "price" DECIMAL(14,2),
    "operatingCost" DECIMAL(12,2),
    "deposit" DECIMAL(12,2),
    "availableFrom" TIMESTAMP(3),
    "noticePeriodMonths" INTEGER NOT NULL DEFAULT 3,
    "hasElevator" BOOLEAN NOT NULL DEFAULT false,
    "hasBalcony" BOOLEAN NOT NULL DEFAULT false,
    "hasPatio" BOOLEAN NOT NULL DEFAULT false,
    "hasStorage" BOOLEAN NOT NULL DEFAULT false,
    "hasParking" BOOLEAN NOT NULL DEFAULT false,
    "furnished" BOOLEAN NOT NULL DEFAULT false,
    "accessible" BOOLEAN NOT NULL DEFAULT false,
    "petsAllowed" BOOLEAN NOT NULL DEFAULT false,
    "smokingAllowed" BOOLEAN NOT NULL DEFAULT false,
    "internetIncluded" BOOLEAN NOT NULL DEFAULT false,
    "tvIncluded" BOOLEAN NOT NULL DEFAULT false,
    "heatingIncluded" BOOLEAN NOT NULL DEFAULT false,
    "waterIncluded" BOOLEAN NOT NULL DEFAULT false,
    "electricityIncluded" BOOLEAN NOT NULL DEFAULT false,
    "shortTermAllowed" BOOLEAN NOT NULL DEFAULT false,
    "seniorHousing" BOOLEAN NOT NULL DEFAULT false,
    "studentHousing" BOOLEAN NOT NULL DEFAULT false,
    "description" TEXT,
    "internalNotes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Unit_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."UnitMedia" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "unitId" TEXT NOT NULL,
    "kind" "MediaKind" NOT NULL,
    "url" TEXT NOT NULL,
    "caption" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UnitMedia_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Listing" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "category" "ListingCategory" NOT NULL,
    "status" "ListingStatus" NOT NULL DEFAULT 'DRAFT',
    "publishAt" TIMESTAMP(3),
    "publishedAt" TIMESTAMP(3),
    "applicationDeadline" TIMESTAMP(3),
    "moveInDate" TIMESTAMP(3),
    "rent" DECIMAL(12,2),
    "price" DECIMAL(14,2),
    "contactName" TEXT,
    "contactEmail" TEXT,
    "contactPhone" TEXT,
    "requirementProfile" TEXT,
    "queueRules" TEXT,
    "seoTitle" TEXT,
    "seoDescription" TEXT,
    "featured" BOOLEAN NOT NULL DEFAULT false,
    "unpublishedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Listing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."ListingPublication" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "listingId" TEXT NOT NULL,
    "channel" TEXT NOT NULL,
    "publishedAt" TIMESTAMP(3),
    "unpublishedAt" TIMESTAMP(3),
    "externalUrl" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ListingPublication_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Favorite" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Favorite_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."SavedSearch" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "criteria" JSONB NOT NULL,
    "emailAlerts" BOOLEAN NOT NULL DEFAULT true,
    "smsAlerts" BOOLEAN NOT NULL DEFAULT false,
    "lastNotifiedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SavedSearch_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Application" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT',
    "isInternalTransfer" BOOLEAN NOT NULL DEFAULT false,
    "desiredMoveInDate" TIMESTAMP(3),
    "currentHousing" TEXT,
    "currentLandlord" TEXT,
    "employment" TEXT,
    "employer" TEXT,
    "employmentType" TEXT,
    "monthlyIncome" DECIMAL(12,2),
    "otherIncome" TEXT,
    "references" TEXT,
    "pets" TEXT,
    "vehicles" TEXT,
    "specialNeeds" TEXT,
    "message" TEXT,
    "consentGivenAt" TIMESTAMP(3),
    "submittedAt" TIMESTAMP(3),
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Application_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."ApplicationMember" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "applicationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "ApplicationMemberRole" NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationMember_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."ApplicationStatusEvent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "applicationId" TEXT NOT NULL,
    "fromStatus" "ApplicationStatus",
    "toStatus" "ApplicationStatus" NOT NULL,
    "comment" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApplicationStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Viewing" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "kind" "ViewingKind" NOT NULL DEFAULT 'INDIVIDUAL',
    "startsAt" TIMESTAMP(3) NOT NULL,
    "endsAt" TIMESTAMP(3) NOT NULL,
    "maxAttendees" INTEGER,
    "location" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Viewing_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."ViewingAttendee" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "viewingId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "applicationId" TEXT,
    "status" "ViewingAttendeeStatus" NOT NULL DEFAULT 'BOOKED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ViewingAttendee_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Offer" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "listingId" TEXT NOT NULL,
    "applicationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "status" "OfferStatus" NOT NULL DEFAULT 'SENT',
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "respondedAt" TIMESTAMP(3),
    "decisionNote" TEXT,
    "isInternalTransfer" BOOLEAN NOT NULL DEFAULT false,
    "contractId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Offer_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Contract" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "contractNumber" TEXT NOT NULL,
    "type" "ContractType" NOT NULL DEFAULT 'RESIDENTIAL',
    "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT',
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3),
    "noticePeriodMonths" INTEGER NOT NULL DEFAULT 3,
    "rent" DECIMAL(12,2) NOT NULL,
    "rentAddons" JSONB,
    "deposit" DECIMAL(12,2),
    "invoiceReference" TEXT,
    "isImported" BOOLEAN NOT NULL DEFAULT false,
    "replacesContractId" TEXT,
    "terminatedAt" TIMESTAMP(3),
    "terminationEffectiveDate" TIMESTAMP(3),
    "activatedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Contract_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."ContractParty" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "contractId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "role" "ContractPartyRole" NOT NULL,
    "signedAt" TIMESTAMP(3),
    "signatureMethod" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractParty_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."ContractVersion" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "contractId" TEXT NOT NULL,
    "versionNumber" INTEGER NOT NULL,
    "content" JSONB NOT NULL,
    "documentHash" TEXT,
    "createdByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."ContractStatusEvent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "contractId" TEXT NOT NULL,
    "fromStatus" "ContractStatus",
    "toStatus" "ContractStatus" NOT NULL,
    "comment" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ContractStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Termination" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "contractId" TEXT NOT NULL,
    "requestedByPersonId" TEXT NOT NULL,
    "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "desiredMoveOutDate" TIMESTAMP(3) NOT NULL,
    "earliestEndDate" TIMESTAMP(3) NOT NULL,
    "effectiveEndDate" TIMESTAMP(3),
    "status" "TerminationStatus" NOT NULL DEFAULT 'REQUESTED',
    "reason" TEXT,
    "isInternalTransfer" BOOLEAN NOT NULL DEFAULT false,
    "newContractId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Termination_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Inspection" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "unitId" TEXT NOT NULL,
    "type" "InspectionType" NOT NULL,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "inspectorName" TEXT,
    "result" TEXT,
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Invoice" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "contractId" TEXT,
    "unitId" TEXT,
    "invoiceNumber" TEXT NOT NULL,
    "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT',
    "invoiceDate" TIMESTAMP(3) NOT NULL,
    "dueDate" TIMESTAMP(3) NOT NULL,
    "periodStart" TIMESTAMP(3),
    "periodEnd" TIMESTAMP(3),
    "totalAmount" DECIMAL(12,2) NOT NULL,
    "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0,
    "currency" TEXT NOT NULL DEFAULT 'SEK',
    "ocr" TEXT,
    "bankgiro" TEXT,
    "reference" TEXT,
    "pdfUrl" TEXT,
    "reminderCount" INTEGER NOT NULL DEFAULT 0,
    "isCreditNote" BOOLEAN NOT NULL DEFAULT false,
    "creditsInvoiceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."InvoiceLine" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "invoiceId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1,
    "unitPrice" DECIMAL(12,2) NOT NULL,
    "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 25,
    "amount" DECIMAL(12,2) NOT NULL,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."InvoiceStatusEvent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "invoiceId" TEXT NOT NULL,
    "fromStatus" "InvoiceStatus",
    "toStatus" "InvoiceStatus" NOT NULL,
    "source" TEXT NOT NULL,
    "comment" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InvoiceStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Payment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'SEK',
    "paidAt" TIMESTAMP(3) NOT NULL,
    "method" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Payment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."PaymentAllocation" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "paymentId" TEXT NOT NULL,
    "invoiceId" TEXT NOT NULL,
    "amount" DECIMAL(12,2) NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."ExternalReference" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "externalSystem" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "personId" TEXT,
    "invoiceId" TEXT,
    "paymentId" TEXT,
    "contractId" TEXT,
    "unitId" TEXT,
    "syncStatus" TEXT NOT NULL DEFAULT 'synced',
    "lastSyncedAt" TIMESTAMP(3),
    "sourceVersion" TEXT,
    "sourceUpdatedAt" TIMESTAMP(3),
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ExternalReference_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."IntegrationConnection" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "credentialsEncrypted" TEXT,
    "settings" JSONB,
    "webhookSecret" TEXT,
    "lastSyncAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."IntegrationSyncJob" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "connectionId" TEXT NOT NULL,
    "jobType" TEXT NOT NULL,
    "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING',
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "itemsProcessed" INTEGER NOT NULL DEFAULT 0,
    "itemsCreated" INTEGER NOT NULL DEFAULT 0,
    "itemsUpdated" INTEGER NOT NULL DEFAULT 0,
    "itemsSkipped" INTEGER NOT NULL DEFAULT 0,
    "itemsFailed" INTEGER NOT NULL DEFAULT 0,
    "log" JSONB,
    "error" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "IntegrationSyncJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."SyncReviewItem" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "syncJobId" TEXT,
    "entityType" TEXT NOT NULL,
    "externalSystem" TEXT NOT NULL,
    "externalId" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "reason" TEXT NOT NULL,
    "status" "ReviewItemStatus" NOT NULL DEFAULT 'PENDING',
    "resolvedByUserId" TEXT,
    "resolvedAt" TIMESTAMP(3),
    "resolutionNote" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "SyncReviewItem_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."MaintenanceRequest" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "requestNumber" INTEGER NOT NULL,
    "propertyId" TEXT,
    "unitId" TEXT,
    "personId" TEXT,
    "status" "MaintenanceStatus" NOT NULL DEFAULT 'RECEIVED',
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'NORMAL',
    "category" TEXT NOT NULL,
    "subcategory" TEXT,
    "room" TEXT,
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "discoveredAt" TIMESTAMP(3),
    "contactPhone" TEXT,
    "preferredTime" TEXT,
    "masterKeyAllowed" BOOLEAN NOT NULL DEFAULT false,
    "petsInHome" BOOLEAN NOT NULL DEFAULT false,
    "isEmergency" BOOLEAN NOT NULL DEFAULT false,
    "rating" INTEGER,
    "closedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."MaintenanceComment" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "requestId" TEXT NOT NULL,
    "authorUserId" TEXT,
    "authorName" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "isInternal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceComment_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."MaintenanceStatusEvent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "requestId" TEXT NOT NULL,
    "fromStatus" "MaintenanceStatus",
    "toStatus" "MaintenanceStatus" NOT NULL,
    "comment" TEXT,
    "changedByUserId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "MaintenanceStatusEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."WorkOrder" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "requestId" TEXT,
    "supplierId" TEXT,
    "assigneeUserId" TEXT,
    "orderNumber" INTEGER NOT NULL,
    "status" "WorkOrderStatus" NOT NULL DEFAULT 'CREATED',
    "priority" "MaintenancePriority" NOT NULL DEFAULT 'NORMAL',
    "title" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "accessInfo" TEXT,
    "scheduledAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "timeReported" DECIMAL(8,2),
    "materialsUsed" TEXT,
    "cost" DECIMAL(12,2),
    "invoiceReference" TEXT,
    "checklist" JSONB,
    "notes" TEXT,
    "approvedByUserId" TEXT,
    "approvedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Supplier" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "orgNumber" TEXT,
    "email" TEXT,
    "phone" TEXT,
    "specialty" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Document" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "type" "DocumentType" NOT NULL,
    "title" TEXT NOT NULL,
    "fileName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "storageKey" TEXT NOT NULL,
    "sha256" TEXT NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "personId" TEXT,
    "unitId" TEXT,
    "propertyId" TEXT,
    "contractId" TEXT,
    "applicationId" TEXT,
    "maintenanceRequestId" TEXT,
    "workOrderId" TEXT,
    "signStatus" TEXT,
    "uploadedByUserId" TEXT,
    "retentionUntil" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Document_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Message" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "senderPersonId" TEXT,
    "recipientPersonId" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Message_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Notification" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "personId" TEXT NOT NULL,
    "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP',
    "eventType" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "sentAt" TIMESTAMP(3),
    "readAt" TIMESTAMP(3),
    "error" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Notification_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."ApiKey" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "keyPrefix" TEXT NOT NULL,
    "keyHash" TEXT NOT NULL,
    "scopes" TEXT[],
    "allowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "lastUsedAt" TIMESTAMP(3),
    "expiresAt" TIMESTAMP(3),
    "revokedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."IdempotencyRecord" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "apiKeyId" TEXT NOT NULL,
    "idempotencyKey" TEXT NOT NULL,
    "requestHash" TEXT NOT NULL,
    "responseStatus" INTEGER NOT NULL,
    "responseBody" JSONB NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."WebhookSubscription" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "secret" TEXT NOT NULL,
    "events" TEXT[],
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "disabledAt" TIMESTAMP(3),
    "disabledReason" TEXT,
    "consecutiveFailures" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."WebhookDelivery" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "subscriptionId" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING',
    "attempts" INTEGER NOT NULL DEFAULT 0,
    "lastAttemptAt" TIMESTAMP(3),
    "nextAttemptAt" TIMESTAMP(3),
    "lastStatusCode" INTEGER,
    "lastError" TEXT,
    "deliveredAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."InboundWebhookEvent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "eventId" TEXT NOT NULL,
    "eventType" TEXT NOT NULL,
    "payload" JSONB NOT NULL,
    "signatureValid" BOOLEAN NOT NULL,
    "processedAt" TIMESTAMP(3),
    "processingError" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "InboundWebhookEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."ImportJob" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "importType" TEXT NOT NULL,
    "fileName" TEXT,
    "status" "ImportJobStatus" NOT NULL DEFAULT 'PREVIEW',
    "totalRows" INTEGER NOT NULL DEFAULT 0,
    "successRows" INTEGER NOT NULL DEFAULT 0,
    "errorRows" INTEGER NOT NULL DEFAULT 0,
    "skippedRows" INTEGER NOT NULL DEFAULT 0,
    "rowResults" JSONB,
    "createdByUserId" TEXT,
    "startedAt" TIMESTAMP(3),
    "finishedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."AuditEvent" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT,
    "userId" TEXT,
    "actorType" TEXT NOT NULL DEFAULT 'user',
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "before" JSONB,
    "after" JSONB,
    "ip" TEXT,
    "correlationId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE IF NOT EXISTS public."Counter" (
    "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text,
    "organizationId" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "value" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "Counter_pkey" PRIMARY KEY ("id")
);

-- Repair partially-created tables from an interrupted/manual previous run.

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

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "listingId" TEXT NOT NULL;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "status" "ApplicationStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "isInternalTransfer" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "desiredMoveInDate" TIMESTAMP(3);

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "currentHousing" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "currentLandlord" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "employment" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "employer" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "employmentType" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "monthlyIncome" DECIMAL(12,2);

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "otherIncome" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "references" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "pets" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "vehicles" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "specialNeeds" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "message" TEXT;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "consentGivenAt" TIMESTAMP(3);

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "submittedAt" TIMESTAMP(3);

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Application" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Application_pkey'
      AND conrelid = 'public."Application"'::regclass
  ) THEN
    ALTER TABLE public."Application" ADD CONSTRAINT "Application_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ApplicationMember" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ApplicationMember" ADD COLUMN IF NOT EXISTS "applicationId" TEXT NOT NULL;

ALTER TABLE public."ApplicationMember" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."ApplicationMember" ADD COLUMN IF NOT EXISTS "role" "ApplicationMemberRole" NOT NULL;

ALTER TABLE public."ApplicationMember" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ApplicationMember_pkey'
      AND conrelid = 'public."ApplicationMember"'::regclass
  ) THEN
    ALTER TABLE public."ApplicationMember" ADD CONSTRAINT "ApplicationMember_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ApplicationStatusEvent" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ApplicationStatusEvent" ADD COLUMN IF NOT EXISTS "applicationId" TEXT NOT NULL;

ALTER TABLE public."ApplicationStatusEvent" ADD COLUMN IF NOT EXISTS "fromStatus" "ApplicationStatus";

ALTER TABLE public."ApplicationStatusEvent" ADD COLUMN IF NOT EXISTS "toStatus" "ApplicationStatus" NOT NULL;

ALTER TABLE public."ApplicationStatusEvent" ADD COLUMN IF NOT EXISTS "comment" TEXT;

ALTER TABLE public."ApplicationStatusEvent" ADD COLUMN IF NOT EXISTS "changedByUserId" TEXT;

ALTER TABLE public."ApplicationStatusEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ApplicationStatusEvent_pkey'
      AND conrelid = 'public."ApplicationStatusEvent"'::regclass
  ) THEN
    ALTER TABLE public."ApplicationStatusEvent" ADD CONSTRAINT "ApplicationStatusEvent_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "listingId" TEXT NOT NULL;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "kind" "ViewingKind" NOT NULL DEFAULT 'INDIVIDUAL';

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "startsAt" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "endsAt" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "maxAttendees" INTEGER;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "location" TEXT;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Viewing" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Viewing_pkey'
      AND conrelid = 'public."Viewing"'::regclass
  ) THEN
    ALTER TABLE public."Viewing" ADD CONSTRAINT "Viewing_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ViewingAttendee" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ViewingAttendee" ADD COLUMN IF NOT EXISTS "viewingId" TEXT NOT NULL;

ALTER TABLE public."ViewingAttendee" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."ViewingAttendee" ADD COLUMN IF NOT EXISTS "applicationId" TEXT;

ALTER TABLE public."ViewingAttendee" ADD COLUMN IF NOT EXISTS "status" "ViewingAttendeeStatus" NOT NULL DEFAULT 'BOOKED';

ALTER TABLE public."ViewingAttendee" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."ViewingAttendee" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ViewingAttendee_pkey'
      AND conrelid = 'public."ViewingAttendee"'::regclass
  ) THEN
    ALTER TABLE public."ViewingAttendee" ADD CONSTRAINT "ViewingAttendee_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "listingId" TEXT NOT NULL;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "applicationId" TEXT NOT NULL;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "status" "OfferStatus" NOT NULL DEFAULT 'SENT';

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "respondedAt" TIMESTAMP(3);

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "decisionNote" TEXT;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "isInternalTransfer" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "contractId" TEXT;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Offer" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Offer_pkey'
      AND conrelid = 'public."Offer"'::regclass
  ) THEN
    ALTER TABLE public."Offer" ADD CONSTRAINT "Offer_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "unitId" TEXT NOT NULL;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "contractNumber" TEXT NOT NULL;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "type" "ContractType" NOT NULL DEFAULT 'RESIDENTIAL';

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "status" "ContractStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "startDate" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "endDate" TIMESTAMP(3);

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "noticePeriodMonths" INTEGER NOT NULL DEFAULT 3;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "rent" DECIMAL(12,2) NOT NULL;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "rentAddons" JSONB;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "deposit" DECIMAL(12,2);

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "invoiceReference" TEXT;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "isImported" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "replacesContractId" TEXT;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "terminatedAt" TIMESTAMP(3);

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "terminationEffectiveDate" TIMESTAMP(3);

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "activatedAt" TIMESTAMP(3);

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Contract" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Contract_pkey'
      AND conrelid = 'public."Contract"'::regclass
  ) THEN
    ALTER TABLE public."Contract" ADD CONSTRAINT "Contract_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ContractParty" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ContractParty" ADD COLUMN IF NOT EXISTS "contractId" TEXT NOT NULL;

ALTER TABLE public."ContractParty" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."ContractParty" ADD COLUMN IF NOT EXISTS "role" "ContractPartyRole" NOT NULL;

ALTER TABLE public."ContractParty" ADD COLUMN IF NOT EXISTS "signedAt" TIMESTAMP(3);

ALTER TABLE public."ContractParty" ADD COLUMN IF NOT EXISTS "signatureMethod" TEXT;

ALTER TABLE public."ContractParty" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ContractParty_pkey'
      AND conrelid = 'public."ContractParty"'::regclass
  ) THEN
    ALTER TABLE public."ContractParty" ADD CONSTRAINT "ContractParty_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ContractVersion" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ContractVersion" ADD COLUMN IF NOT EXISTS "contractId" TEXT NOT NULL;

ALTER TABLE public."ContractVersion" ADD COLUMN IF NOT EXISTS "versionNumber" INTEGER NOT NULL;

ALTER TABLE public."ContractVersion" ADD COLUMN IF NOT EXISTS "content" JSONB NOT NULL;

ALTER TABLE public."ContractVersion" ADD COLUMN IF NOT EXISTS "documentHash" TEXT;

ALTER TABLE public."ContractVersion" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

ALTER TABLE public."ContractVersion" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ContractVersion_pkey'
      AND conrelid = 'public."ContractVersion"'::regclass
  ) THEN
    ALTER TABLE public."ContractVersion" ADD CONSTRAINT "ContractVersion_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ContractStatusEvent" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ContractStatusEvent" ADD COLUMN IF NOT EXISTS "contractId" TEXT NOT NULL;

ALTER TABLE public."ContractStatusEvent" ADD COLUMN IF NOT EXISTS "fromStatus" "ContractStatus";

ALTER TABLE public."ContractStatusEvent" ADD COLUMN IF NOT EXISTS "toStatus" "ContractStatus" NOT NULL;

ALTER TABLE public."ContractStatusEvent" ADD COLUMN IF NOT EXISTS "comment" TEXT;

ALTER TABLE public."ContractStatusEvent" ADD COLUMN IF NOT EXISTS "changedByUserId" TEXT;

ALTER TABLE public."ContractStatusEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ContractStatusEvent_pkey'
      AND conrelid = 'public."ContractStatusEvent"'::regclass
  ) THEN
    ALTER TABLE public."ContractStatusEvent" ADD CONSTRAINT "ContractStatusEvent_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "contractId" TEXT NOT NULL;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "requestedByPersonId" TEXT NOT NULL;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "requestedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "desiredMoveOutDate" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "earliestEndDate" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "effectiveEndDate" TIMESTAMP(3);

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "status" "TerminationStatus" NOT NULL DEFAULT 'REQUESTED';

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "reason" TEXT;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "isInternalTransfer" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "newContractId" TEXT;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Termination" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Termination_pkey'
      AND conrelid = 'public."Termination"'::regclass
  ) THEN
    ALTER TABLE public."Termination" ADD CONSTRAINT "Termination_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "unitId" TEXT NOT NULL;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "type" "InspectionType" NOT NULL;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "inspectorName" TEXT;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "result" TEXT;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Inspection" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Inspection_pkey'
      AND conrelid = 'public."Inspection"'::regclass
  ) THEN
    ALTER TABLE public."Inspection" ADD CONSTRAINT "Inspection_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "contractId" TEXT;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "unitId" TEXT;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "invoiceNumber" TEXT NOT NULL;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "status" "InvoiceStatus" NOT NULL DEFAULT 'DRAFT';

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "invoiceDate" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "dueDate" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "periodStart" TIMESTAMP(3);

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "periodEnd" TIMESTAMP(3);

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "totalAmount" DECIMAL(12,2) NOT NULL;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "vatAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "paidAmount" DECIMAL(12,2) NOT NULL DEFAULT 0;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'SEK';

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "ocr" TEXT;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "bankgiro" TEXT;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "reference" TEXT;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "pdfUrl" TEXT;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "reminderCount" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "isCreditNote" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "creditsInvoiceId" TEXT;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Invoice" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invoice_pkey'
      AND conrelid = 'public."Invoice"'::regclass
  ) THEN
    ALTER TABLE public."Invoice" ADD CONSTRAINT "Invoice_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT NOT NULL;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "quantity" DECIMAL(10,2) NOT NULL DEFAULT 1;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "unitPrice" DECIMAL(12,2) NOT NULL;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "vatRate" DECIMAL(5,2) NOT NULL DEFAULT 25;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(12,2) NOT NULL;

ALTER TABLE public."InvoiceLine" ADD COLUMN IF NOT EXISTS "sortOrder" INTEGER NOT NULL DEFAULT 0;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InvoiceLine_pkey'
      AND conrelid = 'public."InvoiceLine"'::regclass
  ) THEN
    ALTER TABLE public."InvoiceLine" ADD CONSTRAINT "InvoiceLine_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT NOT NULL;

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "fromStatus" "InvoiceStatus";

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "toStatus" "InvoiceStatus" NOT NULL;

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "source" TEXT NOT NULL;

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "comment" TEXT;

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "changedByUserId" TEXT;

ALTER TABLE public."InvoiceStatusEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InvoiceStatusEvent_pkey'
      AND conrelid = 'public."InvoiceStatusEvent"'::regclass
  ) THEN
    ALTER TABLE public."InvoiceStatusEvent" ADD CONSTRAINT "InvoiceStatusEvent_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(12,2) NOT NULL;

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "currency" TEXT NOT NULL DEFAULT 'SEK';

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "paidAt" TIMESTAMP(3) NOT NULL;

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "method" TEXT;

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "reference" TEXT;

ALTER TABLE public."Payment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Payment_pkey'
      AND conrelid = 'public."Payment"'::regclass
  ) THEN
    ALTER TABLE public."Payment" ADD CONSTRAINT "Payment_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."PaymentAllocation" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."PaymentAllocation" ADD COLUMN IF NOT EXISTS "paymentId" TEXT NOT NULL;

ALTER TABLE public."PaymentAllocation" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT NOT NULL;

ALTER TABLE public."PaymentAllocation" ADD COLUMN IF NOT EXISTS "amount" DECIMAL(12,2) NOT NULL;

ALTER TABLE public."PaymentAllocation" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PaymentAllocation_pkey'
      AND conrelid = 'public."PaymentAllocation"'::regclass
  ) THEN
    ALTER TABLE public."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "externalSystem" TEXT NOT NULL;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "entityType" TEXT NOT NULL;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "externalId" TEXT NOT NULL;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "personId" TEXT;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "invoiceId" TEXT;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "paymentId" TEXT;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "contractId" TEXT;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "unitId" TEXT;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "syncStatus" TEXT NOT NULL DEFAULT 'synced';

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "lastSyncedAt" TIMESTAMP(3);

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "sourceVersion" TEXT;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "sourceUpdatedAt" TIMESTAMP(3);

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "metadata" JSONB;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."ExternalReference" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ExternalReference_pkey'
      AND conrelid = 'public."ExternalReference"'::regclass
  ) THEN
    ALTER TABLE public."ExternalReference" ADD CONSTRAINT "ExternalReference_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "credentialsEncrypted" TEXT;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "settings" JSONB;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "webhookSecret" TEXT;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "lastSyncAt" TIMESTAMP(3);

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."IntegrationConnection" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'IntegrationConnection_pkey'
      AND conrelid = 'public."IntegrationConnection"'::regclass
  ) THEN
    ALTER TABLE public."IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "connectionId" TEXT NOT NULL;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "jobType" TEXT NOT NULL;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "status" "SyncJobStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "itemsProcessed" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "itemsCreated" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "itemsUpdated" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "itemsSkipped" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "itemsFailed" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "log" JSONB;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "error" TEXT;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "correlationId" TEXT;

ALTER TABLE public."IntegrationSyncJob" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'IntegrationSyncJob_pkey'
      AND conrelid = 'public."IntegrationSyncJob"'::regclass
  ) THEN
    ALTER TABLE public."IntegrationSyncJob" ADD CONSTRAINT "IntegrationSyncJob_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "syncJobId" TEXT;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "entityType" TEXT NOT NULL;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "externalSystem" TEXT NOT NULL;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "externalId" TEXT NOT NULL;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "payload" JSONB NOT NULL;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "reason" TEXT NOT NULL;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "status" "ReviewItemStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "resolvedByUserId" TEXT;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "resolvedAt" TIMESTAMP(3);

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "resolutionNote" TEXT;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."SyncReviewItem" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SyncReviewItem_pkey'
      AND conrelid = 'public."SyncReviewItem"'::regclass
  ) THEN
    ALTER TABLE public."SyncReviewItem" ADD CONSTRAINT "SyncReviewItem_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "requestNumber" INTEGER NOT NULL;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "unitId" TEXT;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "personId" TEXT;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "status" "MaintenanceStatus" NOT NULL DEFAULT 'RECEIVED';

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "priority" "MaintenancePriority" NOT NULL DEFAULT 'NORMAL';

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "category" TEXT NOT NULL;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "subcategory" TEXT;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "room" TEXT;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "discoveredAt" TIMESTAMP(3);

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "contactPhone" TEXT;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "preferredTime" TEXT;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "masterKeyAllowed" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "petsInHome" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "isEmergency" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "rating" INTEGER;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "closedAt" TIMESTAMP(3);

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."MaintenanceRequest" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceRequest_pkey'
      AND conrelid = 'public."MaintenanceRequest"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."MaintenanceComment" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."MaintenanceComment" ADD COLUMN IF NOT EXISTS "requestId" TEXT NOT NULL;

ALTER TABLE public."MaintenanceComment" ADD COLUMN IF NOT EXISTS "authorUserId" TEXT;

ALTER TABLE public."MaintenanceComment" ADD COLUMN IF NOT EXISTS "authorName" TEXT NOT NULL;

ALTER TABLE public."MaintenanceComment" ADD COLUMN IF NOT EXISTS "body" TEXT NOT NULL;

ALTER TABLE public."MaintenanceComment" ADD COLUMN IF NOT EXISTS "isInternal" BOOLEAN NOT NULL DEFAULT false;

ALTER TABLE public."MaintenanceComment" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceComment_pkey'
      AND conrelid = 'public."MaintenanceComment"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceComment" ADD CONSTRAINT "MaintenanceComment_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."MaintenanceStatusEvent" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."MaintenanceStatusEvent" ADD COLUMN IF NOT EXISTS "requestId" TEXT NOT NULL;

ALTER TABLE public."MaintenanceStatusEvent" ADD COLUMN IF NOT EXISTS "fromStatus" "MaintenanceStatus";

ALTER TABLE public."MaintenanceStatusEvent" ADD COLUMN IF NOT EXISTS "toStatus" "MaintenanceStatus" NOT NULL;

ALTER TABLE public."MaintenanceStatusEvent" ADD COLUMN IF NOT EXISTS "comment" TEXT;

ALTER TABLE public."MaintenanceStatusEvent" ADD COLUMN IF NOT EXISTS "changedByUserId" TEXT;

ALTER TABLE public."MaintenanceStatusEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceStatusEvent_pkey'
      AND conrelid = 'public."MaintenanceStatusEvent"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceStatusEvent" ADD CONSTRAINT "MaintenanceStatusEvent_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "requestId" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "supplierId" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "assigneeUserId" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "orderNumber" INTEGER NOT NULL;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "status" "WorkOrderStatus" NOT NULL DEFAULT 'CREATED';

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "priority" "MaintenancePriority" NOT NULL DEFAULT 'NORMAL';

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "description" TEXT NOT NULL;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "accessInfo" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "scheduledAt" TIMESTAMP(3);

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "completedAt" TIMESTAMP(3);

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "timeReported" DECIMAL(8,2);

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "materialsUsed" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "cost" DECIMAL(12,2);

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "invoiceReference" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "checklist" JSONB;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "notes" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "approvedByUserId" TEXT;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "approvedAt" TIMESTAMP(3);

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."WorkOrder" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkOrder_pkey'
      AND conrelid = 'public."WorkOrder"'::regclass
  ) THEN
    ALTER TABLE public."WorkOrder" ADD CONSTRAINT "WorkOrder_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "orgNumber" TEXT;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "email" TEXT;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "phone" TEXT;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "specialty" TEXT;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Supplier" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Supplier_pkey'
      AND conrelid = 'public."Supplier"'::regclass
  ) THEN
    ALTER TABLE public."Supplier" ADD CONSTRAINT "Supplier_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "type" "DocumentType" NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "fileName" TEXT NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "mimeType" TEXT NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "sizeBytes" INTEGER NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "storageKey" TEXT NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "sha256" TEXT NOT NULL;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "version" INTEGER NOT NULL DEFAULT 1;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "personId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "unitId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "propertyId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "contractId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "applicationId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "maintenanceRequestId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "workOrderId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "signStatus" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "uploadedByUserId" TEXT;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "retentionUntil" TIMESTAMP(3);

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "archivedAt" TIMESTAMP(3);

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."Document" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_pkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "senderPersonId" TEXT;

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "recipientPersonId" TEXT NOT NULL;

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "subject" TEXT NOT NULL;

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "body" TEXT NOT NULL;

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);

ALTER TABLE public."Message" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Message_pkey'
      AND conrelid = 'public."Message"'::regclass
  ) THEN
    ALTER TABLE public."Message" ADD CONSTRAINT "Message_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "personId" TEXT NOT NULL;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "channel" "NotificationChannel" NOT NULL DEFAULT 'IN_APP';

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "eventType" TEXT NOT NULL;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "title" TEXT NOT NULL;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "body" TEXT NOT NULL;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "sentAt" TIMESTAMP(3);

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "readAt" TIMESTAMP(3);

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "error" TEXT;

ALTER TABLE public."Notification" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Notification_pkey'
      AND conrelid = 'public."Notification"'::regclass
  ) THEN
    ALTER TABLE public."Notification" ADD CONSTRAINT "Notification_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "name" TEXT NOT NULL;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "keyPrefix" TEXT NOT NULL;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "keyHash" TEXT NOT NULL;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "scopes" TEXT[];

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "allowedIps" TEXT[] DEFAULT ARRAY[]::TEXT[];

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "lastUsedAt" TIMESTAMP(3);

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3);

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "revokedAt" TIMESTAMP(3);

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."ApiKey" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ApiKey_pkey'
      AND conrelid = 'public."ApiKey"'::regclass
  ) THEN
    ALTER TABLE public."ApiKey" ADD CONSTRAINT "ApiKey_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "apiKeyId" TEXT NOT NULL;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "idempotencyKey" TEXT NOT NULL;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "requestHash" TEXT NOT NULL;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "responseStatus" INTEGER NOT NULL;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "responseBody" JSONB NOT NULL;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."IdempotencyRecord" ADD COLUMN IF NOT EXISTS "expiresAt" TIMESTAMP(3) NOT NULL;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'IdempotencyRecord_pkey'
      AND conrelid = 'public."IdempotencyRecord"'::regclass
  ) THEN
    ALTER TABLE public."IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "url" TEXT NOT NULL;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "secret" TEXT NOT NULL;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "events" TEXT[];

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "isActive" BOOLEAN NOT NULL DEFAULT true;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "disabledAt" TIMESTAMP(3);

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "disabledReason" TEXT;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "consecutiveFailures" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."WebhookSubscription" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WebhookSubscription_pkey'
      AND conrelid = 'public."WebhookSubscription"'::regclass
  ) THEN
    ALTER TABLE public."WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "subscriptionId" TEXT NOT NULL;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "eventId" TEXT NOT NULL;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "eventType" TEXT NOT NULL;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "payload" JSONB NOT NULL;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "status" "WebhookDeliveryStatus" NOT NULL DEFAULT 'PENDING';

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "attempts" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "lastAttemptAt" TIMESTAMP(3);

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "nextAttemptAt" TIMESTAMP(3);

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "lastStatusCode" INTEGER;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "lastError" TEXT;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "deliveredAt" TIMESTAMP(3);

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

ALTER TABLE public."WebhookDelivery" ADD COLUMN IF NOT EXISTS "updatedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WebhookDelivery_pkey'
      AND conrelid = 'public."WebhookDelivery"'::regclass
  ) THEN
    ALTER TABLE public."WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "provider" TEXT NOT NULL;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "eventId" TEXT NOT NULL;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "eventType" TEXT NOT NULL;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "payload" JSONB NOT NULL;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "signatureValid" BOOLEAN NOT NULL;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "processedAt" TIMESTAMP(3);

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "processingError" TEXT;

ALTER TABLE public."InboundWebhookEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InboundWebhookEvent_pkey'
      AND conrelid = 'public."InboundWebhookEvent"'::regclass
  ) THEN
    ALTER TABLE public."InboundWebhookEvent" ADD CONSTRAINT "InboundWebhookEvent_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "importType" TEXT NOT NULL;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "fileName" TEXT;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "status" "ImportJobStatus" NOT NULL DEFAULT 'PREVIEW';

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "totalRows" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "successRows" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "errorRows" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "skippedRows" INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "rowResults" JSONB;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "createdByUserId" TEXT;

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "startedAt" TIMESTAMP(3);

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "finishedAt" TIMESTAMP(3);

ALTER TABLE public."ImportJob" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ImportJob_pkey'
      AND conrelid = 'public."ImportJob"'::regclass
  ) THEN
    ALTER TABLE public."ImportJob" ADD CONSTRAINT "ImportJob_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "organizationId" TEXT;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "userId" TEXT;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "actorType" TEXT NOT NULL DEFAULT 'user';

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "actorId" TEXT;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "action" TEXT NOT NULL;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "entityType" TEXT NOT NULL;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "entityId" TEXT;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "before" JSONB;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "after" JSONB;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "ip" TEXT;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "correlationId" TEXT;

ALTER TABLE public."AuditEvent" ADD COLUMN IF NOT EXISTS "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AuditEvent_pkey'
      AND conrelid = 'public."AuditEvent"'::regclass
  ) THEN
    ALTER TABLE public."AuditEvent" ADD CONSTRAINT "AuditEvent_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

ALTER TABLE public."Counter" ADD COLUMN IF NOT EXISTS "id" TEXT NOT NULL DEFAULT gen_random_uuid()::text;

ALTER TABLE public."Counter" ADD COLUMN IF NOT EXISTS "organizationId" TEXT NOT NULL;

ALTER TABLE public."Counter" ADD COLUMN IF NOT EXISTS "key" TEXT NOT NULL;

ALTER TABLE public."Counter" ADD COLUMN IF NOT EXISTS "value" INTEGER NOT NULL DEFAULT 0;

DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Counter_pkey'
      AND conrelid = 'public."Counter"'::regclass
  ) THEN
    ALTER TABLE public."Counter" ADD CONSTRAINT "Counter_pkey" PRIMARY KEY ("id");
  END IF;
END
$constraint$;

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Organization_orgNumber_key" ON public."Organization"("orgNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MasterDataConfig_organizationId_domain_key" ON public."MasterDataConfig"("organizationId", "domain");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Person_organizationId_personalNumber_idx" ON public."Person"("organizationId", "personalNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Person_organizationId_lastName_firstName_idx" ON public."Person"("organizationId", "lastName", "firstName");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Person_organizationId_email_key" ON public."Person"("organizationId", "email");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PersonRole_personId_role_key" ON public."PersonRole"("personId", "role");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_personId_key" ON public."User"("personId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "User_email_key" ON public."User"("email");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "User_email_idx" ON public."User"("email");

-- CreateIndex

-- CreateIndex

-- CreateIndex

-- CreateIndex

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invitation_tokenHash_key" ON public."Invitation"("tokenHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invitation_organizationId_personId_idx" ON public."Invitation"("organizationId", "personId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Role_organizationId_slug_key" ON public."Role"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "RolePermission_roleId_permission_key" ON public."RolePermission"("roleId", "permission");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_userId_roleId_propertyId_key" ON public."UserRole"("userId", "roleId", "propertyId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Property_organizationId_city_idx" ON public."Property"("organizationId", "city");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Unit_organizationId_status_idx" ON public."Unit"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Unit_organizationId_type_status_idx" ON public."Unit"("organizationId", "type", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Unit_organizationId_city_idx" ON public."Unit"("organizationId", "city");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Unit_organizationId_unitNumber_key" ON public."Unit"("organizationId", "unitNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Listing_organizationId_status_category_idx" ON public."Listing"("organizationId", "status", "category");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Listing_organizationId_slug_key" ON public."Listing"("organizationId", "slug");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Favorite_personId_listingId_key" ON public."Favorite"("personId", "listingId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SavedSearch_personId_idx" ON public."SavedSearch"("personId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Application_organizationId_status_idx" ON public."Application"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Application_listingId_status_idx" ON public."Application"("listingId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApplicationMember_applicationId_personId_role_key" ON public."ApplicationMember"("applicationId", "personId", "role");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApplicationStatusEvent_applicationId_idx" ON public."ApplicationStatusEvent"("applicationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Viewing_listingId_startsAt_idx" ON public."Viewing"("listingId", "startsAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ViewingAttendee_viewingId_personId_key" ON public."ViewingAttendee"("viewingId", "personId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offer_applicationId_idx" ON public."Offer"("applicationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Offer_personId_status_idx" ON public."Offer"("personId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contract_organizationId_status_idx" ON public."Contract"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Contract_unitId_status_idx" ON public."Contract"("unitId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Contract_organizationId_contractNumber_key" ON public."Contract"("organizationId", "contractNumber");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContractParty_contractId_personId_role_key" ON public."ContractParty"("contractId", "personId", "role");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ContractVersion_contractId_versionNumber_key" ON public."ContractVersion"("contractId", "versionNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ContractStatusEvent_contractId_idx" ON public."ContractStatusEvent"("contractId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Termination_contractId_idx" ON public."Termination"("contractId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Inspection_unitId_idx" ON public."Inspection"("unitId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_organizationId_status_idx" ON public."Invoice"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_personId_status_idx" ON public."Invoice"("personId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Invoice_contractId_idx" ON public."Invoice"("contractId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Invoice_organizationId_invoiceNumber_key" ON public."Invoice"("organizationId", "invoiceNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InvoiceStatusEvent_invoiceId_idx" ON public."InvoiceStatusEvent"("invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Payment_organizationId_paidAt_idx" ON public."Payment"("organizationId", "paidAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "PaymentAllocation_paymentId_invoiceId_key" ON public."PaymentAllocation"("paymentId", "invoiceId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExternalReference_personId_idx" ON public."ExternalReference"("personId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ExternalReference_invoiceId_idx" ON public."ExternalReference"("invoiceId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ExternalReference_organizationId_externalSystem_entityType__key" ON public."ExternalReference"("organizationId", "externalSystem", "entityType", "externalId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IntegrationConnection_organizationId_provider_name_key" ON public."IntegrationConnection"("organizationId", "provider", "name");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IntegrationSyncJob_organizationId_status_idx" ON public."IntegrationSyncJob"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "SyncReviewItem_organizationId_status_idx" ON public."SyncReviewItem"("organizationId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "SyncReviewItem_organizationId_externalSystem_entityType_ext_key" ON public."SyncReviewItem"("organizationId", "externalSystem", "entityType", "externalId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_organizationId_status_idx" ON public."MaintenanceRequest"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MaintenanceRequest_personId_idx" ON public."MaintenanceRequest"("personId");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "MaintenanceRequest_organizationId_requestNumber_key" ON public."MaintenanceRequest"("organizationId", "requestNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MaintenanceComment_requestId_idx" ON public."MaintenanceComment"("requestId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "MaintenanceStatusEvent_requestId_idx" ON public."MaintenanceStatusEvent"("requestId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkOrder_organizationId_status_idx" ON public."WorkOrder"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WorkOrder_supplierId_status_idx" ON public."WorkOrder"("supplierId", "status");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WorkOrder_organizationId_orderNumber_key" ON public."WorkOrder"("organizationId", "orderNumber");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Supplier_organizationId_idx" ON public."Supplier"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_organizationId_type_idx" ON public."Document"("organizationId", "type");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_personId_idx" ON public."Document"("personId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Document_contractId_idx" ON public."Document"("contractId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Message_recipientPersonId_readAt_idx" ON public."Message"("recipientPersonId", "readAt");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "Notification_personId_readAt_idx" ON public."Notification"("personId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "ApiKey_keyHash_key" ON public."ApiKey"("keyHash");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ApiKey_organizationId_idx" ON public."ApiKey"("organizationId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "IdempotencyRecord_expiresAt_idx" ON public."IdempotencyRecord"("expiresAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "IdempotencyRecord_apiKeyId_idempotencyKey_key" ON public."IdempotencyRecord"("apiKeyId", "idempotencyKey");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookSubscription_organizationId_isActive_idx" ON public."WebhookSubscription"("organizationId", "isActive");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "WebhookDelivery_status_nextAttemptAt_idx" ON public."WebhookDelivery"("status", "nextAttemptAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "WebhookDelivery_subscriptionId_eventId_key" ON public."WebhookDelivery"("subscriptionId", "eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "InboundWebhookEvent_organizationId_processedAt_idx" ON public."InboundWebhookEvent"("organizationId", "processedAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "InboundWebhookEvent_organizationId_provider_eventId_key" ON public."InboundWebhookEvent"("organizationId", "provider", "eventId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "ImportJob_organizationId_status_idx" ON public."ImportJob"("organizationId", "status");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditEvent_organizationId_entityType_entityId_idx" ON public."AuditEvent"("organizationId", "entityType", "entityId");

-- CreateIndex
CREATE INDEX IF NOT EXISTS "AuditEvent_organizationId_createdAt_idx" ON public."AuditEvent"("organizationId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX IF NOT EXISTS "Counter_organizationId_key_key" ON public."Counter"("organizationId", "key");

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MasterDataConfig_organizationId_fkey'
      AND conrelid = 'public."MasterDataConfig"'::regclass
  ) THEN
    ALTER TABLE public."MasterDataConfig" ADD CONSTRAINT "MasterDataConfig_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Person_organizationId_fkey'
      AND conrelid = 'public."Person"'::regclass
  ) THEN
    ALTER TABLE public."Person" ADD CONSTRAINT "Person_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PersonRole_personId_fkey'
      AND conrelid = 'public."PersonRole"'::regclass
  ) THEN
    ALTER TABLE public."PersonRole" ADD CONSTRAINT "PersonRole_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'User_personId_fkey'
      AND conrelid = 'public."User"'::regclass
  ) THEN
    ALTER TABLE public."User" ADD CONSTRAINT "User_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'User_organizationId_fkey'
      AND conrelid = 'public."User"'::regclass
  ) THEN
    ALTER TABLE public."User" ADD CONSTRAINT "User_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'User_supplierId_fkey'
      AND conrelid = 'public."User"'::regclass
  ) THEN
    ALTER TABLE public."User" ADD CONSTRAINT "User_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey

-- AddForeignKey

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invitation_organizationId_fkey'
      AND conrelid = 'public."Invitation"'::regclass
  ) THEN
    ALTER TABLE public."Invitation" ADD CONSTRAINT "Invitation_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invitation_personId_fkey'
      AND conrelid = 'public."Invitation"'::regclass
  ) THEN
    ALTER TABLE public."Invitation" ADD CONSTRAINT "Invitation_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Role_organizationId_fkey'
      AND conrelid = 'public."Role"'::regclass
  ) THEN
    ALTER TABLE public."Role" ADD CONSTRAINT "Role_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'RolePermission_roleId_fkey'
      AND conrelid = 'public."RolePermission"'::regclass
  ) THEN
    ALTER TABLE public."RolePermission" ADD CONSTRAINT "RolePermission_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UserRole_userId_fkey'
      AND conrelid = 'public."UserRole"'::regclass
  ) THEN
    ALTER TABLE public."UserRole" ADD CONSTRAINT "UserRole_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UserRole_roleId_fkey'
      AND conrelid = 'public."UserRole"'::regclass
  ) THEN
    ALTER TABLE public."UserRole" ADD CONSTRAINT "UserRole_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "Role"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UserRole_propertyId_fkey'
      AND conrelid = 'public."UserRole"'::regclass
  ) THEN
    ALTER TABLE public."UserRole" ADD CONSTRAINT "UserRole_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Property_organizationId_fkey'
      AND conrelid = 'public."Property"'::regclass
  ) THEN
    ALTER TABLE public."Property" ADD CONSTRAINT "Property_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Building_organizationId_fkey'
      AND conrelid = 'public."Building"'::regclass
  ) THEN
    ALTER TABLE public."Building" ADD CONSTRAINT "Building_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Building_propertyId_fkey'
      AND conrelid = 'public."Building"'::regclass
  ) THEN
    ALTER TABLE public."Building" ADD CONSTRAINT "Building_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Entrance_buildingId_fkey'
      AND conrelid = 'public."Entrance"'::regclass
  ) THEN
    ALTER TABLE public."Entrance" ADD CONSTRAINT "Entrance_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Floor_entranceId_fkey'
      AND conrelid = 'public."Floor"'::regclass
  ) THEN
    ALTER TABLE public."Floor" ADD CONSTRAINT "Floor_entranceId_fkey" FOREIGN KEY ("entranceId") REFERENCES "Entrance"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Unit_organizationId_fkey'
      AND conrelid = 'public."Unit"'::regclass
  ) THEN
    ALTER TABLE public."Unit" ADD CONSTRAINT "Unit_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Unit_propertyId_fkey'
      AND conrelid = 'public."Unit"'::regclass
  ) THEN
    ALTER TABLE public."Unit" ADD CONSTRAINT "Unit_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Unit_buildingId_fkey'
      AND conrelid = 'public."Unit"'::regclass
  ) THEN
    ALTER TABLE public."Unit" ADD CONSTRAINT "Unit_buildingId_fkey" FOREIGN KEY ("buildingId") REFERENCES "Building"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Unit_entranceId_fkey'
      AND conrelid = 'public."Unit"'::regclass
  ) THEN
    ALTER TABLE public."Unit" ADD CONSTRAINT "Unit_entranceId_fkey" FOREIGN KEY ("entranceId") REFERENCES "Entrance"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Unit_floorId_fkey'
      AND conrelid = 'public."Unit"'::regclass
  ) THEN
    ALTER TABLE public."Unit" ADD CONSTRAINT "Unit_floorId_fkey" FOREIGN KEY ("floorId") REFERENCES "Floor"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Unit_parentUnitId_fkey'
      AND conrelid = 'public."Unit"'::regclass
  ) THEN
    ALTER TABLE public."Unit" ADD CONSTRAINT "Unit_parentUnitId_fkey" FOREIGN KEY ("parentUnitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'UnitMedia_unitId_fkey'
      AND conrelid = 'public."UnitMedia"'::regclass
  ) THEN
    ALTER TABLE public."UnitMedia" ADD CONSTRAINT "UnitMedia_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Listing_organizationId_fkey'
      AND conrelid = 'public."Listing"'::regclass
  ) THEN
    ALTER TABLE public."Listing" ADD CONSTRAINT "Listing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Listing_unitId_fkey'
      AND conrelid = 'public."Listing"'::regclass
  ) THEN
    ALTER TABLE public."Listing" ADD CONSTRAINT "Listing_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ListingPublication_listingId_fkey'
      AND conrelid = 'public."ListingPublication"'::regclass
  ) THEN
    ALTER TABLE public."ListingPublication" ADD CONSTRAINT "ListingPublication_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Favorite_organizationId_fkey'
      AND conrelid = 'public."Favorite"'::regclass
  ) THEN
    ALTER TABLE public."Favorite" ADD CONSTRAINT "Favorite_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Favorite_personId_fkey'
      AND conrelid = 'public."Favorite"'::regclass
  ) THEN
    ALTER TABLE public."Favorite" ADD CONSTRAINT "Favorite_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Favorite_listingId_fkey'
      AND conrelid = 'public."Favorite"'::regclass
  ) THEN
    ALTER TABLE public."Favorite" ADD CONSTRAINT "Favorite_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SavedSearch_organizationId_fkey'
      AND conrelid = 'public."SavedSearch"'::regclass
  ) THEN
    ALTER TABLE public."SavedSearch" ADD CONSTRAINT "SavedSearch_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SavedSearch_personId_fkey'
      AND conrelid = 'public."SavedSearch"'::regclass
  ) THEN
    ALTER TABLE public."SavedSearch" ADD CONSTRAINT "SavedSearch_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Application_organizationId_fkey'
      AND conrelid = 'public."Application"'::regclass
  ) THEN
    ALTER TABLE public."Application" ADD CONSTRAINT "Application_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Application_listingId_fkey'
      AND conrelid = 'public."Application"'::regclass
  ) THEN
    ALTER TABLE public."Application" ADD CONSTRAINT "Application_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ApplicationMember_applicationId_fkey'
      AND conrelid = 'public."ApplicationMember"'::regclass
  ) THEN
    ALTER TABLE public."ApplicationMember" ADD CONSTRAINT "ApplicationMember_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ApplicationMember_personId_fkey'
      AND conrelid = 'public."ApplicationMember"'::regclass
  ) THEN
    ALTER TABLE public."ApplicationMember" ADD CONSTRAINT "ApplicationMember_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ApplicationStatusEvent_applicationId_fkey'
      AND conrelid = 'public."ApplicationStatusEvent"'::regclass
  ) THEN
    ALTER TABLE public."ApplicationStatusEvent" ADD CONSTRAINT "ApplicationStatusEvent_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Viewing_organizationId_fkey'
      AND conrelid = 'public."Viewing"'::regclass
  ) THEN
    ALTER TABLE public."Viewing" ADD CONSTRAINT "Viewing_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Viewing_listingId_fkey'
      AND conrelid = 'public."Viewing"'::regclass
  ) THEN
    ALTER TABLE public."Viewing" ADD CONSTRAINT "Viewing_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ViewingAttendee_viewingId_fkey'
      AND conrelid = 'public."ViewingAttendee"'::regclass
  ) THEN
    ALTER TABLE public."ViewingAttendee" ADD CONSTRAINT "ViewingAttendee_viewingId_fkey" FOREIGN KEY ("viewingId") REFERENCES "Viewing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ViewingAttendee_personId_fkey'
      AND conrelid = 'public."ViewingAttendee"'::regclass
  ) THEN
    ALTER TABLE public."ViewingAttendee" ADD CONSTRAINT "ViewingAttendee_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ViewingAttendee_applicationId_fkey'
      AND conrelid = 'public."ViewingAttendee"'::regclass
  ) THEN
    ALTER TABLE public."ViewingAttendee" ADD CONSTRAINT "ViewingAttendee_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Offer_organizationId_fkey'
      AND conrelid = 'public."Offer"'::regclass
  ) THEN
    ALTER TABLE public."Offer" ADD CONSTRAINT "Offer_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Offer_listingId_fkey'
      AND conrelid = 'public."Offer"'::regclass
  ) THEN
    ALTER TABLE public."Offer" ADD CONSTRAINT "Offer_listingId_fkey" FOREIGN KEY ("listingId") REFERENCES "Listing"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Offer_applicationId_fkey'
      AND conrelid = 'public."Offer"'::regclass
  ) THEN
    ALTER TABLE public."Offer" ADD CONSTRAINT "Offer_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Offer_personId_fkey'
      AND conrelid = 'public."Offer"'::regclass
  ) THEN
    ALTER TABLE public."Offer" ADD CONSTRAINT "Offer_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Contract_organizationId_fkey'
      AND conrelid = 'public."Contract"'::regclass
  ) THEN
    ALTER TABLE public."Contract" ADD CONSTRAINT "Contract_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Contract_unitId_fkey'
      AND conrelid = 'public."Contract"'::regclass
  ) THEN
    ALTER TABLE public."Contract" ADD CONSTRAINT "Contract_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ContractParty_contractId_fkey'
      AND conrelid = 'public."ContractParty"'::regclass
  ) THEN
    ALTER TABLE public."ContractParty" ADD CONSTRAINT "ContractParty_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ContractParty_personId_fkey'
      AND conrelid = 'public."ContractParty"'::regclass
  ) THEN
    ALTER TABLE public."ContractParty" ADD CONSTRAINT "ContractParty_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ContractVersion_contractId_fkey'
      AND conrelid = 'public."ContractVersion"'::regclass
  ) THEN
    ALTER TABLE public."ContractVersion" ADD CONSTRAINT "ContractVersion_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ContractStatusEvent_contractId_fkey'
      AND conrelid = 'public."ContractStatusEvent"'::regclass
  ) THEN
    ALTER TABLE public."ContractStatusEvent" ADD CONSTRAINT "ContractStatusEvent_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Termination_organizationId_fkey'
      AND conrelid = 'public."Termination"'::regclass
  ) THEN
    ALTER TABLE public."Termination" ADD CONSTRAINT "Termination_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Termination_contractId_fkey'
      AND conrelid = 'public."Termination"'::regclass
  ) THEN
    ALTER TABLE public."Termination" ADD CONSTRAINT "Termination_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Termination_requestedByPersonId_fkey'
      AND conrelid = 'public."Termination"'::regclass
  ) THEN
    ALTER TABLE public."Termination" ADD CONSTRAINT "Termination_requestedByPersonId_fkey" FOREIGN KEY ("requestedByPersonId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Inspection_organizationId_fkey'
      AND conrelid = 'public."Inspection"'::regclass
  ) THEN
    ALTER TABLE public."Inspection" ADD CONSTRAINT "Inspection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Inspection_unitId_fkey'
      AND conrelid = 'public."Inspection"'::regclass
  ) THEN
    ALTER TABLE public."Inspection" ADD CONSTRAINT "Inspection_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invoice_organizationId_fkey'
      AND conrelid = 'public."Invoice"'::regclass
  ) THEN
    ALTER TABLE public."Invoice" ADD CONSTRAINT "Invoice_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invoice_personId_fkey'
      AND conrelid = 'public."Invoice"'::regclass
  ) THEN
    ALTER TABLE public."Invoice" ADD CONSTRAINT "Invoice_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invoice_contractId_fkey'
      AND conrelid = 'public."Invoice"'::regclass
  ) THEN
    ALTER TABLE public."Invoice" ADD CONSTRAINT "Invoice_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invoice_unitId_fkey'
      AND conrelid = 'public."Invoice"'::regclass
  ) THEN
    ALTER TABLE public."Invoice" ADD CONSTRAINT "Invoice_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Invoice_creditsInvoiceId_fkey'
      AND conrelid = 'public."Invoice"'::regclass
  ) THEN
    ALTER TABLE public."Invoice" ADD CONSTRAINT "Invoice_creditsInvoiceId_fkey" FOREIGN KEY ("creditsInvoiceId") REFERENCES "Invoice"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InvoiceLine_invoiceId_fkey'
      AND conrelid = 'public."InvoiceLine"'::regclass
  ) THEN
    ALTER TABLE public."InvoiceLine" ADD CONSTRAINT "InvoiceLine_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InvoiceStatusEvent_invoiceId_fkey'
      AND conrelid = 'public."InvoiceStatusEvent"'::regclass
  ) THEN
    ALTER TABLE public."InvoiceStatusEvent" ADD CONSTRAINT "InvoiceStatusEvent_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Payment_organizationId_fkey'
      AND conrelid = 'public."Payment"'::regclass
  ) THEN
    ALTER TABLE public."Payment" ADD CONSTRAINT "Payment_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PaymentAllocation_paymentId_fkey'
      AND conrelid = 'public."PaymentAllocation"'::regclass
  ) THEN
    ALTER TABLE public."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'PaymentAllocation_invoiceId_fkey'
      AND conrelid = 'public."PaymentAllocation"'::regclass
  ) THEN
    ALTER TABLE public."PaymentAllocation" ADD CONSTRAINT "PaymentAllocation_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ExternalReference_organizationId_fkey'
      AND conrelid = 'public."ExternalReference"'::regclass
  ) THEN
    ALTER TABLE public."ExternalReference" ADD CONSTRAINT "ExternalReference_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ExternalReference_personId_fkey'
      AND conrelid = 'public."ExternalReference"'::regclass
  ) THEN
    ALTER TABLE public."ExternalReference" ADD CONSTRAINT "ExternalReference_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ExternalReference_invoiceId_fkey'
      AND conrelid = 'public."ExternalReference"'::regclass
  ) THEN
    ALTER TABLE public."ExternalReference" ADD CONSTRAINT "ExternalReference_invoiceId_fkey" FOREIGN KEY ("invoiceId") REFERENCES "Invoice"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ExternalReference_paymentId_fkey'
      AND conrelid = 'public."ExternalReference"'::regclass
  ) THEN
    ALTER TABLE public."ExternalReference" ADD CONSTRAINT "ExternalReference_paymentId_fkey" FOREIGN KEY ("paymentId") REFERENCES "Payment"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ExternalReference_contractId_fkey'
      AND conrelid = 'public."ExternalReference"'::regclass
  ) THEN
    ALTER TABLE public."ExternalReference" ADD CONSTRAINT "ExternalReference_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ExternalReference_unitId_fkey'
      AND conrelid = 'public."ExternalReference"'::regclass
  ) THEN
    ALTER TABLE public."ExternalReference" ADD CONSTRAINT "ExternalReference_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'IntegrationConnection_organizationId_fkey'
      AND conrelid = 'public."IntegrationConnection"'::regclass
  ) THEN
    ALTER TABLE public."IntegrationConnection" ADD CONSTRAINT "IntegrationConnection_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'IntegrationSyncJob_organizationId_fkey'
      AND conrelid = 'public."IntegrationSyncJob"'::regclass
  ) THEN
    ALTER TABLE public."IntegrationSyncJob" ADD CONSTRAINT "IntegrationSyncJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'IntegrationSyncJob_connectionId_fkey'
      AND conrelid = 'public."IntegrationSyncJob"'::regclass
  ) THEN
    ALTER TABLE public."IntegrationSyncJob" ADD CONSTRAINT "IntegrationSyncJob_connectionId_fkey" FOREIGN KEY ("connectionId") REFERENCES "IntegrationConnection"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SyncReviewItem_organizationId_fkey'
      AND conrelid = 'public."SyncReviewItem"'::regclass
  ) THEN
    ALTER TABLE public."SyncReviewItem" ADD CONSTRAINT "SyncReviewItem_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'SyncReviewItem_syncJobId_fkey'
      AND conrelid = 'public."SyncReviewItem"'::regclass
  ) THEN
    ALTER TABLE public."SyncReviewItem" ADD CONSTRAINT "SyncReviewItem_syncJobId_fkey" FOREIGN KEY ("syncJobId") REFERENCES "IntegrationSyncJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceRequest_organizationId_fkey'
      AND conrelid = 'public."MaintenanceRequest"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceRequest_propertyId_fkey'
      AND conrelid = 'public."MaintenanceRequest"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceRequest_unitId_fkey'
      AND conrelid = 'public."MaintenanceRequest"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceRequest_personId_fkey'
      AND conrelid = 'public."MaintenanceRequest"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceRequest" ADD CONSTRAINT "MaintenanceRequest_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceComment_requestId_fkey'
      AND conrelid = 'public."MaintenanceComment"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceComment" ADD CONSTRAINT "MaintenanceComment_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'MaintenanceStatusEvent_requestId_fkey'
      AND conrelid = 'public."MaintenanceStatusEvent"'::regclass
  ) THEN
    ALTER TABLE public."MaintenanceStatusEvent" ADD CONSTRAINT "MaintenanceStatusEvent_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkOrder_organizationId_fkey'
      AND conrelid = 'public."WorkOrder"'::regclass
  ) THEN
    ALTER TABLE public."WorkOrder" ADD CONSTRAINT "WorkOrder_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkOrder_requestId_fkey'
      AND conrelid = 'public."WorkOrder"'::regclass
  ) THEN
    ALTER TABLE public."WorkOrder" ADD CONSTRAINT "WorkOrder_requestId_fkey" FOREIGN KEY ("requestId") REFERENCES "MaintenanceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkOrder_supplierId_fkey'
      AND conrelid = 'public."WorkOrder"'::regclass
  ) THEN
    ALTER TABLE public."WorkOrder" ADD CONSTRAINT "WorkOrder_supplierId_fkey" FOREIGN KEY ("supplierId") REFERENCES "Supplier"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WorkOrder_assigneeUserId_fkey'
      AND conrelid = 'public."WorkOrder"'::regclass
  ) THEN
    ALTER TABLE public."WorkOrder" ADD CONSTRAINT "WorkOrder_assigneeUserId_fkey" FOREIGN KEY ("assigneeUserId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Supplier_organizationId_fkey'
      AND conrelid = 'public."Supplier"'::regclass
  ) THEN
    ALTER TABLE public."Supplier" ADD CONSTRAINT "Supplier_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_organizationId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_personId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_unitId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_unitId_fkey" FOREIGN KEY ("unitId") REFERENCES "Unit"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_propertyId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_propertyId_fkey" FOREIGN KEY ("propertyId") REFERENCES "Property"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_contractId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_contractId_fkey" FOREIGN KEY ("contractId") REFERENCES "Contract"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_applicationId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_applicationId_fkey" FOREIGN KEY ("applicationId") REFERENCES "Application"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_maintenanceRequestId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_maintenanceRequestId_fkey" FOREIGN KEY ("maintenanceRequestId") REFERENCES "MaintenanceRequest"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Document_workOrderId_fkey'
      AND conrelid = 'public."Document"'::regclass
  ) THEN
    ALTER TABLE public."Document" ADD CONSTRAINT "Document_workOrderId_fkey" FOREIGN KEY ("workOrderId") REFERENCES "WorkOrder"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Message_organizationId_fkey'
      AND conrelid = 'public."Message"'::regclass
  ) THEN
    ALTER TABLE public."Message" ADD CONSTRAINT "Message_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Message_senderPersonId_fkey'
      AND conrelid = 'public."Message"'::regclass
  ) THEN
    ALTER TABLE public."Message" ADD CONSTRAINT "Message_senderPersonId_fkey" FOREIGN KEY ("senderPersonId") REFERENCES "Person"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Message_recipientPersonId_fkey'
      AND conrelid = 'public."Message"'::regclass
  ) THEN
    ALTER TABLE public."Message" ADD CONSTRAINT "Message_recipientPersonId_fkey" FOREIGN KEY ("recipientPersonId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Notification_organizationId_fkey'
      AND conrelid = 'public."Notification"'::regclass
  ) THEN
    ALTER TABLE public."Notification" ADD CONSTRAINT "Notification_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'Notification_personId_fkey'
      AND conrelid = 'public."Notification"'::regclass
  ) THEN
    ALTER TABLE public."Notification" ADD CONSTRAINT "Notification_personId_fkey" FOREIGN KEY ("personId") REFERENCES "Person"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ApiKey_organizationId_fkey'
      AND conrelid = 'public."ApiKey"'::regclass
  ) THEN
    ALTER TABLE public."ApiKey" ADD CONSTRAINT "ApiKey_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'IdempotencyRecord_apiKeyId_fkey'
      AND conrelid = 'public."IdempotencyRecord"'::regclass
  ) THEN
    ALTER TABLE public."IdempotencyRecord" ADD CONSTRAINT "IdempotencyRecord_apiKeyId_fkey" FOREIGN KEY ("apiKeyId") REFERENCES "ApiKey"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WebhookSubscription_organizationId_fkey'
      AND conrelid = 'public."WebhookSubscription"'::regclass
  ) THEN
    ALTER TABLE public."WebhookSubscription" ADD CONSTRAINT "WebhookSubscription_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WebhookDelivery_organizationId_fkey'
      AND conrelid = 'public."WebhookDelivery"'::regclass
  ) THEN
    ALTER TABLE public."WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'WebhookDelivery_subscriptionId_fkey'
      AND conrelid = 'public."WebhookDelivery"'::regclass
  ) THEN
    ALTER TABLE public."WebhookDelivery" ADD CONSTRAINT "WebhookDelivery_subscriptionId_fkey" FOREIGN KEY ("subscriptionId") REFERENCES "WebhookSubscription"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'InboundWebhookEvent_organizationId_fkey'
      AND conrelid = 'public."InboundWebhookEvent"'::regclass
  ) THEN
    ALTER TABLE public."InboundWebhookEvent" ADD CONSTRAINT "InboundWebhookEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'ImportJob_organizationId_fkey'
      AND conrelid = 'public."ImportJob"'::regclass
  ) THEN
    ALTER TABLE public."ImportJob" ADD CONSTRAINT "ImportJob_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AuditEvent_organizationId_fkey'
      AND conrelid = 'public."AuditEvent"'::regclass
  ) THEN
    ALTER TABLE public."AuditEvent" ADD CONSTRAINT "AuditEvent_organizationId_fkey" FOREIGN KEY ("organizationId") REFERENCES "Organization"("id") ON DELETE CASCADE ON UPDATE CASCADE;
  END IF;
END
$constraint$;

-- AddForeignKey
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'AuditEvent_userId_fkey'
      AND conrelid = 'public."AuditEvent"'::regclass
  ) THEN
    ALTER TABLE public."AuditEvent" ADD CONSTRAINT "AuditEvent_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;
  END IF;
END
$constraint$;

CREATE UNIQUE INDEX IF NOT EXISTS "Role_system_slug_key" ON public."Role"("slug") WHERE "organizationId" IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS "UserRole_global_key" ON public."UserRole"("userId","roleId") WHERE "propertyId" IS NULL;

-- App profiles are linked 1:1 to Supabase Auth users.
CREATE UNIQUE INDEX IF NOT EXISTS "User_authUserId_key" ON public."User"("authUserId");
DO $constraint$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'User_auth_user_fkey'
      AND conrelid = 'public."User"'::regclass
  ) THEN
    ALTER TABLE public."User"
      ADD CONSTRAINT "User_auth_user_fkey"
      FOREIGN KEY ("authUserId") REFERENCES auth.users(id) ON DELETE CASCADE;
  END IF;
END
$constraint$;

CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW."updatedAt" = now();
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS "Organization_set_updated_at" ON public."Organization";
CREATE TRIGGER "Organization_set_updated_at" BEFORE UPDATE ON public."Organization" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "MasterDataConfig_set_updated_at" ON public."MasterDataConfig";
CREATE TRIGGER "MasterDataConfig_set_updated_at" BEFORE UPDATE ON public."MasterDataConfig" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Person_set_updated_at" ON public."Person";
CREATE TRIGGER "Person_set_updated_at" BEFORE UPDATE ON public."Person" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "User_set_updated_at" ON public."User";
CREATE TRIGGER "User_set_updated_at" BEFORE UPDATE ON public."User" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Role_set_updated_at" ON public."Role";
CREATE TRIGGER "Role_set_updated_at" BEFORE UPDATE ON public."Role" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Property_set_updated_at" ON public."Property";
CREATE TRIGGER "Property_set_updated_at" BEFORE UPDATE ON public."Property" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Building_set_updated_at" ON public."Building";
CREATE TRIGGER "Building_set_updated_at" BEFORE UPDATE ON public."Building" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Unit_set_updated_at" ON public."Unit";
CREATE TRIGGER "Unit_set_updated_at" BEFORE UPDATE ON public."Unit" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Listing_set_updated_at" ON public."Listing";
CREATE TRIGGER "Listing_set_updated_at" BEFORE UPDATE ON public."Listing" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "SavedSearch_set_updated_at" ON public."SavedSearch";
CREATE TRIGGER "SavedSearch_set_updated_at" BEFORE UPDATE ON public."SavedSearch" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Application_set_updated_at" ON public."Application";
CREATE TRIGGER "Application_set_updated_at" BEFORE UPDATE ON public."Application" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Viewing_set_updated_at" ON public."Viewing";
CREATE TRIGGER "Viewing_set_updated_at" BEFORE UPDATE ON public."Viewing" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "ViewingAttendee_set_updated_at" ON public."ViewingAttendee";
CREATE TRIGGER "ViewingAttendee_set_updated_at" BEFORE UPDATE ON public."ViewingAttendee" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Offer_set_updated_at" ON public."Offer";
CREATE TRIGGER "Offer_set_updated_at" BEFORE UPDATE ON public."Offer" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Contract_set_updated_at" ON public."Contract";
CREATE TRIGGER "Contract_set_updated_at" BEFORE UPDATE ON public."Contract" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Termination_set_updated_at" ON public."Termination";
CREATE TRIGGER "Termination_set_updated_at" BEFORE UPDATE ON public."Termination" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Inspection_set_updated_at" ON public."Inspection";
CREATE TRIGGER "Inspection_set_updated_at" BEFORE UPDATE ON public."Inspection" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Invoice_set_updated_at" ON public."Invoice";
CREATE TRIGGER "Invoice_set_updated_at" BEFORE UPDATE ON public."Invoice" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "ExternalReference_set_updated_at" ON public."ExternalReference";
CREATE TRIGGER "ExternalReference_set_updated_at" BEFORE UPDATE ON public."ExternalReference" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "IntegrationConnection_set_updated_at" ON public."IntegrationConnection";
CREATE TRIGGER "IntegrationConnection_set_updated_at" BEFORE UPDATE ON public."IntegrationConnection" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "SyncReviewItem_set_updated_at" ON public."SyncReviewItem";
CREATE TRIGGER "SyncReviewItem_set_updated_at" BEFORE UPDATE ON public."SyncReviewItem" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "MaintenanceRequest_set_updated_at" ON public."MaintenanceRequest";
CREATE TRIGGER "MaintenanceRequest_set_updated_at" BEFORE UPDATE ON public."MaintenanceRequest" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "WorkOrder_set_updated_at" ON public."WorkOrder";
CREATE TRIGGER "WorkOrder_set_updated_at" BEFORE UPDATE ON public."WorkOrder" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Supplier_set_updated_at" ON public."Supplier";
CREATE TRIGGER "Supplier_set_updated_at" BEFORE UPDATE ON public."Supplier" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "Document_set_updated_at" ON public."Document";
CREATE TRIGGER "Document_set_updated_at" BEFORE UPDATE ON public."Document" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "ApiKey_set_updated_at" ON public."ApiKey";
CREATE TRIGGER "ApiKey_set_updated_at" BEFORE UPDATE ON public."ApiKey" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "WebhookSubscription_set_updated_at" ON public."WebhookSubscription";
CREATE TRIGGER "WebhookSubscription_set_updated_at" BEFORE UPDATE ON public."WebhookSubscription" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

DROP TRIGGER IF EXISTS "WebhookDelivery_set_updated_at" ON public."WebhookDelivery";
CREATE TRIGGER "WebhookDelivery_set_updated_at" BEFORE UPDATE ON public."WebhookDelivery" FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();


-- Helpers used by Row Level Security.
CREATE OR REPLACE FUNCTION public.current_app_organization_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "organizationId" FROM "User" WHERE "authUserId" = auth.uid() AND "isActive" = true LIMIT 1
$$;

CREATE OR REPLACE FUNCTION public.current_app_person_id()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT "personId" FROM "User" WHERE "authUserId" = auth.uid() AND "isActive" = true LIMIT 1
$$;

REVOKE ALL ON FUNCTION public.current_app_organization_id() FROM public;
REVOKE ALL ON FUNCTION public.current_app_person_id() FROM public;
GRANT EXECUTE ON FUNCTION public.current_app_organization_id() TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_app_person_id() TO authenticated;

-- RLS is enabled on every application table. Server administration uses the
-- Supabase secret key; browser access remains policy-controlled.
ALTER TABLE public."Organization" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MasterDataConfig" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Person" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PersonRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."User" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Invitation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Role" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."RolePermission" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UserRole" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Property" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Building" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Entrance" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Floor" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Unit" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."UnitMedia" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Listing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ListingPublication" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Favorite" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SavedSearch" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Application" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ApplicationMember" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ApplicationStatusEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Viewing" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ViewingAttendee" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Offer" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Contract" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContractParty" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContractVersion" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ContractStatusEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Termination" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Inspection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Invoice" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InvoiceLine" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InvoiceStatusEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Payment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."PaymentAllocation" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ExternalReference" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."IntegrationConnection" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."IntegrationSyncJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."SyncReviewItem" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MaintenanceRequest" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MaintenanceComment" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."MaintenanceStatusEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WorkOrder" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Supplier" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Document" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Message" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Notification" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ApiKey" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."IdempotencyRecord" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WebhookSubscription" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."WebhookDelivery" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."InboundWebhookEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."ImportJob" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."AuditEvent" ENABLE ROW LEVEL SECURITY;
ALTER TABLE public."Counter" ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "public_read_published_listings" ON public."Listing";
CREATE POLICY "public_read_published_listings" ON public."Listing" FOR SELECT TO anon, authenticated
USING ("status" = 'PUBLISHED');
DROP POLICY IF EXISTS "public_read_catalog_units" ON public."Unit";
CREATE POLICY "public_read_catalog_units" ON public."Unit" FOR SELECT TO anon, authenticated
USING ("status" IN ('PUBLISHED','APPLICATION_OPEN','FOR_SALE','BIDDING','RENTED'));
DROP POLICY IF EXISTS "public_read_properties" ON public."Property";
CREATE POLICY "public_read_properties" ON public."Property" FOR SELECT TO anon, authenticated
USING ("status" <> 'ARCHIVED');
DROP POLICY IF EXISTS "public_read_buildings" ON public."Building";
CREATE POLICY "public_read_buildings" ON public."Building" FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS "public_read_unit_media" ON public."UnitMedia";
CREATE POLICY "public_read_unit_media" ON public."UnitMedia" FOR SELECT TO anon, authenticated USING (true);

DROP POLICY IF EXISTS "user_read_own_profile" ON public."User";
CREATE POLICY "user_read_own_profile" ON public."User" FOR SELECT TO authenticated
USING ("authUserId" = auth.uid());
DROP POLICY IF EXISTS "user_update_own_profile" ON public."User";
CREATE POLICY "user_update_own_profile" ON public."User" FOR UPDATE TO authenticated
USING ("authUserId" = auth.uid()) WITH CHECK ("authUserId" = auth.uid());
DROP POLICY IF EXISTS "person_read_own" ON public."Person";
CREATE POLICY "person_read_own" ON public."Person" FOR SELECT TO authenticated
USING ("id" = public.current_app_person_id());
DROP POLICY IF EXISTS "person_update_own" ON public."Person";
CREATE POLICY "person_update_own" ON public."Person" FOR UPDATE TO authenticated
USING ("id" = public.current_app_person_id()) WITH CHECK ("id" = public.current_app_person_id());
DROP POLICY IF EXISTS "person_roles_read_own" ON public."PersonRole";
CREATE POLICY "person_roles_read_own" ON public."PersonRole" FOR SELECT TO authenticated
USING ("personId" = public.current_app_person_id());

-- Storage buckets and policies.
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('property-media', 'property-media', true, 20971520, ARRAY['image/jpeg','image/png','image/webp','application/pdf']),
  ('tenant-documents', 'tenant-documents', false, 52428800, ARRAY['application/pdf','image/jpeg','image/png','image/webp']),
  ('maintenance-files', 'maintenance-files', false, 52428800, ARRAY['image/jpeg','image/png','image/webp','application/pdf','video/mp4'])
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "public_property_media_read" ON storage.objects;
CREATE POLICY "public_property_media_read" ON storage.objects FOR SELECT TO anon, authenticated
USING (bucket_id = 'property-media');
DROP POLICY IF EXISTS "authenticated_private_storage_read" ON storage.objects;
CREATE POLICY "authenticated_private_storage_read" ON storage.objects FOR SELECT TO authenticated
USING (bucket_id IN ('tenant-documents','maintenance-files'));
DROP POLICY IF EXISTS "authenticated_private_storage_insert" ON storage.objects;
CREATE POLICY "authenticated_private_storage_insert" ON storage.objects FOR INSERT TO authenticated
WITH CHECK (bucket_id IN ('tenant-documents','maintenance-files'));

-- PostgREST permissions. RLS still determines which rows are visible.
GRANT USAGE ON SCHEMA public TO anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Organization" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."MasterDataConfig" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Person" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."PersonRole" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."User" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Invitation" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Role" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."RolePermission" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."UserRole" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Property" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Building" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Entrance" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Floor" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Unit" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."UnitMedia" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Listing" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ListingPublication" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Favorite" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."SavedSearch" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Application" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ApplicationMember" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ApplicationStatusEvent" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Viewing" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ViewingAttendee" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Offer" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Contract" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ContractParty" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ContractVersion" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ContractStatusEvent" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Termination" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Inspection" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Invoice" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."InvoiceLine" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."InvoiceStatusEvent" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Payment" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."PaymentAllocation" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ExternalReference" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."IntegrationConnection" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."IntegrationSyncJob" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."SyncReviewItem" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."MaintenanceRequest" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."MaintenanceComment" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."MaintenanceStatusEvent" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."WorkOrder" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Supplier" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Document" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Message" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Notification" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ApiKey" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."IdempotencyRecord" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."WebhookSubscription" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."WebhookDelivery" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."InboundWebhookEvent" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."ImportJob" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."AuditEvent" TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE public."Counter" TO authenticated;
GRANT SELECT ON TABLE public."Listing" TO anon;
GRANT SELECT ON TABLE public."Unit" TO anon;
GRANT SELECT ON TABLE public."Property" TO anon;
GRANT SELECT ON TABLE public."Building" TO anon;
GRANT SELECT ON TABLE public."UnitMedia" TO anon;

COMMIT;
