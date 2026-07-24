-- Run read-only before applying the 20260724 hardening migrations to an existing database.
-- Every returned row must be reviewed and resolved. This script changes no data.

SELECT 'duplicate_active_applications' AS check_name, a."listingId", am."personId", count(*) AS conflict_count,
       array_agg(a."id" ORDER BY a."createdAt") AS record_ids
FROM public."Application" a
JOIN public."ApplicationMember" am ON am."applicationId" = a."id" AND am."role" = 'MAIN_APPLICANT'
WHERE a."status" NOT IN ('CLOSED','WITHDRAWN','DECLINED')
GROUP BY a."listingId", am."personId"
HAVING count(*) > 1;

SELECT 'multiple_accepted_offers' AS check_name, o."listingId", count(*) AS conflict_count,
       array_agg(o."id" ORDER BY o."createdAt") AS record_ids
FROM public."Offer" o
WHERE o."status" = 'ACCEPTED'
GROUP BY o."listingId"
HAVING count(*) > 1;

SELECT 'overlapping_binding_contracts' AS check_name, a."unitId", a."id" AS contract_a,
       b."id" AS contract_b, a."startDate" AS a_start, a."endDate" AS a_end,
       b."startDate" AS b_start, b."endDate" AS b_end
FROM public."Contract" a
JOIN public."Contract" b ON b."unitId" = a."unitId" AND b."id" > a."id"
WHERE a."status" IN ('SENT_FOR_SIGNING','PARTIALLY_SIGNED','SIGNED','ACTIVE')
  AND b."status" IN ('SENT_FOR_SIGNING','PARTIALLY_SIGNED','SIGNED','ACTIVE')
  AND tsrange(a."startDate", COALESCE(a."endDate", 'infinity'::timestamp), '[)')
      && tsrange(b."startDate", COALESCE(b."endDate", 'infinity'::timestamp), '[)');

SELECT 'plaintext_personal_numbers' AS check_name, count(*) AS affected_rows
FROM public."Person"
WHERE "personalNumber" IS NOT NULL AND btrim("personalNumber") <> '';

SELECT 'unlinked_private_files' AS check_name, o.bucket_id, count(*) AS affected_rows
FROM storage.objects o
LEFT JOIN public."Document" d ON d."storageBucket" = o.bucket_id AND d."storagePath" = o.name
WHERE o.bucket_id <> 'listing-media' AND d."id" IS NULL
GROUP BY o.bucket_id;
