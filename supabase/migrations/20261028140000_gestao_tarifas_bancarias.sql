-- Categoria operacional tarifas_bancarias (conciliação / financeiro)

ALTER TABLE public.gestao_conta_lancamento
  DROP CONSTRAINT IF EXISTS gestao_conta_lancamento_categoria_operacional_check;

ALTER TABLE public.gestao_conta_lancamento
  ADD CONSTRAINT gestao_conta_lancamento_categoria_operacional_check
  CHECK (categoria_operacional IN (
    'aluguel', 'folha_salarios', 'pro_labore', 'energia', 'agua', 'internet_telefone',
    'marketing', 'sistemas', 'contador', 'impostos', 'manutencao_loja', 'bonus_vendedores',
    'tarifas_bancarias',
    'financiamento_receber', 'venda_prazo', 'outros_recebimento', 'outros'
  ));

ALTER TABLE public.gestao_conta_recorrencia_serie
  DROP CONSTRAINT IF EXISTS gestao_conta_recorrencia_serie_categoria_operacional_check;

ALTER TABLE public.gestao_conta_recorrencia_serie
  ADD CONSTRAINT gestao_conta_recorrencia_serie_categoria_operacional_check
  CHECK (categoria_operacional IN (
    'aluguel', 'folha_salarios', 'pro_labore', 'energia', 'agua', 'internet_telefone',
    'marketing', 'sistemas', 'contador', 'impostos', 'manutencao_loja', 'bonus_vendedores',
    'tarifas_bancarias',
    'financiamento_receber', 'venda_prazo', 'outros_recebimento', 'outros'
  ));

-- Rollback:
-- (recriar CHECK sem tarifas_bancarias e migrar linhas para 'outros')
