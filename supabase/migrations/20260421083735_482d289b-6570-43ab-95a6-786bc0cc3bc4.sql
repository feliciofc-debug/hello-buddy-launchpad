ALTER TABLE public.produto_videos
  ADD COLUMN IF NOT EXISTS postado_story_facebook BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS postado_story_instagram BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS story_facebook_id TEXT,
  ADD COLUMN IF NOT EXISTS story_instagram_id TEXT,
  ADD COLUMN IF NOT EXISTS postado_story_em TIMESTAMPTZ;

ALTER TABLE public.videos_produtos
  ADD COLUMN IF NOT EXISTS postado_story_facebook BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS postado_story_instagram BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS story_facebook_id TEXT,
  ADD COLUMN IF NOT EXISTS story_instagram_id TEXT,
  ADD COLUMN IF NOT EXISTS postado_story_em TIMESTAMPTZ;