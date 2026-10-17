-- ML-1: OAuth Mercado Livre (tokens só service_role; front via ml-status)

CREATE TABLE IF NOT EXISTS public.ml_oauth_states (
  state text PRIMARY KEY,
  user_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.ml_oauth_states ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ml_oauth_states TO service_role;

CREATE TABLE IF NOT EXISTS public.ml_contas (
  user_id uuid PRIMARY KEY,
  ml_user_id bigint NOT NULL,
  nickname text NULL,
  access_token_enc text NOT NULL,
  refresh_token_enc text NOT NULL,
  expires_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'needs_reauth', 'revoked')),
  refresh_lock_until timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_ml_contas_ml_user_id ON public.ml_contas (ml_user_id);

ALTER TABLE public.ml_contas ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.ml_contas TO service_role;

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS ml_location_json jsonb NULL;

COMMENT ON COLUMN public.empresa_config.ml_location_json IS
  'Localização padrão para anúncios ML (city/state ids); preenchida no OAuth ou editável depois.';
