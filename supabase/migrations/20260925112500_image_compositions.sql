ALTER TABLE public.whatsapp_cloud_agent_config
  ADD COLUMN IF NOT EXISTS image_composition_monthly_limit integer NOT NULL DEFAULT 150;

ALTER TABLE public.whatsapp_cloud_agent_config
  DROP CONSTRAINT IF EXISTS whatsapp_cloud_agent_config_image_composition_limit_check;
ALTER TABLE public.whatsapp_cloud_agent_config
  ADD CONSTRAINT whatsapp_cloud_agent_config_image_composition_limit_check
  CHECK (image_composition_monthly_limit >= 0);

CREATE TABLE IF NOT EXISTS public.image_compositions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  phone text NOT NULL,
  conversation_id uuid REFERENCES public.whatsapp_cloud_conversations(id) ON DELETE SET NULL,
  environment_midia_id uuid REFERENCES public.midias_whatsapp(id) ON DELETE SET NULL,
  product_midia_id uuid REFERENCES public.midias_whatsapp(id) ON DELETE SET NULL,
  product_id uuid REFERENCES public.produtos(id) ON DELETE SET NULL,
  result_midia_id uuid REFERENCES public.midias_whatsapp(id) ON DELETE SET NULL,
  model text NOT NULL,
  resolution text NOT NULL CHECK (resolution IN ('1K', '2K')),
  estimated_cost_usd numeric(10, 6) NOT NULL CHECK (estimated_cost_usd >= 0),
  status text NOT NULL DEFAULT 'processing'
    CHECK (status IN ('processing', 'completed', 'failed')),
  error_message text,
  created_at timestamptz NOT NULL DEFAULT now(),
  completed_at timestamptz
);

CREATE INDEX IF NOT EXISTS idx_image_compositions_tenant_created
  ON public.image_compositions (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_image_compositions_phone_created
  ON public.image_compositions (user_id, phone, created_at DESC);

ALTER TABLE public.image_compositions ENABLE ROW LEVEL SECURITY;
GRANT SELECT ON public.image_compositions TO authenticated;
GRANT ALL ON public.image_compositions TO service_role;

DROP POLICY IF EXISTS "Owners view their image compositions" ON public.image_compositions;
CREATE POLICY "Owners view their image compositions"
  ON public.image_compositions FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE OR REPLACE FUNCTION public.reserve_image_composition(
  p_user_id uuid,
  p_phone text,
  p_conversation_id uuid,
  p_environment_midia_id uuid,
  p_product_midia_id uuid,
  p_product_id uuid,
  p_model text,
  p_resolution text,
  p_estimated_cost_usd numeric
)
RETURNS TABLE (
  allowed boolean,
  composition_id uuid,
  denial_reason text,
  daily_used integer,
  monthly_used integer,
  monthly_limit integer
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_daily integer;
  v_monthly integer;
  v_limit integer;
  v_id uuid;
  v_local_now timestamp := timezone('America/Sao_Paulo', now());
BEGIN
  IF p_resolution NOT IN ('1K', '2K') THEN
    RAISE EXCEPTION 'invalid_resolution';
  END IF;

  PERFORM pg_advisory_xact_lock(hashtextextended(p_user_id::text || ':' || p_phone, 0));

  SELECT COALESCE(c.image_composition_monthly_limit, 150)
    INTO v_limit
    FROM public.whatsapp_cloud_agent_config c
   WHERE c.user_id = p_user_id;
  v_limit := COALESCE(v_limit, 150);

  SELECT count(*)::integer
    INTO v_daily
    FROM public.image_compositions c
   WHERE c.user_id = p_user_id
     AND c.phone = p_phone
     AND timezone('America/Sao_Paulo', c.created_at)::date = v_local_now::date;

  SELECT count(*)::integer
    INTO v_monthly
    FROM public.image_compositions c
   WHERE c.user_id = p_user_id
     AND date_trunc('month', timezone('America/Sao_Paulo', c.created_at)) =
         date_trunc('month', v_local_now);

  IF v_daily >= 3 THEN
    RETURN QUERY SELECT false, NULL::uuid, 'daily', v_daily, v_monthly, v_limit;
    RETURN;
  END IF;
  IF v_monthly >= v_limit THEN
    RETURN QUERY SELECT false, NULL::uuid, 'monthly', v_daily, v_monthly, v_limit;
    RETURN;
  END IF;

  INSERT INTO public.image_compositions (
    user_id, phone, conversation_id, environment_midia_id, product_midia_id,
    product_id, model, resolution, estimated_cost_usd
  ) VALUES (
    p_user_id, p_phone, p_conversation_id, p_environment_midia_id,
    p_product_midia_id, p_product_id, p_model, p_resolution,
    p_estimated_cost_usd
  )
  RETURNING id INTO v_id;

  RETURN QUERY SELECT true, v_id, NULL::text, v_daily + 1, v_monthly + 1, v_limit;
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_image_composition(
  uuid, text, uuid, uuid, uuid, uuid, text, text, numeric
) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reserve_image_composition(
  uuid, text, uuid, uuid, uuid, uuid, text, text, numeric
) TO service_role;

COMMENT ON COLUMN public.whatsapp_cloud_agent_config.image_composition_monthly_limit IS
  'Teto mensal de simulações produto+ambiente. Default 150; configurável por tenant.';
COMMENT ON TABLE public.image_compositions IS
  'Auditoria, quota e custo estimado de cada composição produto+ambiente.';
