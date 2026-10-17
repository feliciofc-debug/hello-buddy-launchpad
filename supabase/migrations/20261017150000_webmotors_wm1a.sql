-- WM-1a: integração Webmotors (estoque carros — credenciais, mapa, cache, portais)

CREATE TABLE IF NOT EXISTS public.webmotors_contas (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cnpj text NOT NULL,
  integration_email text NOT NULL,
  password_enc text NOT NULL,
  ambiente text NOT NULL DEFAULT 'homolog'
    CHECK (ambiente IN ('homolog', 'producao')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'invalid_credentials', 'disconnected')),
  default_codigo_modalidade numeric NULL,
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.webmotors_contas ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.webmotors_contas TO service_role;

CREATE TABLE IF NOT EXISTS public.webmotors_veiculo_map (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos_estoque(id) ON DELETE CASCADE,
  codigo_marca numeric NULL,
  codigo_modelo numeric NULL,
  codigo_versao numeric NULL,
  codigo_cor numeric NULL,
  codigo_combustivel numeric NULL,
  codigo_cambio numeric NULL,
  codigo_modalidade numeric NULL,
  nr_portas integer NULL,
  opcionais numeric[] NOT NULL DEFAULT '{}',
  mapping_source text NOT NULL DEFAULT 'auto'
    CHECK (mapping_source IN ('auto', 'manual')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, veiculo_id)
);

ALTER TABLE public.webmotors_veiculo_map ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webmotors_veiculo_map_select_own ON public.webmotors_veiculo_map;
CREATE POLICY webmotors_veiculo_map_select_own ON public.webmotors_veiculo_map
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS webmotors_veiculo_map_insert_own ON public.webmotors_veiculo_map;
CREATE POLICY webmotors_veiculo_map_insert_own ON public.webmotors_veiculo_map
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS webmotors_veiculo_map_update_own ON public.webmotors_veiculo_map;
CREATE POLICY webmotors_veiculo_map_update_own ON public.webmotors_veiculo_map
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS webmotors_veiculo_map_delete_own ON public.webmotors_veiculo_map;
CREATE POLICY webmotors_veiculo_map_delete_own ON public.webmotors_veiculo_map
  FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webmotors_veiculo_map TO authenticated;
GRANT ALL ON public.webmotors_veiculo_map TO service_role;

CREATE TABLE IF NOT EXISTS public.webmotors_catalog_cache (
  ambiente text NOT NULL CHECK (ambiente IN ('homolog', 'producao')),
  cache_key text NOT NULL,
  payload jsonb NOT NULL,
  fetched_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (ambiente, cache_key)
);

ALTER TABLE public.webmotors_catalog_cache ENABLE ROW LEVEL SECURITY;

GRANT ALL ON public.webmotors_catalog_cache TO service_role;

CREATE TABLE IF NOT EXISTS public.webmotors_foto_vinculo (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos_estoque(id) ON DELETE CASCADE,
  url_amz text NOT NULL,
  codigo_foto_wm numeric NOT NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, veiculo_id, url_amz)
);

ALTER TABLE public.webmotors_foto_vinculo ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS webmotors_foto_vinculo_select_own ON public.webmotors_foto_vinculo;
CREATE POLICY webmotors_foto_vinculo_select_own ON public.webmotors_foto_vinculo
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS webmotors_foto_vinculo_all_own ON public.webmotors_foto_vinculo;
CREATE POLICY webmotors_foto_vinculo_all_own ON public.webmotors_foto_vinculo
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.webmotors_foto_vinculo TO authenticated;
GRANT ALL ON public.webmotors_foto_vinculo TO service_role;

ALTER TABLE public.veiculos_portais DROP CONSTRAINT IF EXISTS veiculos_portais_portal_check;
ALTER TABLE public.veiculos_portais ADD CONSTRAINT veiculos_portais_portal_check
  CHECK (portal IN ('mercadolivre', 'webmotors'));
