ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS limite_mensal_anuncios numeric(12,2) NOT NULL DEFAULT 200;

CREATE TABLE IF NOT EXISTS public.meta_ads_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rascunho jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN (
      'rascunho', 'publicando', 'publicado', 'pausado', 'erro', 'expirado'
    )),
  campaign_id text,
  adset_id text,
  creative_id text,
  ad_id text,
  orcamento_diario numeric(12,2) NOT NULL DEFAULT 0,
  duracao_dias integer NOT NULL DEFAULT 1 CHECK (duracao_dias BETWEEN 1 AND 365),
  gasto_maximo numeric(12,2) NOT NULL DEFAULT 0,
  aprovado_em timestamptz,
  criado_em timestamptz NOT NULL DEFAULT now(),
  atualizado_em timestamptz NOT NULL DEFAULT now(),
  erro text
);

CREATE INDEX IF NOT EXISTS idx_meta_ads_campanhas_user_status
  ON public.meta_ads_campanhas (user_id, status, criado_em DESC);

ALTER TABLE public.meta_ads_campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta_ads_campanhas_owner_select"
  ON public.meta_ads_campanhas FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "meta_ads_campanhas_owner_insert"
  ON public.meta_ads_campanhas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meta_ads_campanhas_owner_update"
  ON public.meta_ads_campanhas FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "meta_ads_campanhas_owner_delete"
  ON public.meta_ads_campanhas FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "meta_ads_campanhas_service_role_all"
  ON public.meta_ads_campanhas FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.reserve_meta_ads_publish(
  p_user_id uuid,
  p_campaign_id uuid,
  p_committed_without_inflight numeric,
  p_observed_campaign_ids uuid[]
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = ''
AS $$
DECLARE
  v_cap numeric;
  v_requested numeric;
  v_unobserved_reserved numeric;
  v_reserved public.meta_ads_campanhas%ROWTYPE;
BEGIN
  -- This row is unique per user/platform and serializes all reservations for
  -- one Meta Ads account.
  SELECT i.limite_mensal_anuncios
    INTO v_cap
    FROM public.integrations AS i
   WHERE i.user_id = p_user_id
     AND i.platform = 'meta_ads'
     AND i.is_active = true
   FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'integration_not_found');
  END IF;

  SELECT c.gasto_maximo
    INTO v_requested
    FROM public.meta_ads_campanhas AS c
   WHERE c.id = p_campaign_id
     AND c.user_id = p_user_id
     AND c.status = 'rascunho'
     AND c.aprovado_em IS NULL;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'draft_not_eligible');
  END IF;

  SELECT COALESCE(sum(c.gasto_maximo), 0)
    INTO v_unobserved_reserved
    FROM public.meta_ads_campanhas AS c
   WHERE c.user_id = p_user_id
     AND (
       c.status = 'publicando'
       OR (
         c.status IN ('publicado', 'pausado')
         AND NOT (c.id = ANY(COALESCE(p_observed_campaign_ids, ARRAY[]::uuid[])))
       )
     );

  IF GREATEST(COALESCE(p_committed_without_inflight, 0), 0)
       + v_unobserved_reserved + GREATEST(v_requested, 0) > v_cap THEN
    RETURN jsonb_build_object(
      'ok', false,
      'reason', 'monthly_cap_exceeded',
      'cap', v_cap,
      'committed', GREATEST(COALESCE(p_committed_without_inflight, 0), 0),
      'unobserved_reserved', v_unobserved_reserved,
      'requested', v_requested
    );
  END IF;

  UPDATE public.meta_ads_campanhas
     SET status = 'publicando',
         aprovado_em = now(),
         atualizado_em = now(),
         erro = NULL
   WHERE id = p_campaign_id
     AND user_id = p_user_id
     AND status = 'rascunho'
     AND aprovado_em IS NULL
  RETURNING * INTO v_reserved;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('ok', false, 'reason', 'draft_not_eligible');
  END IF;

  RETURN jsonb_build_object(
    'ok', true,
    'id', v_reserved.id,
    'cap', v_cap,
    'committed', GREATEST(COALESCE(p_committed_without_inflight, 0), 0),
    'unobserved_reserved', v_unobserved_reserved,
    'requested', v_requested
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reserve_meta_ads_publish(uuid, uuid, numeric, uuid[])
  FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.reserve_meta_ads_publish(uuid, uuid, numeric, uuid[])
  TO service_role;
