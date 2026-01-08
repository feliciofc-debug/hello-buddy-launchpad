ALTER TABLE public.afiliado_campanhas
ADD COLUMN IF NOT EXISTS status text;

-- opcional: garantir default para novas campanhas
ALTER TABLE public.afiliado_campanhas
ALTER COLUMN status SET DEFAULT 'ativa';