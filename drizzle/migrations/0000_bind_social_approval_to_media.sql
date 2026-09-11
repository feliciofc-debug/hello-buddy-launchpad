ALTER TABLE public.social_posts_queue
  ADD COLUMN IF NOT EXISTS approval_token text,
  ADD COLUMN IF NOT EXISTS approved_at timestamptz,
  ADD COLUMN IF NOT EXISTS approved_by text,
  ADD COLUMN IF NOT EXISTS approved_media_url text;

CREATE INDEX IF NOT EXISTS idx_social_posts_queue_approval_token
  ON public.social_posts_queue (user_id, approval_token)
  WHERE approval_token IS NOT NULL;