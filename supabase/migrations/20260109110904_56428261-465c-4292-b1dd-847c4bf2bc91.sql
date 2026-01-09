-- Adicionar coluna status na tabela afiliado_campanhas
ALTER TABLE public.afiliado_campanhas 
ADD COLUMN IF NOT EXISTS status text DEFAULT 'ativa';

-- Criar índice para melhorar performance das queries
CREATE INDEX IF NOT EXISTS idx_afiliado_campanhas_status 
ON public.afiliado_campanhas(status);

-- Atualizar registros existentes
UPDATE public.afiliado_campanhas 
SET status = 'ativa' 
WHERE status IS NULL AND ativa = true;

UPDATE public.afiliado_campanhas 
SET status = 'pausada' 
WHERE status IS NULL AND ativa = false;