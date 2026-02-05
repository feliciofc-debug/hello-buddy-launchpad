-- Adicionar coluna de validade ao profiles
ALTER TABLE public.profiles 
ADD COLUMN IF NOT EXISTS validade_acesso TIMESTAMP WITH TIME ZONE;

-- Atualizar Peixoto com validade de 10 dias
UPDATE public.profiles 
SET validade_acesso = NOW() + INTERVAL '10 days'
WHERE id = 'f7810c7b-b623-42e7-a7cf-ea9cd7e362b1';