-- Adicionar colunas de validação manual na tabela leads_b2c
ALTER TABLE leads_b2c 
  ADD COLUMN IF NOT EXISTS validado_manualmente BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS validado_em TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS validado_por UUID,
  ADD COLUMN IF NOT EXISTS motivo_invalidacao TEXT;

-- Adicionar colunas de validação manual na tabela leads_b2b
ALTER TABLE leads_b2b 
  ADD COLUMN IF NOT EXISTS validado_manualmente BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS validado_em TIMESTAMP WITH TIME ZONE,
  ADD COLUMN IF NOT EXISTS validado_por UUID,
  ADD COLUMN IF NOT EXISTS motivo_invalidacao TEXT;