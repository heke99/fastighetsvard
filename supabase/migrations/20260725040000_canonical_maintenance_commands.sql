-- Atomic maintenance and work-order commands.

BEGIN;
SET LOCAL search_path = public, extensions;

CREATE FUNCTION public.create_maintenance_request(
  p_organization_id text,
  p_property_id text,
  p_unit_id text,
  p_person_id text,
  p_category text,
  p_subcategory text,
  p_room text,
  p_title text,
  p_description text,
  p_priority public."MaintenancePriority",
  p_discovered_at timestamp without time zone,
  p_contact_phone text,
  p_preferred_time text,
  p_master_key_allowed boolean,
  p_pets_in_home boolean,
  p_is_emergency boolean,
  p_actor_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_request_id text := gen_random_uuid()::text;
  v_request_number integer;
BEGIN
  IF p_unit_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."Unit" u
    WHERE u."id" = p_unit_id AND u."organizationId" = p_organization_id
      AND (p_property_id IS NULL OR u."propertyId" = p_property_id)
  ) THEN
    RAISE EXCEPTION 'maintenance_unit_not_found';
  END IF;
  IF p_property_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."Property" p
    WHERE p."id" = p_property_id AND p."organizationId" = p_organization_id
  ) THEN
    RAISE EXCEPTION 'maintenance_property_not_found';
  END IF;
  IF p_person_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."Person" p
    WHERE p."id" = p_person_id AND p."organizationId" = p_organization_id
  ) THEN
    RAISE EXCEPTION 'maintenance_person_not_found';
  END IF;

  INSERT INTO public."Counter" ("organizationId", "key", "value")
  VALUES (p_organization_id, 'maintenance', 1)
  ON CONFLICT ("organizationId", "key")
  DO UPDATE SET "value" = public."Counter"."value" + 1
  RETURNING "value" INTO v_request_number;

  INSERT INTO public."MaintenanceRequest" (
    "id", "organizationId", "requestNumber", "propertyId", "unitId", "personId",
    "category", "subcategory", "room", "title", "description", "priority",
    "discoveredAt", "contactPhone", "preferredTime", "masterKeyAllowed",
    "petsInHome", "isEmergency"
  ) VALUES (
    v_request_id, p_organization_id, v_request_number, p_property_id, p_unit_id,
    p_person_id, p_category, p_subcategory, p_room, p_title, p_description,
    CASE WHEN p_is_emergency THEN 'URGENT'::public."MaintenancePriority"
      ELSE COALESCE(p_priority, 'NORMAL'::public."MaintenancePriority") END,
    p_discovered_at, p_contact_phone, p_preferred_time,
    COALESCE(p_master_key_allowed, false), COALESCE(p_pets_in_home, false),
    COALESCE(p_is_emergency, false)
  );

  INSERT INTO public."MaintenanceStatusEvent" ("requestId", "toStatus", "changedByUserId")
  VALUES (v_request_id, 'RECEIVED', p_actor_user_id);

  IF p_person_id IS NOT NULL THEN
    INSERT INTO public."Notification" (
      "organizationId", "personId", "eventType", "title", "body"
    ) VALUES (
      p_organization_id, p_person_id, 'maintenance_received',
      'Felanmälan #' || v_request_number || ' mottagen',
      'Vi har tagit emot din felanmälan "' || p_title || '" och återkommer så snart som möjligt.'
    );
  END IF;

  PERFORM public.write_audit_event(
    p_organization_id, 'maintenance_request_created', 'maintenance_request',
    v_request_id, NULL,
    jsonb_build_object(
      'requestNumber', v_request_number,
      'title', p_title,
      'isEmergency', COALESCE(p_is_emergency, false)
    ),
    'user', p_actor_user_id
  );

  RETURN jsonb_build_object(
    'id', v_request_id,
    'requestNumber', v_request_number,
    'title', p_title,
    'status', 'RECEIVED'
  );
END
$function$;

