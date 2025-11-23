-- Adicionar novos campos de refinamento na tabela icp_configs
ALTER TABLE icp_configs 
ADD COLUMN IF NOT EXISTS refinamento_geografico TEXT,
ADD COLUMN IF NOT EXISTS refinamento_comportamental TEXT;

-- Atualizar constraint de tipo para incluir 'ambos'
ALTER TABLE icp_configs 
DROP CONSTRAINT IF EXISTS icp_configs_tipo_check;

ALTER TABLE icp_configs 
ADD CONSTRAINT icp_configs_tipo_check CHECK (tipo IN ('b2b', 'b2c', 'ambos'));