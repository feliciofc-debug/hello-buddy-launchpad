-- Adicionar coluna para rastrear se grupo está em modo "só admins"
ALTER TABLE public.whatsapp_grupos_afiliado 
ADD COLUMN IF NOT EXISTS is_announce BOOLEAN DEFAULT false;