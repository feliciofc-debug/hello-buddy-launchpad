BEGIN;

DROP INDEX IF EXISTS public.idx_wa_vehicle_photo_batch;
CREATE INDEX idx_wa_vehicle_photo_batch
  ON public.whatsapp_cloud_inbound_queue
    (phone_number_id, from_number, created_at)
  WHERE message_type IN ('image', 'document')
    AND vehicle_media_id IS NOT NULL;

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

  IF v_current.id IS NULL
    OR v_current.message_type NOT IN ('image', 'document')
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
      AND q.message_type IN ('image', 'document')
      AND (q.message_type = 'image' OR q.vehicle_media_id IS NOT NULL)
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
      AND q.message_type IN ('image', 'document')
      AND (q.message_type = 'image' OR q.vehicle_media_id IS NOT NULL)
      AND (q.created_at, q.id) > (v_current.created_at, v_current.id)
      AND q.created_at <= v_current.created_at + interval '60 seconds'
  ) INTO v_has_newer;

  SELECT EXISTS (
    SELECT 1
    FROM public.whatsapp_cloud_inbound_queue q
    WHERE q.phone_number_id = v_current.phone_number_id
      AND q.from_number = v_current.from_number
      AND q.message_type IN ('image', 'document')
      AND q.vehicle_media_id IS NOT NULL
      AND q.created_at BETWEEN v_start AND v_current.created_at
      AND q.vehicle_batch_claimed_at IS NOT NULL
  ) INTO v_already_claimed;

  IF NOT v_has_newer AND NOT v_already_claimed THEN
    UPDATE public.whatsapp_cloud_inbound_queue q
    SET vehicle_batch_claimed_at = now()
    WHERE q.phone_number_id = v_current.phone_number_id
      AND q.from_number = v_current.from_number
      AND q.message_type IN ('image', 'document')
      AND q.vehicle_media_id IS NOT NULL
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
    AND q.message_type IN ('image', 'document')
    AND q.created_at BETWEEN v_start AND v_current.created_at
    AND q.vehicle_media_id IS NOT NULL
  ORDER BY q.created_at, q.id;
END;
$$;

REVOKE ALL ON FUNCTION public.claim_whatsapp_vehicle_photo_batch(uuid)
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_whatsapp_vehicle_photo_batch(uuid)
  TO service_role;

COMMIT;
