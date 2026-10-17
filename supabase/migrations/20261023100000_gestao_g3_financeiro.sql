-- G3: contas operacionais, fluxo, DRE e pacote contador (DDL only)

CREATE TABLE IF NOT EXISTS public.gestao_conta_lancamento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('pagar', 'receber')),
  categoria_operacional text NOT NULL CHECK (categoria_operacional IN (
    'aluguel', 'folha_salarios', 'pro_labore', 'energia', 'agua', 'internet_telefone',
    'marketing', 'sistemas', 'contador', 'impostos', 'manutencao_loja', 'bonus_vendedores',
    'financiamento_receber', 'venda_prazo', 'outros_recebimento', 'outros'
  )),
  valor numeric(14, 2) NOT NULL,
  vencimento date NOT NULL,
  pago_em date NULL,
  recebido_em date NULL,
  forma_pagamento text NULL,
  recorrencia_dia_mes smallint NULL CHECK (recorrencia_dia_mes IS NULL OR (recorrencia_dia_mes >= 1 AND recorrencia_dia_mes <= 31)),
  observacao text NULL,
  veiculo_id uuid NULL REFERENCES public.veiculos_estoque(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'manual'
    CHECK (origem IN ('manual', 'bonus_g2', 'recorrencia')),
  bonus_mensal_id uuid NULL REFERENCES public.gestao_bonus_mensal(id) ON DELETE CASCADE,
  comprovante_path text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE INDEX IF NOT EXISTS idx_gestao_conta_user_venc
  ON public.gestao_conta_lancamento (user_id, vencimento)
  WHERE deleted_at IS NULL;

CREATE INDEX IF NOT EXISTS idx_gestao_conta_user_tipo
  ON public.gestao_conta_lancamento (user_id, tipo)
  WHERE deleted_at IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_gestao_conta_bonus_unico
  ON public.gestao_conta_lancamento (user_id, bonus_mensal_id)
  WHERE bonus_mensal_id IS NOT NULL AND deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.gestao_contador_token (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  token_hash text NOT NULL,
  competencia text NOT NULL CHECK (competencia ~ '^\d{4}-\d{2}$'),
  expires_at timestamptz NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  last_access_at timestamptz NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gestao_contador_token_hash
  ON public.gestao_contador_token (token_hash);

CREATE INDEX IF NOT EXISTS idx_gestao_contador_token_user_comp
  ON public.gestao_contador_token (user_id, competencia DESC);

ALTER TABLE public.gestao_conta_lancamento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_contador_token ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gestao_conta_lancamento_own ON public.gestao_conta_lancamento;
CREATE POLICY gestao_conta_lancamento_own ON public.gestao_conta_lancamento
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS gestao_contador_token_own ON public.gestao_contador_token;
CREATE POLICY gestao_contador_token_own ON public.gestao_contador_token
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_conta_lancamento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_contador_token TO authenticated;
GRANT ALL ON public.gestao_conta_lancamento TO service_role;
GRANT ALL ON public.gestao_contador_token TO service_role;

DROP TRIGGER IF EXISTS update_gestao_conta_lancamento_updated_at ON public.gestao_conta_lancamento;
CREATE TRIGGER update_gestao_conta_lancamento_updated_at
  BEFORE UPDATE ON public.gestao_conta_lancamento
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
