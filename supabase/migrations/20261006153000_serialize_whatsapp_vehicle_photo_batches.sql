BEGIN;

ALTER TABLE public.whatsapp_cloud_inbound_queue
  ADD COLUMN IF NOT EXISTS vehicle_media_id uuid,
  ADD COLUMN IF NOT EXISTS vehicle_media_reused boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vehicle_batch_claimed_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_vehicle_photo_batch
  ON public.whatsapp_cloud_inbound_queue
    (phone_number_id, from_number, created_at)
  WHERE message_type = 'image' AND vehicle_media_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.claim_whatsapp_vehicle_photo_batch(
  p_queue_id uuid
)
RETURNS TABLE (
  queue_id uuid,
  media_id uuid,
  reused boolean,
  event_created_at timestamptz,
  should_offer boolean
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_current public.whatsapp_cloud_inbound_queue%ROWTYPE;
  v_start timestamptz;
  v_has_newer boolean;
  v_already_claimed boolean;
  v_should_offer boolean := false;
BEGIN
  SELECT * INTO v_current
  FROM public.whatsapp_cloud_inbound_queue
  WHERE id = p_queue_id;

  IF v_current.id IS NULL OR v_current.message_type <> 'image'
    OR v_current.vehicle_media_id IS NULL THEN
    RETURN;
  END IF;

  PERFORM pg_advisory_xact_lock(
    hashtextextended(
      v_current.phone_number_id || ':' || v_current.from_number,
      0
    )
  );

  WITH ordered AS (
    SELECT
      q.created_at,
      lag(q.created_at) OVER (ORDER BY q.created_at, q.id) AS previous_at
    FROM public.whatsapp_cloud_inbound_queue q
    WHERE q.phone_number_id = v_current.phone_number_id
      AND q.from_number = v_current.from_number
      AND q.message_type = 'image'
      AND q.created_at BETWEEN v_current.created_at - interval '3 minutes'
        AND v_current.created_at
  )
  SELECT COALESCE(max(created_at), v_current.created_at - interval '3 minutes')
    INTO v_start
  FROM ordered
  WHERE previous_at IS NULL
     OR created_at - previous_at > interval '60 seconds';

  SELECT EXISTS (
    SELECT 1
    FROM public.whatsapp_cloud_inbound_queue q
    WHERE q.phone_number_id = v_current.phone_number_id
      AND q.from_number = v_current.from_number
      AND q.message_type = 'image'
      AND (q.created_at, q.id) > (v_current.created_at, v_current.id)
      AND q.created_at <= v_current.created_at + interval '60 seconds'
  ) INTO v_has_newer;

  SELECT EXISTS (
    SELECT 1
    FROM public.whatsapp_cloud_inbound_queue q
    WHERE q.phone_number_id = v_current.phone_number_id
      AND q.from_number = v_current.from_number
      AND q.message_type = 'image'
      AND q.created_at BETWEEN v_start AND v_current.created_at
      AND q.vehicle_batch_claimed_at IS NOT NULL
  ) INTO v_already_claimed;

  IF NOT v_has_newer AND NOT v_already_claimed THEN
    UPDATE public.whatsapp_cloud_inbound_queue q
    SET vehicle_batch_claimed_at = now()
    WHERE q.phone_number_id = v_current.phone_number_id
      AND q.from_number = v_current.from_number
      AND q.message_type = 'image'
      AND q.created_at BETWEEN v_start AND v_current.created_at;
    v_should_offer := true;
  END IF;

  RETURN QUERY
  SELECT
    q.id,
    q.vehicle_media_id,
    q.vehicle_media_reused,
    q.created_at,
    v_should_offer
  FROM public.whatsapp_cloud_inbound_queue q
  WHERE q.phone_number_id = v_current.phone_number_id
    AND q.from_number = v_current.from_number
    AND q.message_type = 'image'
    AND q.created_at BETWEEN v_start AND v_current.created_at
    AND q.vehicle_media_id IS NOT NULL
  ORDER BY q.created_at, q.id;
END;
$$;

CREATE OR REPLACE FUNCTION public.append_vehicle_carousel_photos(
  p_conversation_id uuid,
  p_photos jsonb
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_state jsonb;
  v_pending jsonb;
  v_merged jsonb;
BEGIN
  PERFORM pg_advisory_xact_lock(hashtextextended(p_conversation_id::text, 0));

  SELECT agent_state INTO v_state
  FROM public.whatsapp_cloud_conversations
  WHERE id = p_conversation_id
  FOR UPDATE;

  v_pending := v_state -> 'pending_carrossel_veiculo';
  IF COALESCE(v_pending ->> 'stage', '') <> 'collecting' THEN
    RETURN NULL;
  END IF;

  WITH combined AS (
    SELECT value AS photo, ordinality AS position
    FROM jsonb_array_elements(COALESCE(v_pending -> 'photos', '[]'::jsonb))
      WITH ORDINALITY
    UNION ALL
    SELECT value AS photo, 1000 + ordinality AS position
    FROM jsonb_array_elements(COALESCE(p_photos, '[]'::jsonb))
      WITH ORDINALITY
  ),
  deduplicated AS (
    SELECT DISTINCT ON (photo ->> 'id') photo, position
    FROM combined
    WHERE COALESCE(photo ->> 'id', '') <> ''
      AND COALESCE(photo ->> 'url', '') <> ''
    ORDER BY photo ->> 'id', position
  )
  SELECT COALESCE(jsonb_agg(photo ORDER BY position), '[]'::jsonb)
    INTO v_merged
  FROM (
    SELECT photo, position
    FROM deduplicated
    ORDER BY position
    LIMIT 8
  ) limited;

  v_pending := jsonb_set(v_pending, '{photos}', v_merged, true);
  v_pending := jsonb_set(
    v_pending,
    '{created_at}',
    to_jsonb(to_char(clock_timestamp(), 'YYYY-MM-DD"T"HH24:MI:SS.MS"Z"')),
    true
  );
  v_state := jsonb_set(v_state, '{pending_carrossel_veiculo}', v_pending, true);

  UPDATE public.whatsapp_cloud_conversations
  SET agent_state = v_state
  WHERE id = p_conversation_id;

  RETURN v_pending;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_vehicle_photo_batch(uuid)
  FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.append_vehicle_carousel_photos(uuid, jsonb)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_vehicle_photo_batch(uuid)
  TO service_role;
GRANT EXECUTE ON FUNCTION public.append_vehicle_carousel_photos(uuid, jsonb)
  TO service_role;

COMMIT;
