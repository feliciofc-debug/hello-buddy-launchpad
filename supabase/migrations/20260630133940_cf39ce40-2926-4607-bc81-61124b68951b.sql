
-- ============================================================
-- FACEBOOK ADS — FASE 1 (READ-ONLY)
-- Tabelas isoladas. Não toca em meta_connections nem integrations.
-- ============================================================

-- 1) CONNECTIONS TABLE
CREATE TABLE public.facebook_ads_connections (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  fb_user_id TEXT NOT NULL,
  fb_user_name TEXT,
  access_token TEXT NOT NULL,
  token_type TEXT NOT NULL DEFAULT 'long_lived',
  expires_at TIMESTAMPTZ,
  ad_accounts JSONB NOT NULL DEFAULT '[]'::jsonb,
  selected_account_id TEXT,
  scopes TEXT[] NOT NULL DEFAULT ARRAY['ads_read','ads_management','business_management']::text[],
  status TEXT NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','revoked','error')),
  last_refreshed_at TIMESTAMPTZ,
  last_error TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, fb_user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.facebook_ads_connections TO authenticated;
GRANT ALL ON public.facebook_ads_connections TO service_role;

ALTER TABLE public.facebook_ads_connections ENABLE ROW LEVEL SECURITY;

-- RLS: usuário NUNCA lê a tabela completa via PostgREST (vai usar a VIEW _safe).
-- Bloqueamos SELECT direto no authenticated; INSERT/UPDATE/DELETE permitidos pra próprio user_id.
CREATE POLICY "fb_ads_conn_no_select_direct"
  ON public.facebook_ads_connections
  FOR SELECT
  TO authenticated
  USING (false);

CREATE POLICY "fb_ads_conn_insert_own"
  ON public.facebook_ads_connections
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fb_ads_conn_update_own"
  ON public.facebook_ads_connections
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fb_ads_conn_delete_own"
  ON public.facebook_ads_connections
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- 2) VIEW SEGURA (sem token) — é o que o frontend lê
CREATE OR REPLACE VIEW public.facebook_ads_connections_safe
WITH (security_invoker = true) AS
SELECT
  id,
  user_id,
  fb_user_id,
  fb_user_name,
  token_type,
  expires_at,
  ad_accounts,
  selected_account_id,
  scopes,
  status,
  last_refreshed_at,
  last_error,
  created_at,
  updated_at
FROM public.facebook_ads_connections
WHERE auth.uid() = user_id;

GRANT SELECT ON public.facebook_ads_connections_safe TO authenticated;


-- 3) INSIGHTS CACHE
CREATE TABLE public.facebook_ads_insights_cache (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  ad_account_id TEXT NOT NULL,
  level TEXT NOT NULL CHECK (level IN ('account','campaign','adset','ad')),
  object_id TEXT NOT NULL,
  date_preset TEXT NOT NULL,
  date_start DATE,
  date_stop DATE,
  metrics JSONB NOT NULL DEFAULT '{}'::jsonb,
  fetched_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (now() + interval '15 minutes'),
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, ad_account_id, level, object_id, date_preset)
);

CREATE INDEX idx_fb_insights_user_account ON public.facebook_ads_insights_cache (user_id, ad_account_id);
CREATE INDEX idx_fb_insights_expires ON public.facebook_ads_insights_cache (expires_at);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.facebook_ads_insights_cache TO authenticated;
GRANT ALL ON public.facebook_ads_insights_cache TO service_role;

ALTER TABLE public.facebook_ads_insights_cache ENABLE ROW LEVEL SECURITY;

CREATE POLICY "fb_insights_select_own"
  ON public.facebook_ads_insights_cache
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "fb_insights_insert_own"
  ON public.facebook_ads_insights_cache
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fb_insights_update_own"
  ON public.facebook_ads_insights_cache
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "fb_insights_delete_own"
  ON public.facebook_ads_insights_cache
  FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);


-- 4) Trigger updated_at em connections
CREATE TRIGGER trg_fb_ads_conn_updated_at
  BEFORE UPDATE ON public.facebook_ads_connections
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();
