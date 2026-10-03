-- Aplicar manualmente após dump e antes do deploy das Edge Functions.
ALTER TABLE public.social_posts_queue
  ADD COLUMN IF NOT EXISTS solicitante_telefone TEXT,
  ADD COLUMN IF NOT EXISTS notificado_em TIMESTAMPTZ;

COMMENT ON COLUMN public.social_posts_queue.solicitante_telefone IS
  'Telefone do responsável que agendou o criativo pelo WhatsApp.';

COMMENT ON COLUMN public.social_posts_queue.notificado_em IS
  'Momento em que o resultado final do agendamento foi tratado para notificação.';

CREATE INDEX IF NOT EXISTS idx_social_posts_queue_social_notification
  ON public.social_posts_queue(user_id, approval_token, notificado_em)
  WHERE approval_token IS NOT NULL;
