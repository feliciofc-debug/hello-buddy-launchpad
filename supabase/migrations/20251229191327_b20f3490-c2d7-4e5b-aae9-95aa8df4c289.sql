-- Adicionar coluna listas_ids à tabela afiliado_campanhas
ALTER TABLE public.afiliado_campanhas 
ADD COLUMN IF NOT EXISTS listas_ids text[] DEFAULT '{}';