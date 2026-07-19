-- Östgöta El Teknik Fastighetsplattform
-- Step: Foreign keys for identity, properties, applications and contracts
-- Safe to run in filename order. This file is transactional.

BEGIN;
SET LOCAL search_path = public, extensions;

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

COMMIT;
