-- Adicionar campo para nome do assistente virtual personalizado
ALTER TABLE public.clientes_afiliados 
ADD COLUMN IF NOT EXISTS nome_assistente TEXT DEFAULT 'Pietro Eugenio';

-- Adicionar campo para prompt personalizado (opcional futuro)
ALTER TABLE public.clientes_afiliados 
ADD COLUMN IF NOT EXISTS assistente_personalidade TEXT;

-- Comentário explicativo
COMMENT ON COLUMN public.clientes_afiliados.nome_assistente IS 'Nome personalizado do assistente virtual do afiliado';
COMMENT ON COLUMN public.clientes_afiliados.assistente_personalidade IS 'Personalidade/prompt personalizado do assistente (opcional)';