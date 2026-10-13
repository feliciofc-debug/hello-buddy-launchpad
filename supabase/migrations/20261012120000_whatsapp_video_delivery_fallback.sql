ALTER TABLE public.whatsapp_cloud_messages
  ADD COLUMN IF NOT EXISTS metadata jsonb NOT NULL DEFAULT '{}'::jsonb,
  ADD COLUMN IF NOT EXISTS video_fallback_notified_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_wa_cloud_msg_video_fallback
  ON public.whatsapp_cloud_messages (wamid)
  WHERE message_type = 'video';
