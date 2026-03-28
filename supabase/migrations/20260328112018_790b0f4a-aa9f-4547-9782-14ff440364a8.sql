CREATE TABLE IF NOT EXISTS social_posts_queue (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  produto_id UUID,
  produto_source TEXT DEFAULT 'produtos',
  platform TEXT NOT NULL DEFAULT 'facebook',
  page_id TEXT NOT NULL DEFAULT '855785300949909',
  post_text TEXT,
  image_url TEXT,
  link_url TEXT,
  status TEXT DEFAULT 'pendente',
  scheduled_at TIMESTAMPTZ,
  published_at TIMESTAMPTZ,
  fb_post_id TEXT,
  error_message TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE social_posts_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own posts" ON social_posts_queue
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own posts" ON social_posts_queue
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own posts" ON social_posts_queue
  FOR UPDATE USING (auth.uid() = user_id);

CREATE INDEX idx_social_posts_status ON social_posts_queue(status, scheduled_at);