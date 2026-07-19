-- Östgöta El Teknik Fastighetsplattform
-- Step: Extensions and enum types
-- Safe to run in filename order. This file is transactional.

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

COMMIT;
