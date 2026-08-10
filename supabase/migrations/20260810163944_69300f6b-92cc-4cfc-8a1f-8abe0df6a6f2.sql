ALTER TABLE public.tiktok_posts
  ADD COLUMN IF NOT EXISTS privacy_level text,
  ADD COLUMN IF NOT EXISTS disable_comment boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS disable_duet boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS disable_stitch boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS is_commercial_content boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS brand_organic boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS branded_content boolean DEFAULT false,
  ADD COLUMN IF NOT EXISTS consent_accepted_at timestamptz,
  ADD COLUMN IF NOT EXISTS source text DEFAULT 'manual';

COMMENT ON COLUMN public.tiktok_posts.privacy_level IS 'Privacidade escolhida pelo usuario (vem de creator_info.privacy_level_options)';
COMMENT ON COLUMN public.tiktok_posts.source IS 'manual = tela de publicacao; scheduled = envio programado (sempre rascunho)';