CREATE FUNCTION public.change_maintenance_status(
  p_organization_id text,
  p_request_id text,
  p_expected_status public."MaintenanceStatus",
  p_to_status public."MaintenanceStatus",
  p_comment text,
  p_actor_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_request public."MaintenanceRequest"%ROWTYPE;
  v_allowed boolean := false;
BEGIN
  SELECT * INTO v_request
  FROM public."MaintenanceRequest"
  WHERE "id" = p_request_id AND "organizationId" = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'maintenance_request_not_found'; END IF;
  IF p_expected_status IS NOT NULL AND v_request."status" <> p_expected_status THEN
    RAISE EXCEPTION 'optimistic_lock_conflict';
  END IF;

  v_allowed := CASE v_request."status"
    WHEN 'RECEIVED' THEN p_to_status = ANY(ARRAY['CONFIRMED','REJECTED']::public."MaintenanceStatus"[])
    WHEN 'CONFIRMED' THEN p_to_status = ANY(ARRAY['ASSESSING','ASSIGNED','REJECTED']::public."MaintenanceStatus"[])
    WHEN 'ASSESSING' THEN p_to_status = ANY(ARRAY['NEEDS_INFO','ASSIGNED','REJECTED']::public."MaintenanceStatus"[])
    WHEN 'NEEDS_INFO' THEN p_to_status = ANY(ARRAY['ASSESSING','ASSIGNED','REJECTED']::public."MaintenanceStatus"[])
    WHEN 'ASSIGNED' THEN p_to_status = ANY(ARRAY['BOOKED','IN_PROGRESS','ASSESSING']::public."MaintenanceStatus"[])
    WHEN 'BOOKED' THEN p_to_status = ANY(ARRAY['IN_PROGRESS','ASSIGNED']::public."MaintenanceStatus"[])
    WHEN 'IN_PROGRESS' THEN p_to_status = ANY(ARRAY['WAITING_TENANT','WAITING_CONTRACTOR','WAITING_MATERIAL','DONE']::public."MaintenanceStatus"[])
    WHEN 'WAITING_TENANT' THEN p_to_status = ANY(ARRAY['IN_PROGRESS','DONE']::public."MaintenanceStatus"[])
    WHEN 'WAITING_CONTRACTOR' THEN p_to_status = ANY(ARRAY['IN_PROGRESS','DONE']::public."MaintenanceStatus"[])
    WHEN 'WAITING_MATERIAL' THEN p_to_status = ANY(ARRAY['IN_PROGRESS','DONE']::public."MaintenanceStatus"[])
    WHEN 'DONE' THEN p_to_status = ANY(ARRAY['QUALITY_CHECK','CLOSED','REOPENED']::public."MaintenanceStatus"[])
    WHEN 'QUALITY_CHECK' THEN p_to_status = ANY(ARRAY['CLOSED','REOPENED']::public."MaintenanceStatus"[])
    WHEN 'CLOSED' THEN p_to_status = 'REOPENED'
    WHEN 'REJECTED' THEN p_to_status = 'REOPENED'
    WHEN 'REOPENED' THEN p_to_status = ANY(ARRAY['ASSESSING','ASSIGNED','IN_PROGRESS']::public."MaintenanceStatus"[])
    ELSE false
  END;
  IF NOT v_allowed THEN RAISE EXCEPTION 'invalid_maintenance_transition'; END IF;

  UPDATE public."MaintenanceRequest"
  SET "status" = p_to_status,
      "closedAt" = CASE WHEN p_to_status = 'CLOSED' THEN CURRENT_TIMESTAMP ELSE "closedAt" END
  WHERE "id" = p_request_id;

  INSERT INTO public."MaintenanceStatusEvent" (
    "requestId", "fromStatus", "toStatus", "comment", "changedByUserId"
  ) VALUES (
    p_request_id, v_request."status", p_to_status, p_comment, p_actor_user_id
  );

  IF v_request."personId" IS NOT NULL AND p_to_status IN ('DONE', 'CLOSED') THEN
    INSERT INTO public."Notification" (
      "organizationId", "personId", "eventType", "title", "body"
    ) VALUES (
      p_organization_id, v_request."personId", 'maintenance_done',
      'Felanmälan #' || v_request."requestNumber" ||
        CASE WHEN p_to_status = 'DONE' THEN ' åtgärdad' ELSE ' stängd' END,
      'Ärendet "' || v_request."title" || '" har uppdaterats.'
    );
  END IF;

  PERFORM public.write_audit_event(
    p_organization_id, 'status_change', 'maintenance_request', p_request_id,
    jsonb_build_object('status', v_request."status"),
    jsonb_build_object('status', p_to_status),
    'user', p_actor_user_id
  );
  RETURN jsonb_build_object('id', p_request_id, 'status', p_to_status);
END
$function$;

CREATE FUNCTION public.create_work_order(
  p_organization_id text,
  p_request_id text,
  p_supplier_id text,
  p_assignee_user_id text,
  p_title text,
  p_description text,
  p_priority public."MaintenancePriority",
  p_access_info text,
  p_scheduled_at timestamp without time zone,
  p_actor_user_id text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_id text := gen_random_uuid()::text;
  v_number integer;
  v_status public."WorkOrderStatus";
BEGIN
  IF p_request_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."MaintenanceRequest" r
    WHERE r."id" = p_request_id AND r."organizationId" = p_organization_id
  ) THEN RAISE EXCEPTION 'maintenance_request_not_found'; END IF;
  IF p_supplier_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM public."Supplier" s
    WHERE s."id" = p_supplier_id AND s."organizationId" = p_organization_id AND s."isActive"
  ) THEN RAISE EXCEPTION 'supplier_not_found'; END IF;

  INSERT INTO public."Counter" ("organizationId", "key", "value")
  VALUES (p_organization_id, 'workorder', 1)
  ON CONFLICT ("organizationId", "key")
  DO UPDATE SET "value" = public."Counter"."value" + 1
  RETURNING "value" INTO v_number;
  v_status := CASE WHEN p_supplier_id IS NULL THEN 'CREATED' ELSE 'OFFERED' END;

  INSERT INTO public."WorkOrder" (
    "id", "organizationId", "requestId", "supplierId", "assigneeUserId",
    "orderNumber", "status", "priority", "title", "description", "accessInfo",
    "scheduledAt"
  ) VALUES (
    v_id, p_organization_id, p_request_id, p_supplier_id, p_assignee_user_id,
    v_number, v_status, COALESCE(p_priority, 'NORMAL'), p_title, p_description,
    p_access_info, p_scheduled_at
  );

  PERFORM public.write_audit_event(
    p_organization_id, 'work_order_created', 'work_order', v_id, NULL,
    jsonb_build_object('orderNumber', v_number, 'supplierId', p_supplier_id),
    'user', p_actor_user_id
  );
  RETURN jsonb_build_object('id', v_id, 'orderNumber', v_number, 'status', v_status);
