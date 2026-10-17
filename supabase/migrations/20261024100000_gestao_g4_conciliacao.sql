-- G4: conciliação bancária (DDL only)

CREATE TABLE IF NOT EXISTS public.gestao_conta_bancaria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  banco_nome text NOT NULL,
  apelido text NOT NULL,
  ultimos_4 text NOT NULL CHECK (ultimos_4 ~ '^\d{4}$'),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gestao_extrato_transacao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  conta_bancaria_id uuid NOT NULL REFERENCES public.gestao_conta_bancaria(id) ON DELETE CASCADE,
  data date NOT NULL,
  descricao text NOT NULL DEFAULT '',
  valor numeric(14, 2) NOT NULL CHECK (valor > 0),
  sentido text NOT NULL CHECK (sentido IN ('debito', 'credito')),
  dedupe_key text NOT NULL,
  fitid text NULL,
  status text NOT NULL DEFAULT 'pendente'
    CHECK (status IN ('pendente', 'confirmar', 'conciliado', 'ignorado')),
  match_tipo text NULL
    CHECK (match_tipo IS NULL OR match_tipo IN (
      'conta_pagar', 'conta_receber', 'veiculo_despesa', 'veiculo_venda', 'comissao_extrato'
    )),
  match_ref_id uuid NULL,
  match_score numeric(6, 2) NULL,
  conciliado_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_gestao_extrato_dedupe
  ON public.gestao_extrato_transacao (user_id, dedupe_key);

CREATE INDEX IF NOT EXISTS idx_gestao_extrato_conta_data
  ON public.gestao_extrato_transacao (user_id, conta_bancaria_id, data DESC);

ALTER TABLE public.gestao_conta_bancaria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_extrato_transacao ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gestao_conta_bancaria_own ON public.gestao_conta_bancaria;
CREATE POLICY gestao_conta_bancaria_own ON public.gestao_conta_bancaria
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS gestao_extrato_transacao_own ON public.gestao_extrato_transacao;
CREATE POLICY gestao_extrato_transacao_own ON public.gestao_extrato_transacao
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_conta_bancaria TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_extrato_transacao TO authenticated;
GRANT ALL ON public.gestao_conta_bancaria TO service_role;
GRANT ALL ON public.gestao_extrato_transacao TO service_role;

DROP TRIGGER IF EXISTS update_gestao_conta_bancaria_updated_at ON public.gestao_conta_bancaria;
CREATE TRIGGER update_gestao_conta_bancaria_updated_at
  BEFORE UPDATE ON public.gestao_conta_bancaria
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
