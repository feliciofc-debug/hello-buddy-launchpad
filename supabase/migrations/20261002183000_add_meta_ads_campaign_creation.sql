ALTER TABLE public.integrations
  ADD COLUMN IF NOT EXISTS limite_mensal_anuncios numeric(12,2) NOT NULL DEFAULT 200;

CREATE TABLE IF NOT EXISTS public.meta_ads_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rascunho jsonb NOT NULL DEFAULT '{}'::jsonb,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'publicado', 'pausado', 'erro', 'expirado')),
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
