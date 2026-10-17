-- G3.1: recorrência real (série + lançamentos) e revogação link contador

CREATE TABLE IF NOT EXISTS public.gestao_conta_recorrencia_serie (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL CHECK (tipo IN ('pagar', 'receber')),
  categoria_operacional text NOT NULL CHECK (categoria_operacional IN (
    'aluguel', 'folha_salarios', 'pro_labore', 'energia', 'agua', 'internet_telefone',
    'marketing', 'sistemas', 'contador', 'impostos', 'manutencao_loja', 'bonus_vendedores',
    'financiamento_receber', 'venda_prazo', 'outros_recebimento', 'outros'
  )),
  valor numeric(14, 2) NOT NULL,
  dia_mes smallint NOT NULL CHECK (dia_mes >= 1 AND dia_mes <= 31),
  forma_pagamento text NULL,
  observacao text NULL,
  veiculo_id uuid NULL REFERENCES public.veiculos_estoque(id) ON DELETE SET NULL,
  /** Competência YYYY-MM a partir da qual não gera mais lançamentos. */
  encerrada_a_partir_de text NULL CHECK (encerrada_a_partir_de IS NULL OR encerrada_a_partir_de ~ '^\d{4}-\d{2}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.gestao_conta_lancamento
  ADD COLUMN IF NOT EXISTS serie_id uuid NULL
    REFERENCES public.gestao_conta_recorrencia_serie(id) ON DELETE CASCADE;

ALTER TABLE public.gestao_conta_lancamento
  ADD COLUMN IF NOT EXISTS competencia text NULL
    CHECK (competencia IS NULL OR competencia ~ '^\d{4}-\d{2}$');

CREATE UNIQUE INDEX IF NOT EXISTS idx_gestao_conta_serie_competencia
  ON public.gestao_conta_lancamento (user_id, serie_id, competencia)
  WHERE serie_id IS NOT NULL AND deleted_at IS NULL;

ALTER TABLE public.gestao_contador_token
  ADD COLUMN IF NOT EXISTS revogado_em timestamptz NULL;

ALTER TABLE public.gestao_conta_recorrencia_serie ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gestao_conta_recorrencia_serie_own ON public.gestao_conta_recorrencia_serie;
CREATE POLICY gestao_conta_recorrencia_serie_own ON public.gestao_conta_recorrencia_serie
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS gestao_conta_lancamento_own ON public.gestao_conta_lancamento;
CREATE POLICY gestao_conta_lancamento_own ON public.gestao_conta_lancamento
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS gestao_contador_token_own ON public.gestao_contador_token;
CREATE POLICY gestao_contador_token_own ON public.gestao_contador_token
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_conta_recorrencia_serie TO authenticated;
GRANT ALL ON public.gestao_conta_recorrencia_serie TO service_role;

DROP TRIGGER IF EXISTS update_gestao_conta_recorrencia_serie_updated_at ON public.gestao_conta_recorrencia_serie;
CREATE TRIGGER update_gestao_conta_recorrencia_serie_updated_at
  BEFORE UPDATE ON public.gestao_conta_recorrencia_serie
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
