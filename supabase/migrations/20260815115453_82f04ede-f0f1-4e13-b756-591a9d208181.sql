ALTER TABLE public.videos_produtos
  ADD COLUMN IF NOT EXISTS transcricao_texto text,
  ADD COLUMN IF NOT EXISTS transcricao_segmentos jsonb,
  ADD COLUMN IF NOT EXISTS transcricao_em timestamptz;