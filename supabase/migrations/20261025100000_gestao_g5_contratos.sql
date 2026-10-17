-- G5: contratos ZapSign (DDL only)

CREATE TABLE IF NOT EXISTS public.gestao_zapsign_conta (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  api_token_enc text NOT NULL,
  ambiente text NOT NULL DEFAULT 'sandbox'
    CHECK (ambiente IN ('sandbox', 'producao')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  webhook_secret text NOT NULL,
  usar_conta_amz boolean NOT NULL DEFAULT false,
  last_test_ok_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gestao_contrato_modelo (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL
    CHECK (tipo IN ('compra', 'venda', 'consignacao', 'garantia')),
  titulo text NOT NULL,
  corpo text NOT NULL,
  is_exemplo boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  UNIQUE (user_id, tipo, titulo)
);

CREATE TABLE IF NOT EXISTS public.gestao_contrato (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid NULL REFERENCES public.veiculos_estoque(id) ON DELETE SET NULL,
  modelo_id uuid NULL REFERENCES public.gestao_contrato_modelo(id) ON DELETE SET NULL,
  tipo text NOT NULL
    CHECK (tipo IN ('compra', 'venda', 'consignacao', 'garantia')),
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN ('rascunho', 'pendente_assinatura', 'assinado', 'cancelado', 'recusado')),
  titulo text NOT NULL DEFAULT '',
  corpo_renderizado text NOT NULL DEFAULT '',
  cliente_nome text NOT NULL DEFAULT '',
  cliente_cpf text NULL,
  cliente_endereco text NULL,
  cliente_email text NULL,
  cliente_telefone text NULL,
  zapsign_doc_token text NULL,
  zapsign_sign_url text NULL,
  zapsign_status text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gestao_contrato_user_status
  ON public.gestao_contrato (user_id, status, created_at DESC);

ALTER TABLE public.gestao_zapsign_conta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_contrato_modelo ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_contrato ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gestao_zapsign_conta_own ON public.gestao_zapsign_conta;
CREATE POLICY gestao_zapsign_conta_own ON public.gestao_zapsign_conta
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS gestao_contrato_modelo_own ON public.gestao_contrato_modelo;
CREATE POLICY gestao_contrato_modelo_own ON public.gestao_contrato_modelo
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS gestao_contrato_own ON public.gestao_contrato;
CREATE POLICY gestao_contrato_own ON public.gestao_contrato
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_zapsign_conta TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_contrato_modelo TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_contrato TO authenticated;
GRANT ALL ON public.gestao_zapsign_conta TO service_role;
GRANT ALL ON public.gestao_contrato_modelo TO service_role;
GRANT ALL ON public.gestao_contrato TO service_role;

DROP TRIGGER IF EXISTS update_gestao_zapsign_conta_updated_at ON public.gestao_zapsign_conta;
CREATE TRIGGER update_gestao_zapsign_conta_updated_at
  BEFORE UPDATE ON public.gestao_zapsign_conta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_gestao_contrato_modelo_updated_at ON public.gestao_contrato_modelo;
CREATE TRIGGER update_gestao_contrato_modelo_updated_at
  BEFORE UPDATE ON public.gestao_contrato_modelo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_gestao_contrato_updated_at ON public.gestao_contrato;
CREATE TRIGGER update_gestao_contrato_updated_at
  BEFORE UPDATE ON public.gestao_contrato
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
