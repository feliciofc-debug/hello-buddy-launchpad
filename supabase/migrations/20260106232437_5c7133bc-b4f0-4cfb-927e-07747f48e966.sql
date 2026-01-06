-- Adicionar coluna de categorias na tabela leads_ebooks
ALTER TABLE public.leads_ebooks ADD COLUMN IF NOT EXISTS categorias text[] DEFAULT NULL;

-- Atualizar Eduardo com as categorias que ele escolheu
UPDATE public.leads_ebooks 
SET categorias = ARRAY['casa', 'gamer']
WHERE phone = '5527997621832';