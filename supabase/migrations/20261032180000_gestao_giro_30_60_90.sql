-- G90-1: configuração e referências de preço do estoque inteligente 30-60-90

CREATE TABLE IF NOT EXISTS public.gestao_giro_config (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  faixa_atencao_dias integer NOT NULL DEFAULT 30 CHECK (faixa_atencao_dias > 0),
  faixa_risco_dias integer NOT NULL DEFAULT 60 CHECK (faixa_risco_dias > faixa_atencao_dias),
  faixa_decisao_dias integer NOT NULL DEFAULT 90 CHECK (faixa_decisao_dias > faixa_risco_dias),
  custo_financeiro_mensal_pct numeric(8, 4) NULL CHECK (custo_financeiro_mensal_pct >= 0),
  desvalorizacao_mensal_pct numeric(8, 4) NULL CHECK (desvalorizacao_mensal_pct >= 0),
  repasse_desconto_fipe_pct numeric(8, 4) NULL CHECK (
    repasse_desconto_fipe_pct >= 0 AND repasse_desconto_fipe_pct <= 100
  ),
  uf text NULL CHECK (uf IS NULL OR uf ~ '^[A-Z]{2}$'),
  ipva_aliquota_pct numeric(8, 4) NULL CHECK (
    ipva_aliquota_pct >= 0 AND ipva_aliquota_pct <= 100
  ),
  ipva_loja_paga_virada boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.veiculo_preco_referencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos_estoque(id) ON DELETE CASCADE,
  fonte text NOT NULL CHECK (
    fonte IN ('fipe', 'manual', 'molicar_b2c', 'molicar_b2b', 'molicar_c2b')
  ),
  valor numeric(14, 2) NOT NULL CHECK (valor > 0),
  referencia_mes text NULL,
  capturado_em timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_veiculo_preco_referencia_latest
  ON public.veiculo_preco_referencia (user_id, veiculo_id, fonte, capturado_em DESC);

ALTER TABLE public.gestao_giro_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculo_preco_referencia ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gestao_giro_config_own ON public.gestao_giro_config;
CREATE POLICY gestao_giro_config_own ON public.gestao_giro_config
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS veiculo_preco_referencia_own ON public.veiculo_preco_referencia;
CREATE POLICY veiculo_preco_referencia_own ON public.veiculo_preco_referencia
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_giro_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculo_preco_referencia TO authenticated;
GRANT ALL ON public.gestao_giro_config TO service_role;
GRANT ALL ON public.veiculo_preco_referencia TO service_role;

DROP TRIGGER IF EXISTS update_gestao_giro_config_updated_at ON public.gestao_giro_config;
CREATE TRIGGER update_gestao_giro_config_updated_at
  BEFORE UPDATE ON public.gestao_giro_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
