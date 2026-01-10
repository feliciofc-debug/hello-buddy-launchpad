-- Adicionar campo usar_ia_criativa na tabela programacao_envio_afiliado
ALTER TABLE public.programacao_envio_afiliado 
ADD COLUMN IF NOT EXISTS usar_ia_criativa BOOLEAN DEFAULT true;