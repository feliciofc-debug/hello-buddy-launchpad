-- RENAVE-3 — amplia a whitelist de auditoria sem alterar a migração base.

ALTER TABLE public.renave_operacoes
  DROP CONSTRAINT IF EXISTS renave_operacoes_operacao_check;

ALTER TABLE public.renave_operacoes
  ADD CONSTRAINT renave_operacoes_operacao_check CHECK (operacao IN (
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
  ));
