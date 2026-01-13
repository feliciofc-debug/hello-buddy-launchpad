-- Adicionar coluna para rastrear contagem anterior de membros
ALTER TABLE public.whatsapp_grupos_afiliado 
ADD COLUMN IF NOT EXISTS previous_member_count integer DEFAULT 0;