-- G2: vendedores, comissões, metas e bônus (DDL only — sem storage)

CREATE TABLE IF NOT EXISTS public.gestao_vendedores (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  whatsapp_e164 text NULL,
  ativo boolean NOT NULL DEFAULT true,
  is_gerente boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gestao_vendedores_user_ativo
  ON public.gestao_vendedores (user_id, ativo);

CREATE TABLE IF NOT EXISTS public.gestao_comissao_regra (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendedor_id uuid NULL REFERENCES public.gestao_vendedores(id) ON DELETE CASCADE,
  regra_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gestao_comissao_regra_user_default
  ON public.gestao_comissao_regra (user_id) WHERE vendedor_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gestao_comissao_regra_user_vendedor
  ON public.gestao_comissao_regra (user_id, vendedor_id) WHERE vendedor_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gestao_meta_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competencia text NOT NULL CHECK (competencia ~ '^\d{4}-\d{2}$'),
  vendedor_id uuid NULL REFERENCES public.gestao_vendedores(id) ON DELETE CASCADE,
  config_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gestao_meta_mensal_loja
  ON public.gestao_meta_mensal (user_id, competencia) WHERE vendedor_id IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gestao_meta_mensal_vendedor
  ON public.gestao_meta_mensal (user_id, competencia, vendedor_id) WHERE vendedor_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gestao_bonus_mensal (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  competencia text NOT NULL CHECK (competencia ~ '^\d{4}-\d{2}$'),
  vendedor_id uuid NULL REFERENCES public.gestao_vendedores(id) ON DELETE SET NULL,
  valor numeric(14, 2) NOT NULL,
  motivo text NOT NULL,
  detalhe_json jsonb NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gestao_bonus_mensal_user_comp
  ON public.gestao_bonus_mensal (user_id, competencia);

CREATE TABLE IF NOT EXISTS public.gestao_comissao_extrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  vendedor_id uuid NOT NULL REFERENCES public.gestao_vendedores(id) ON DELETE CASCADE,
  competencia text NOT NULL CHECK (competencia ~ '^\d{4}-\d{2}$'),
  valor_comissao numeric(14, 2) NOT NULL DEFAULT 0,
  valor_pago numeric(14, 2) NOT NULL DEFAULT 0,
  pago_em date NULL,
  observacao text NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, vendedor_id, competencia)
);

CREATE TABLE IF NOT EXISTS public.gestao_comissao_auto (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos_estoque(id) ON DELETE CASCADE,
  vendedor_id uuid NOT NULL REFERENCES public.gestao_vendedores(id) ON DELETE CASCADE,
  despesa_id uuid NOT NULL REFERENCES public.veiculo_despesas(id) ON DELETE CASCADE,
  papel text NOT NULL CHECK (papel IN ('vendedor', 'gerente')),
  valor numeric(14, 2) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (despesa_id)
);

CREATE INDEX IF NOT EXISTS idx_gestao_comissao_auto_veiculo
  ON public.gestao_comissao_auto (user_id, veiculo_id);

ALTER TABLE public.veiculo_venda
  ADD COLUMN IF NOT EXISTS vendedor_id uuid NULL
  REFERENCES public.gestao_vendedores(id) ON DELETE SET NULL;

ALTER TABLE public.veiculo_despesas
  DROP CONSTRAINT IF EXISTS veiculo_despesas_origem_lancamento_check;

ALTER TABLE public.veiculo_despesas
  ADD CONSTRAINT veiculo_despesas_origem_lancamento_check
  CHECK (origem_lancamento IN (
    'painel', 'whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto', 'automatica'
  ));

ALTER TABLE public.gestao_vendedores ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_comissao_regra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_meta_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_bonus_mensal ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_comissao_extrato ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_comissao_auto ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gestao_vendedores_own ON public.gestao_vendedores;
CREATE POLICY gestao_vendedores_own ON public.gestao_vendedores
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS gestao_comissao_regra_own ON public.gestao_comissao_regra;
CREATE POLICY gestao_comissao_regra_own ON public.gestao_comissao_regra
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS gestao_meta_mensal_own ON public.gestao_meta_mensal;
CREATE POLICY gestao_meta_mensal_own ON public.gestao_meta_mensal
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS gestao_bonus_mensal_own ON public.gestao_bonus_mensal;
CREATE POLICY gestao_bonus_mensal_own ON public.gestao_bonus_mensal
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS gestao_comissao_extrato_own ON public.gestao_comissao_extrato;
CREATE POLICY gestao_comissao_extrato_own ON public.gestao_comissao_extrato
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS gestao_comissao_auto_own ON public.gestao_comissao_auto;
CREATE POLICY gestao_comissao_auto_own ON public.gestao_comissao_auto
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_vendedores TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_comissao_regra TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_meta_mensal TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_bonus_mensal TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_comissao_extrato TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_comissao_auto TO authenticated;

GRANT ALL ON public.gestao_vendedores TO service_role;
GRANT ALL ON public.gestao_comissao_regra TO service_role;
GRANT ALL ON public.gestao_meta_mensal TO service_role;
GRANT ALL ON public.gestao_bonus_mensal TO service_role;
GRANT ALL ON public.gestao_comissao_extrato TO service_role;
GRANT ALL ON public.gestao_comissao_auto TO service_role;

DROP TRIGGER IF EXISTS update_gestao_vendedores_updated_at ON public.gestao_vendedores;
CREATE TRIGGER update_gestao_vendedores_updated_at
  BEFORE UPDATE ON public.gestao_vendedores
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_gestao_comissao_regra_updated_at ON public.gestao_comissao_regra;
CREATE TRIGGER update_gestao_comissao_regra_updated_at
  BEFORE UPDATE ON public.gestao_comissao_regra
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_gestao_meta_mensal_updated_at ON public.gestao_meta_mensal;
CREATE TRIGGER update_gestao_meta_mensal_updated_at
  BEFORE UPDATE ON public.gestao_meta_mensal
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_gestao_comissao_extrato_updated_at ON public.gestao_comissao_extrato;
CREATE TRIGGER update_gestao_comissao_extrato_updated_at
  BEFORE UPDATE ON public.gestao_comissao_extrato
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
