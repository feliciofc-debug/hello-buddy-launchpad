-- ML-2: vínculo veículo ↔ portal externo

CREATE TABLE IF NOT EXISTS public.veiculos_portais (
  user_id uuid NOT NULL,
  veiculo_id uuid NOT NULL,
  portal text NOT NULL CHECK (portal IN ('mercadolivre')),
  external_id text NULL,
  status text NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft', 'published', 'paused', 'closed', 'error')),
  permalink text NULL,
  category_id text NULL,
  last_error text NULL,
  last_synced_at timestamptz NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, veiculo_id, portal)
);

CREATE INDEX IF NOT EXISTS idx_veiculos_portais_external
  ON public.veiculos_portais (portal, external_id)
  WHERE external_id IS NOT NULL;

ALTER TABLE public.veiculos_portais ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS veiculos_portais_select_own ON public.veiculos_portais;
CREATE POLICY veiculos_portais_select_own ON public.veiculos_portais
  FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS veiculos_portais_insert_own ON public.veiculos_portais;
CREATE POLICY veiculos_portais_insert_own ON public.veiculos_portais
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS veiculos_portais_update_own ON public.veiculos_portais;
CREATE POLICY veiculos_portais_update_own ON public.veiculos_portais
  FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE ON public.veiculos_portais TO authenticated;
GRANT ALL ON public.veiculos_portais TO service_role;
