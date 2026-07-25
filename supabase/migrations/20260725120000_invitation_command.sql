BEGIN;

CREATE OR REPLACE FUNCTION public.create_person_invitation(
  p_organization_id text,
  p_person_id text,
  p_token_hash text,
  p_expires_at timestamp without time zone,
  p_actor_user_id text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_person public."Person"%ROWTYPE;
  v_invitation_id text := gen_random_uuid()::text;
BEGIN
  PERFORM public.assert_service_role();
  SELECT * INTO v_person
  FROM public."Person"
  WHERE id = p_person_id AND "organizationId" = p_organization_id
  FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'person_not_found'; END IF;
  IF nullif(trim(v_person.email), '') IS NULL THEN RAISE EXCEPTION 'person_email_missing'; END IF;
  IF EXISTS (
    SELECT 1 FROM public."User"
    WHERE "organizationId" = p_organization_id AND "personId" = p_person_id
  ) THEN
    RAISE EXCEPTION 'person_already_has_account';
  END IF;

  INSERT INTO public."Invitation" (
    id, "organizationId", "personId", email, "tokenHash", "expiresAt"
  ) VALUES (
    v_invitation_id, p_organization_id, p_person_id, lower(v_person.email),
    p_token_hash, p_expires_at
  );
  INSERT INTO public."AuditEvent" (
    id, "organizationId", "userId", "actorType", "actorId", action,
    "entityType", "entityId", after
  ) VALUES (
    gen_random_uuid()::text, p_organization_id, p_actor_user_id,
    CASE WHEN p_actor_user_id IS NULL THEN 'system' ELSE 'user' END,
    p_actor_user_id, 'invitation_created', 'invitation', v_invitation_id,
    jsonb_build_object('personId', p_person_id, 'email', lower(v_person.email))
  );
  RETURN jsonb_build_object(
    'id', v_invitation_id,
    'email', lower(v_person.email),
    'personId', p_person_id,
    'expiresAt', p_expires_at
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_person_invitation(text,text,text,timestamp without time zone,text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_person_invitation(text,text,text,timestamp without time zone,text) TO service_role;

COMMIT;