END
$function$;

CREATE FUNCTION public.change_work_order_status(
  p_organization_id text,
  p_work_order_id text,
  p_expected_status public."WorkOrderStatus",
  p_to_status public."WorkOrderStatus",
  p_actor_user_id text,
  p_supplier_id text,
  p_time_reported numeric,
  p_materials_used text,
  p_cost numeric,
  p_notes text,
  p_scheduled_at timestamp without time zone
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $function$
DECLARE
  v_order public."WorkOrder"%ROWTYPE;
  v_allowed boolean := false;
BEGIN
  SELECT * INTO v_order
  FROM public."WorkOrder"
  WHERE "id" = p_work_order_id
    AND "organizationId" = p_organization_id
    AND (p_supplier_id IS NULL OR "supplierId" = p_supplier_id)
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'work_order_not_found'; END IF;
  IF p_expected_status IS NOT NULL AND v_order."status" <> p_expected_status THEN
    RAISE EXCEPTION 'optimistic_lock_conflict';
  END IF;
  IF p_supplier_id IS NOT NULL AND p_to_status IN ('APPROVED','INVOICED','CANCELLED') THEN
    RAISE EXCEPTION 'supplier_status_forbidden';
  END IF;

  v_allowed := CASE v_order."status"
    WHEN 'CREATED' THEN p_to_status = ANY(ARRAY['OFFERED','BOOKED','IN_PROGRESS','CANCELLED']::public."WorkOrderStatus"[])
    WHEN 'OFFERED' THEN p_to_status = ANY(ARRAY['ACCEPTED','REJECTED','CANCELLED']::public."WorkOrderStatus"[])
    WHEN 'ACCEPTED' THEN p_to_status = ANY(ARRAY['BOOKED','IN_PROGRESS','CANCELLED']::public."WorkOrderStatus"[])
    WHEN 'REJECTED' THEN p_to_status = ANY(ARRAY['OFFERED','CANCELLED']::public."WorkOrderStatus"[])
    WHEN 'BOOKED' THEN p_to_status = ANY(ARRAY['IN_PROGRESS','CANCELLED']::public."WorkOrderStatus"[])
    WHEN 'IN_PROGRESS' THEN p_to_status = ANY(ARRAY['DONE','CANCELLED']::public."WorkOrderStatus"[])
    WHEN 'DONE' THEN p_to_status = ANY(ARRAY['APPROVED','IN_PROGRESS']::public."WorkOrderStatus"[])
    WHEN 'APPROVED' THEN p_to_status = 'INVOICED'
    ELSE false
  END;
  IF NOT v_allowed THEN RAISE EXCEPTION 'invalid_work_order_transition'; END IF;

  UPDATE public."WorkOrder"
  SET "status" = p_to_status,
      "completedAt" = CASE WHEN p_to_status = 'DONE' THEN CURRENT_TIMESTAMP ELSE "completedAt" END,
      "timeReported" = COALESCE(p_time_reported, "timeReported"),
      "materialsUsed" = COALESCE(p_materials_used, "materialsUsed"),
      "cost" = COALESCE(p_cost, "cost"),
      "notes" = COALESCE(p_notes, "notes"),
      "scheduledAt" = COALESCE(p_scheduled_at, "scheduledAt"),
      "approvedByUserId" = CASE WHEN p_to_status = 'APPROVED' THEN p_actor_user_id ELSE "approvedByUserId" END,
      "approvedAt" = CASE WHEN p_to_status = 'APPROVED' THEN CURRENT_TIMESTAMP ELSE "approvedAt" END
  WHERE "id" = p_work_order_id;

  PERFORM public.write_audit_event(
    p_organization_id, 'status_change', 'work_order', p_work_order_id,
    jsonb_build_object('status', v_order."status"),
    jsonb_build_object('status', p_to_status),
    'user', p_actor_user_id
  );
  RETURN jsonb_build_object('id', p_work_order_id, 'status', p_to_status);
END
$function$;

REVOKE ALL ON FUNCTION public.create_maintenance_request(
  text,text,text,text,text,text,text,text,text,public."MaintenancePriority",
  timestamp without time zone,text,text,boolean,boolean,boolean,text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.change_maintenance_status(
  text,text,public."MaintenanceStatus",public."MaintenanceStatus",text,text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.create_work_order(
  text,text,text,text,text,text,public."MaintenancePriority",
  text,timestamp without time zone,text
) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.change_work_order_status(
  text,text,public."WorkOrderStatus",public."WorkOrderStatus",text,text,
  numeric,text,numeric,text,timestamp without time zone
) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.create_maintenance_request(
  text,text,text,text,text,text,text,text,text,public."MaintenancePriority",
  timestamp without time zone,text,text,boolean,boolean,boolean,text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.change_maintenance_status(
  text,text,public."MaintenanceStatus",public."MaintenanceStatus",text,text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.create_work_order(
  text,text,text,text,text,text,public."MaintenancePriority",
  text,timestamp without time zone,text
) TO service_role;
GRANT EXECUTE ON FUNCTION public.change_work_order_status(
  text,text,public."WorkOrderStatus",public."WorkOrderStatus",text,text,
  numeric,text,numeric,text,timestamp without time zone
) TO service_role;

COMMIT;
