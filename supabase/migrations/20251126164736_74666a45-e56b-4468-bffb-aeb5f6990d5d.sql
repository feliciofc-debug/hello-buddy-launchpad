-- Adicionar campos de controle em campanhas_recorrentes
ALTER TABLE campanhas_recorrentes 
ADD COLUMN IF NOT EXISTS ultima_execucao TIMESTAMP WITH TIME ZONE,
ADD COLUMN IF NOT EXISTS total_enviados INTEGER DEFAULT 0,
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'ativa';

-- Criar índice para otimizar consultas
CREATE INDEX IF NOT EXISTS idx_campanhas_recorrentes_proxima_execucao 
ON campanhas_recorrentes(proxima_execucao) 
WHERE ativa = true;