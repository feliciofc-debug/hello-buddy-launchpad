-- Adicionar coluna invite_link na tabela pj_grupos_whatsapp
ALTER TABLE public.pj_grupos_whatsapp 
ADD COLUMN IF NOT EXISTS invite_link TEXT;