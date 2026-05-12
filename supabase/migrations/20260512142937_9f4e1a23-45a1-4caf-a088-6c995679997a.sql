ALTER TABLE public.videos_agendados
  ADD COLUMN IF NOT EXISTS link_sticker text,
  ADD COLUMN IF NOT EXISTS metadata jsonb DEFAULT '{}'::jsonb;