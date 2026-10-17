-- G6: NF-e via Focus NFe (DDL only)

ALTER TABLE public.gestao_lancamentos_whatsapp
  DROP CONSTRAINT IF EXISTS gestao_lancamentos_whatsapp_tipo_check;

ALTER TABLE public.gestao_lancamentos_whatsapp
  ADD CONSTRAINT gestao_lancamentos_whatsapp_tipo_check
  CHECK (tipo IN ('despesa', 'compra', 'venda', 'desfazer', 'nfe_emit'));

ALTER TABLE public.veiculos_estoque
  ADD COLUMN IF NOT EXISTS chassi text NULL,
  ADD COLUMN IF NOT EXISTS renavam text NULL;

CREATE TABLE IF NOT EXISTS public.gestao_focusnfe_conta (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  token_enc text NOT NULL,
  ambiente text NOT NULL DEFAULT 'homolog'
    CHECK (ambiente IN ('homolog', 'producao')),
  status text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active', 'revoked')),
  last_test_ok_at timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gestao_nfe_config (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  cnpj text NOT NULL DEFAULT '',
  inscricao_estadual text NOT NULL DEFAULT '',
  regime_tributario text NOT NULL DEFAULT ''
    CHECK (regime_tributario IN ('', 'simples_nacional', 'lucro_presumido', 'lucro_real')),
  razao_social text NOT NULL DEFAULT '',
  nome_fantasia text NOT NULL DEFAULT '',
  logradouro text NOT NULL DEFAULT '',
  numero text NOT NULL DEFAULT '',
  complemento text NULL,
  bairro text NOT NULL DEFAULT '',
  municipio text NOT NULL DEFAULT '',
  uf char(2) NOT NULL DEFAULT '',
  cep text NOT NULL DEFAULT '',
  operacoes_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gestao_nfe (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid NULL REFERENCES public.veiculos_estoque(id) ON DELETE SET NULL,
  tipo_operacao text NOT NULL
    CHECK (tipo_operacao IN ('entrada_compra_pf', 'saida_venda', 'consignacao')),
  focus_ref text NOT NULL,
  status text NOT NULL DEFAULT 'rascunho'
    CHECK (status IN (
      'rascunho', 'processando', 'autorizada', 'rejeitada', 'cancelada', 'erro'
    )),
  valor_total numeric(14, 2) NULL,
  numero integer NULL,
  serie integer NULL,
  chave_acesso text NULL,
  danfe_url text NULL,
  xml_url text NULL,
  mensagem_status text NULL,
  cliente_nome text NULL,
  cliente_cpf_cnpj text NULL,
  cliente_endereco_resumo text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  authorized_at timestamptz NULL,
  UNIQUE (user_id, focus_ref)
);

CREATE INDEX IF NOT EXISTS idx_gestao_nfe_user_created
  ON public.gestao_nfe (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_gestao_nfe_user_status
  ON public.gestao_nfe (user_id, status, created_at DESC);

ALTER TABLE public.gestao_focusnfe_conta ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_nfe_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_nfe ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS gestao_nfe_config_own ON public.gestao_nfe_config;
CREATE POLICY gestao_nfe_config_own ON public.gestao_nfe_config
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS gestao_nfe_own ON public.gestao_nfe;
CREATE POLICY gestao_nfe_own ON public.gestao_nfe
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.gestao_focusnfe_conta FROM authenticated;
REVOKE ALL ON public.gestao_focusnfe_conta FROM anon;
GRANT ALL ON public.gestao_focusnfe_conta TO service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_nfe_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_nfe TO authenticated;
GRANT ALL ON public.gestao_nfe_config TO service_role;
GRANT ALL ON public.gestao_nfe TO service_role;

DROP TRIGGER IF EXISTS update_gestao_focusnfe_conta_updated_at ON public.gestao_focusnfe_conta;
CREATE TRIGGER update_gestao_focusnfe_conta_updated_at
  BEFORE UPDATE ON public.gestao_focusnfe_conta
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_gestao_nfe_config_updated_at ON public.gestao_nfe_config;
CREATE TRIGGER update_gestao_nfe_config_updated_at
  BEFORE UPDATE ON public.gestao_nfe_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_gestao_nfe_updated_at ON public.gestao_nfe;
CREATE TRIGGER update_gestao_nfe_updated_at
  BEFORE UPDATE ON public.gestao_nfe
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
