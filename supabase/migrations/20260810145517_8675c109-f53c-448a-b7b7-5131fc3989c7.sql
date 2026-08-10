ALTER TABLE public.tiktok_posts
  ADD COLUMN IF NOT EXISTS publish_status text,
  ADD COLUMN IF NOT EXISTS fail_reason text,
  ADD COLUMN IF NOT EXISTS tiktok_post_id text,
  ADD COLUMN IF NOT EXISTS checked_at timestamptz;

CREATE INDEX IF NOT EXISTS idx_tiktok_posts_publish_id
  ON public.tiktok_posts(publish_id);