-- RENAVE-1 — cofre de certificados e auditoria sem PII.
-- Sem policies: somente service_role pode acessar estas tabelas.

CREATE TABLE public.renave_certificados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL,
  cnpj text NOT NULL CHECK (cnpj ~ '^[0-9]{14}$'),
  selado text NOT NULL CHECK (length(selado) > 0),
  fingerprint text NOT NULL CHECK (fingerprint ~ '^[a-f0-9]{64}$'),
  valido_ate timestamptz NOT NULL,
  key_version text NOT NULL CHECK (length(key_version) BETWEEN 1 AND 100),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

CREATE UNIQUE INDEX renave_certificados_loja_ativo_uidx
  ON public.renave_certificados(loja_id)
  WHERE deleted_at IS NULL;
CREATE INDEX renave_certificados_validade_idx
  ON public.renave_certificados(valido_ate)
  WHERE deleted_at IS NULL;

CREATE TABLE public.renave_operacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  loja_id uuid NOT NULL,
  operacao text NOT NULL CHECK (operacao IN (
    'clienteAutenticado',
    'aptidaoVeiculo',
    'consultarVeiculos',
    'consultarEstoques',
    'consultarEstoquePorId',
    'solicitarEntradaEstoque',
    'solicitarSaidaEstoque',
    'pdfAtpv',
    'termoEntrada',
    'termoSaida',
    'crlve',
    'municipios',
    'mockVeiculoUsado',
    'mockTransferenciaDetran'
  )),
  ambiente text NOT NULL CHECK (ambiente IN ('hom', 'prod')),
  status_http integer NOT NULL CHECK (status_http BETWEEN 100 AND 599),
  request_id uuid NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX renave_operacoes_loja_created_idx
  ON public.renave_operacoes(loja_id, created_at DESC);
CREATE UNIQUE INDEX renave_operacoes_request_uidx
  ON public.renave_operacoes(request_id);

ALTER TABLE public.renave_certificados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.renave_operacoes ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.renave_certificados FROM anon, authenticated;
REVOKE ALL ON public.renave_operacoes FROM anon, authenticated;
GRANT ALL ON public.renave_certificados TO service_role;
GRANT ALL ON public.renave_operacoes TO service_role;

COMMENT ON TABLE public.renave_certificados IS
  'Certificados RENAVE selados por envelope; acesso exclusivo via service_role.';
COMMENT ON TABLE public.renave_operacoes IS
  'Auditoria RENAVE sem PII, placa, documento ou corpo de requisição.';
