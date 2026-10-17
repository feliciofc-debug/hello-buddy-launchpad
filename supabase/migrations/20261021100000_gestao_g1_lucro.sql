-- G1: gestão lucro por veículo (compra, despesas, venda) + placa interna + bucket comprovantes

ALTER TABLE public.veiculos_estoque
  ADD COLUMN IF NOT EXISTS placa text NULL;

COMMENT ON COLUMN public.veiculos_estoque.placa IS
  'Placa do veículo (uso interno/gestão). Não expor em vitrine ou portais.';

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS gestao_gestores_json jsonb NOT NULL DEFAULT '[]'::jsonb;

COMMENT ON COLUMN public.empresa_config.gestao_gestores_json IS
  'Telefones E.164 autorizados a lançar gestão via WhatsApp (além do owner).';

CREATE TABLE IF NOT EXISTS public.veiculo_compra (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos_estoque(id) ON DELETE CASCADE,
  valor_compra numeric(14, 2) NOT NULL,
  data_compra date NOT NULL DEFAULT CURRENT_DATE,
  origem text NOT NULL DEFAULT 'compra'
    CHECK (origem IN ('compra', 'troca', 'consignacao')),
  fornecedor_obs text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, veiculo_id)
);

CREATE TABLE IF NOT EXISTS public.veiculo_despesas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos_estoque(id) ON DELETE CASCADE,
  data date NOT NULL DEFAULT CURRENT_DATE,
  categoria text NOT NULL
    CHECK (categoria IN (
      'mecanica', 'funilaria_pintura', 'pneus', 'estetica', 'documentacao',
      'transporte', 'anuncio', 'comissao', 'outros'
    )),
  valor numeric(14, 2) NOT NULL,
  descricao text NULL,
  comprovante_path text NULL,
  origem_lancamento text NOT NULL DEFAULT 'painel'
    CHECK (origem_lancamento IN (
      'painel', 'whatsapp_texto', 'whatsapp_audio', 'whatsapp_foto'
    )),
  lancado_por text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  deleted_by text NULL,
  corrigido_de_id uuid NULL REFERENCES public.veiculo_despesas(id) ON DELETE SET NULL
);

CREATE INDEX IF NOT EXISTS idx_veiculo_despesas_user_veiculo_data
  ON public.veiculo_despesas (user_id, veiculo_id, data DESC);

CREATE INDEX IF NOT EXISTS idx_veiculo_despesas_user_data
  ON public.veiculo_despesas (user_id, data DESC)
  WHERE deleted_at IS NULL;

CREATE TABLE IF NOT EXISTS public.veiculo_venda (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL REFERENCES public.veiculos_estoque(id) ON DELETE CASCADE,
  valor_venda numeric(14, 2) NOT NULL,
  data_venda date NOT NULL DEFAULT CURRENT_DATE,
  vendedor text NULL,
  forma_pagamento text NULL,
  marcou_vendido boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, veiculo_id)
);

CREATE TABLE IF NOT EXISTS public.gestao_lancamentos_whatsapp (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  telefone_mascarado text NOT NULL,
  tipo text NOT NULL
    CHECK (tipo IN ('despesa', 'compra', 'venda', 'desfazer')),
  referencia_id uuid NULL,
  referencia_tabela text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_gestao_lancamentos_whatsapp_user_created
  ON public.gestao_lancamentos_whatsapp (user_id, telefone_mascarado, created_at DESC);

ALTER TABLE public.veiculo_compra ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculo_despesas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.veiculo_venda ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_lancamentos_whatsapp ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS veiculo_compra_own ON public.veiculo_compra;
CREATE POLICY veiculo_compra_own ON public.veiculo_compra
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS veiculo_despesas_own ON public.veiculo_despesas;
CREATE POLICY veiculo_despesas_own ON public.veiculo_despesas
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS veiculo_venda_own ON public.veiculo_venda;
CREATE POLICY veiculo_venda_own ON public.veiculo_venda
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS gestao_lancamentos_whatsapp_own ON public.gestao_lancamentos_whatsapp;
CREATE POLICY gestao_lancamentos_whatsapp_own ON public.gestao_lancamentos_whatsapp
  FOR ALL TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculo_compra TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculo_despesas TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.veiculo_venda TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_lancamentos_whatsapp TO authenticated;

GRANT ALL ON public.veiculo_compra TO service_role;
GRANT ALL ON public.veiculo_despesas TO service_role;
GRANT ALL ON public.veiculo_venda TO service_role;
GRANT ALL ON public.gestao_lancamentos_whatsapp TO service_role;

DROP TRIGGER IF EXISTS update_veiculo_compra_updated_at ON public.veiculo_compra;
CREATE TRIGGER update_veiculo_compra_updated_at
  BEFORE UPDATE ON public.veiculo_compra
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_veiculo_despesas_updated_at ON public.veiculo_despesas;
CREATE TRIGGER update_veiculo_despesas_updated_at
  BEFORE UPDATE ON public.veiculo_despesas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_veiculo_venda_updated_at ON public.veiculo_venda;
CREATE TRIGGER update_veiculo_venda_updated_at
  BEFORE UPDATE ON public.veiculo_venda
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'gestao-comprovantes',
  'gestao-comprovantes',
  false,
  10485760,
  ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS gestao_comprovantes_insert_own ON storage.objects;
CREATE POLICY gestao_comprovantes_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'gestao-comprovantes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS gestao_comprovantes_select_own ON storage.objects;
CREATE POLICY gestao_comprovantes_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'gestao-comprovantes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS gestao_comprovantes_delete_own ON storage.objects;
CREATE POLICY gestao_comprovantes_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'gestao-comprovantes'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
