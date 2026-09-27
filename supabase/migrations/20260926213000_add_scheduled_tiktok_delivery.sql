-- TikTok scheduling state. This migration is intentionally additive so it can
-- be deployed before the application code.
ALTER TABLE public.social_posts_queue
  ADD COLUMN IF NOT EXISTS tiktok_privacy_level text,
  ADD COLUMN IF NOT EXISTS tiktok_is_commercial_content boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiktok_brand_organic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiktok_branded_content boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiktok_consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS tiktok_creator_nickname text,
  ADD COLUMN IF NOT EXISTS tiktok_video_duration_sec numeric,
  ADD COLUMN IF NOT EXISTS tiktok_publish_id text,
  ADD COLUMN IF NOT EXISTS tiktok_post_row_id uuid,
  ADD COLUMN IF NOT EXISTS tiktok_publish_status text,
  ADD COLUMN IF NOT EXISTS tiktok_fail_reason text,
  ADD COLUMN IF NOT EXISTS tiktok_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiktok_next_retry_at timestamptz;

ALTER TABLE public.videos_agendados
  ADD COLUMN IF NOT EXISTS completed_channels text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS tiktok_privacy_level text,
  ADD COLUMN IF NOT EXISTS tiktok_is_commercial_content boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiktok_brand_organic boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiktok_branded_content boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiktok_consented_at timestamptz,
  ADD COLUMN IF NOT EXISTS tiktok_creator_nickname text,
  ADD COLUMN IF NOT EXISTS tiktok_video_duration_sec numeric,
  ADD COLUMN IF NOT EXISTS tiktok_publish_id text,
  ADD COLUMN IF NOT EXISTS tiktok_post_row_id uuid,
  ADD COLUMN IF NOT EXISTS tiktok_publish_status text,
  ADD COLUMN IF NOT EXISTS tiktok_fail_reason text,
  ADD COLUMN IF NOT EXISTS tiktok_retry_count integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS tiktok_next_retry_at timestamptz;

ALTER TABLE public.autopilot_config
  ADD COLUMN IF NOT EXISTS postar_tiktok boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tiktok_privacy_level text;

CREATE INDEX IF NOT EXISTS idx_social_posts_queue_tiktok_retry
  ON public.social_posts_queue (status, tiktok_next_retry_at)
  WHERE platform = 'tiktok' AND status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_videos_agendados_tiktok_retry
  ON public.videos_agendados (status, tiktok_next_retry_at)
  WHERE 'tiktok' = ANY(canais) AND status = 'pendente';

COMMENT ON COLUMN public.autopilot_config.tiktok_privacy_level IS
  'Preferência exibida ao usuário; o piloto automático sempre envia o vídeo ao inbox/rascunhos do TikTok.';
