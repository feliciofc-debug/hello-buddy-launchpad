-- JARVIS-OLX-1: OAuth OLX + listings (tokens só service_role; front via olx-status / edge)

CREATE TABLE IF NOT EXISTS public.olx_connection (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  access_token_enc text NOT NULL,
  olx_user_nome text NULL,
  olx_user_email_mascarado text NULL,
  scopes text NULL,
  connected_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.olx_oauth_state (
  state text PRIMARY KEY,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  expires_at timestamptz NOT NULL,
  used_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS olx_oauth_state_expires_idx
  ON public.olx_oauth_state (expires_at);

CREATE TABLE IF NOT EXISTS public.olx_vehicle_listing (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos_estoque(id) ON DELETE CASCADE,
  olx_ad_ref text NOT NULL,
  import_token text NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'publicado', 'erro', 'removido')),
  last_error text NULL,
  olx_url text NULL,
  published_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT olx_vehicle_listing_user_veiculo_key UNIQUE (user_id, veiculo_id)
);

CREATE INDEX IF NOT EXISTS olx_vehicle_listing_pendente_idx
  ON public.olx_vehicle_listing (status, updated_at)
  WHERE status = 'pendente';

ALTER TABLE public.olx_connection ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.olx_oauth_state ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.olx_vehicle_listing ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.olx_connection FROM anon;
REVOKE ALL ON public.olx_oauth_state FROM anon;
REVOKE ALL ON public.olx_vehicle_listing FROM anon;

REVOKE ALL ON public.olx_connection FROM authenticated;
REVOKE ALL ON public.olx_oauth_state FROM authenticated;

GRANT ALL ON public.olx_connection TO service_role;
GRANT ALL ON public.olx_oauth_state TO service_role;
GRANT ALL ON public.olx_vehicle_listing TO service_role;

DROP POLICY IF EXISTS olx_vehicle_listing_select ON public.olx_vehicle_listing;
CREATE POLICY olx_vehicle_listing_select ON public.olx_vehicle_listing
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

GRANT SELECT ON public.olx_vehicle_listing TO authenticated;

COMMENT ON TABLE public.olx_connection IS 'Conta OLX conectada por loja; access_token cifrado — somente service_role.';
COMMENT ON TABLE public.olx_oauth_state IS 'State OAuth OLX (anti-CSRF), TTL 10 min, uso único.';
COMMENT ON TABLE public.olx_vehicle_listing IS 'Publicação manual OLX por veículo (autoupload).';
