-- Aplicar manualmente após dump do banco.
-- Persiste todos os cards do carrossel para o executor agendado e mantém um
-- identificador estável para agrupar as linhas do mesmo criativo do WhatsApp.
ALTER TABLE public.social_posts_queue
  ADD COLUMN IF NOT EXISTS image_urls JSONB,
  ADD COLUMN IF NOT EXISTS approval_token TEXT;

COMMENT ON COLUMN public.social_posts_queue.image_urls IS
  'Lista completa de URLs de imagens para publicação de carrossel.';

COMMENT ON COLUMN public.social_posts_queue.approval_token IS
  'Token lógico que agrupa as redes do mesmo criativo aprovado/agendado.';

CREATE INDEX IF NOT EXISTS idx_social_posts_queue_approval_token
  ON public.social_posts_queue(user_id, approval_token)
  WHERE approval_token IS NOT NULL;
