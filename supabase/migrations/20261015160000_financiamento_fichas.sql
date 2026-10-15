BEGIN;

CREATE TABLE IF NOT EXISTS public.financiamento_fichas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid REFERENCES public.veiculos_estoque(id) ON DELETE SET NULL,
  whatsapp_from text NOT NULL,
  whatsapp_contact_name text,
  cliente_nome_vitrine text,
  lgpd_aceite_em timestamptz NOT NULL,
  tipo_pessoa text NOT NULL
    CONSTRAINT financiamento_fichas_tipo_pessoa_check
    CHECK (tipo_pessoa IN ('pf', 'pj')),
  nome_completo text NOT NULL,
  cpf_cnpj text NOT NULL,
  data_nascimento date,
  email text NOT NULL,
  cep text NOT NULL,
  logradouro text NOT NULL,
  numero text NOT NULL,
  complemento text,
  bairro text NOT NULL,
  cidade text NOT NULL,
  uf text NOT NULL,
  renda_mensal numeric(14, 2) NOT NULL,
  telefone_referencia text NOT NULL,
  entrada numeric(14, 2),
  prazo_meses integer NOT NULL,
  status text NOT NULL DEFAULT 'pendente'
    CONSTRAINT financiamento_fichas_status_check
    CHECK (status IN ('pendente', 'em_analise', 'concluida', 'cancelada')),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_financiamento_fichas_user_created
  ON public.financiamento_fichas(user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_financiamento_fichas_veiculo
  ON public.financiamento_fichas(veiculo_id);

GRANT SELECT, INSERT, UPDATE, DELETE
  ON public.financiamento_fichas TO authenticated;
GRANT ALL ON public.financiamento_fichas TO service_role;

ALTER TABLE public.financiamento_fichas ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "financiamento_fichas_select_own"
  ON public.financiamento_fichas;
CREATE POLICY "financiamento_fichas_select_own"
  ON public.financiamento_fichas FOR SELECT TO authenticated
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "financiamento_fichas_insert_own"
  ON public.financiamento_fichas;
CREATE POLICY "financiamento_fichas_insert_own"
  ON public.financiamento_fichas FOR INSERT TO authenticated
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "financiamento_fichas_update_own"
  ON public.financiamento_fichas;
CREATE POLICY "financiamento_fichas_update_own"
  ON public.financiamento_fichas FOR UPDATE TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "financiamento_fichas_delete_own"
  ON public.financiamento_fichas;
CREATE POLICY "financiamento_fichas_delete_own"
  ON public.financiamento_fichas FOR DELETE TO authenticated
  USING (auth.uid() = user_id);

DROP TRIGGER IF EXISTS update_financiamento_fichas_updated_at
  ON public.financiamento_fichas;
CREATE TRIGGER update_financiamento_fichas_updated_at
  BEFORE UPDATE ON public.financiamento_fichas
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

COMMIT;
