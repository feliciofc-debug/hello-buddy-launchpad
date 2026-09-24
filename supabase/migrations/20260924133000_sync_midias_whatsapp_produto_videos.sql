-- Mantém produto_videos como biblioteca canônica sem duplicar os arquivos.
ALTER TABLE public.produto_videos
  ADD COLUMN IF NOT EXISTS origem TEXT NOT NULL DEFAULT 'site',
  ADD COLUMN IF NOT EXISTS midia_whatsapp_id UUID
    REFERENCES public.midias_whatsapp(id) ON DELETE SET NULL;

CREATE UNIQUE INDEX IF NOT EXISTS produto_videos_midia_whatsapp_uidx
  ON public.produto_videos (user_id, midia_whatsapp_id)
  WHERE midia_whatsapp_id IS NOT NULL;
