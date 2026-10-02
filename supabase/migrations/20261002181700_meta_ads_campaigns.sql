-- Meta Ads Phase 1/2. Deliberately isolated from legacy Facebook Ads tables.
ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS meta_ad_account_id text,
  ADD COLUMN IF NOT EXISTS meta_ad_account_name text,
  ADD COLUMN IF NOT EXISTS meta_ad_accounts jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS meta_ad_account_currency text,
  ADD COLUMN IF NOT EXISTS limite_mensal_anuncios numeric(12,2) NOT NULL DEFAULT 200.00;

ALTER TABLE public.integrations
  DROP CONSTRAINT IF EXISTS integrations_limite_mensal_anuncios_check;
ALTER TABLE public.integrations
  ADD CONSTRAINT integrations_limite_mensal_anuncios_check
  CHECK (limite_mensal_anuncios > 0);

CREATE TABLE IF NOT EXISTS public.meta_ads_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  integration_id uuid NOT NULL REFERENCES public.integrations(id) ON DELETE RESTRICT,
  nome text NOT NULL CHECK (char_length(nome) BETWEEN 3 AND 120),
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'aprovado', 'publicando', 'publicado', 'pausado', 'ativo', 'erro')),
  draft_json jsonb NOT NULL,
  orcamento_diario numeric(12,2) NOT NULL CHECK (orcamento_diario > 0),
  gasto_maximo numeric(12,2) NOT NULL CHECK (gasto_maximo >= orcamento_diario),
  campaign_id text,
  adset_id text,
  creative_id text,
  ad_id text,
  aprovado_em timestamptz,
  publicado_em timestamptz,
  erro_em timestamptz,
  ultimo_erro text,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (
    status <> 'publicado' OR
    (campaign_id IS NOT NULL AND adset_id IS NOT NULL AND creative_id IS NOT NULL AND ad_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS meta_ads_campanhas_user_created_idx
  ON public.meta_ads_campanhas (user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS meta_ads_campanhas_campaign_idx
  ON public.meta_ads_campanhas (campaign_id) WHERE campaign_id IS NOT NULL;

ALTER TABLE public.meta_ads_campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "meta ads campaigns owner select"
  ON public.meta_ads_campanhas FOR SELECT TO authenticated
  USING (auth.uid() = user_id);
CREATE POLICY "meta ads campaigns owner insert"
  ON public.meta_ads_campanhas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meta ads campaigns owner update"
  ON public.meta_ads_campanhas FOR UPDATE TO authenticated
  USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "meta ads campaigns owner delete drafts"
  ON public.meta_ads_campanhas FOR DELETE TO authenticated
  USING (auth.uid() = user_id AND status IN ('rascunho', 'erro'));
CREATE POLICY "meta ads campaigns service role"
  ON public.meta_ads_campanhas FOR ALL TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_meta_ads_campanhas_updated_at
  BEFORE UPDATE ON public.meta_ads_campanhas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Locks the one canonical integration row while checking and reserving monthly spend.
CREATE OR REPLACE FUNCTION public.meta_ads_reservar_publicacao(
  p_user_id uuid,
  p_campanha_id uuid
) RETURNS public.meta_ads_campanhas
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_integration public.integrations;
  v_campaign public.meta_ads_campanhas;
  v_committed numeric(12,2);
BEGIN
  SELECT * INTO v_integration
    FROM public.integrations
    WHERE user_id = p_user_id AND platform = 'meta_ads' AND is_active = true
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Meta Ads não conectado'; END IF;

  SELECT * INTO v_campaign
    FROM public.meta_ads_campanhas
    WHERE id = p_campanha_id AND user_id = p_user_id
    FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Campanha não encontrada'; END IF;
  IF v_campaign.status NOT IN ('rascunho', 'aprovado', 'erro') THEN
    RAISE EXCEPTION 'Campanha não pode ser publicada no estado atual';
  END IF;

  SELECT COALESCE(sum(gasto_maximo), 0) INTO v_committed
    FROM public.meta_ads_campanhas
    WHERE user_id = p_user_id
      AND id <> p_campanha_id
      -- The cap belongs to the month in which spend was approved, not the
      -- month in which an older draft happened to be created.
      AND aprovado_em >= date_trunc('month', now())
      AND status IN ('aprovado', 'publicando', 'publicado', 'pausado', 'ativo');
  IF v_committed + v_campaign.gasto_maximo > v_integration.limite_mensal_anuncios THEN
    RAISE EXCEPTION 'Limite mensal de anúncios excedido';
  END IF;

  UPDATE public.meta_ads_campanhas
    SET status = 'publicando', aprovado_em = COALESCE(aprovado_em, now()),
        erro_em = NULL, ultimo_erro = NULL
    WHERE id = p_campanha_id
    RETURNING * INTO v_campaign;
  RETURN v_campaign;
END;
$$;

REVOKE ALL ON FUNCTION public.meta_ads_reservar_publicacao(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.meta_ads_reservar_publicacao(uuid, uuid) TO service_role;
