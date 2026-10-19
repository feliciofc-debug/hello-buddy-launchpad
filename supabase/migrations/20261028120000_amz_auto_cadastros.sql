-- AMZ Auto: cadastros comerciais (pré-liberação de conta)
CREATE TABLE IF NOT EXISTS public.amz_auto_cadastros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz NOT NULL DEFAULT now(),
  loja_nome text NOT NULL,
  cnpj text NOT NULL,
  responsavel text NOT NULL,
  whatsapp_e164 text NOT NULL,
  email text NOT NULL,
  cidade_uf text NOT NULL,
  tipo_operacao text NOT NULL CHECK (
    tipo_operacao IN ('revenda', 'concessionaria', 'grupo', 'motos')
  ),
  qtd_lojas text NOT NULL,
  faixa_estoque text NOT NULL,
  interesse text NOT NULL,
  aceite_termos_at timestamptz NOT NULL,
  status text NOT NULL DEFAULT 'em_analise' CHECK (
    status IN (
      'em_analise',
      'em_contato',
      'aguardando_pagamento',
      'liberado',
      'recusado'
    )
  ),
  plano_interno text CHECK (plano_interno IN ('atende', 'vende', 'gestao')),
  observacao_admin text,
  user_id uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  liberado_at timestamptz,
  liberado_por uuid REFERENCES auth.users (id) ON DELETE SET NULL,
  updated_at timestamptz NOT NULL DEFAULT now(),
  client_ip text
);

CREATE UNIQUE INDEX IF NOT EXISTS amz_auto_cadastros_cnpj_key
  ON public.amz_auto_cadastros (cnpj);

CREATE INDEX IF NOT EXISTS amz_auto_cadastros_status_created_idx
  ON public.amz_auto_cadastros (status, created_at DESC);

CREATE INDEX IF NOT EXISTS amz_auto_cadastros_client_ip_created_idx
  ON public.amz_auto_cadastros (client_ip, created_at DESC)
  WHERE client_ip IS NOT NULL;

ALTER TABLE public.amz_auto_cadastros ENABLE ROW LEVEL SECURITY;

CREATE POLICY amz_auto_cadastros_admin_select
  ON public.amz_auto_cadastros
  FOR SELECT
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role));

CREATE POLICY amz_auto_cadastros_admin_update
  ON public.amz_auto_cadastros
  FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (public.has_role(auth.uid(), 'admin'::public.app_role));

-- Rollback:
-- DROP POLICY IF EXISTS amz_auto_cadastros_admin_update ON public.amz_auto_cadastros;
-- DROP POLICY IF EXISTS amz_auto_cadastros_admin_select ON public.amz_auto_cadastros;
-- DROP TABLE IF EXISTS public.amz_auto_cadastros;
