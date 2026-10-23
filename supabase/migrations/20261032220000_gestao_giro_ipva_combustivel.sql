-- G90-2.2: IPVA por tipo de combustível e ajuste por veículo

ALTER TABLE public.gestao_giro_config
  ADD COLUMN IF NOT EXISTS ipva_aliquota_hibrido_pct numeric(8, 4) NULL CHECK (
    ipva_aliquota_hibrido_pct >= 0 AND ipva_aliquota_hibrido_pct <= 100
  ),
  ADD COLUMN IF NOT EXISTS ipva_aliquota_eletrico_pct numeric(8, 4) NULL CHECK (
    ipva_aliquota_eletrico_pct >= 0 AND ipva_aliquota_eletrico_pct <= 100
  );

COMMENT ON COLUMN public.gestao_giro_config.ipva_aliquota_hibrido_pct IS
  'Alíquota IPVA híbrido; NULL usa ipva_aliquota_pct.';
COMMENT ON COLUMN public.gestao_giro_config.ipva_aliquota_eletrico_pct IS
  'Alíquota IPVA elétrico; NULL usa ipva_aliquota_pct.';

CREATE TABLE IF NOT EXISTS public.veiculo_giro_ajuste (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos_estoque(id) ON DELETE CASCADE,
  ipva_tipo text NOT NULL DEFAULT 'auto' CHECK (
    ipva_tipo IN ('auto', 'geral', 'hibrido', 'eletrico', 'isento', 'manual')
  ),
  ipva_aliquota_manual_pct numeric(8, 4) NULL CHECK (
    ipva_aliquota_manual_pct >= 0 AND ipva_aliquota_manual_pct <= 100
  ),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, veiculo_id),
  CONSTRAINT veiculo_giro_ajuste_manual_pct CHECK (
    ipva_tipo <> 'manual' OR ipva_aliquota_manual_pct IS NOT NULL
  )
);

ALTER TABLE public.veiculo_giro_ajuste ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS veiculo_giro_ajuste_own ON public.veiculo_giro_ajuste;
CREATE POLICY veiculo_giro_ajuste_own ON public.veiculo_giro_ajuste
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculo_giro_ajuste TO authenticated;
GRANT ALL ON public.veiculo_giro_ajuste TO service_role;

DROP TRIGGER IF EXISTS update_veiculo_giro_ajuste_updated_at ON public.veiculo_giro_ajuste;
CREATE TRIGGER update_veiculo_giro_ajuste_updated_at
  BEFORE UPDATE ON public.veiculo_giro_ajuste
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
