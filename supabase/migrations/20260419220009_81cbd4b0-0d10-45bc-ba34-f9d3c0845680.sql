-- Tabela produto_videos
CREATE TABLE IF NOT EXISTS public.produto_videos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id UUID REFERENCES public.produtos(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  titulo TEXT,
  legenda TEXT,
  duracao_segundos INT DEFAULT 12,
  status TEXT DEFAULT 'pronto',
  tamanho_bytes BIGINT,
  criado_em TIMESTAMPTZ DEFAULT NOW(),
  publicado_em TIMESTAMPTZ,
  publicado_facebook BOOLEAN DEFAULT false,
  publicado_instagram BOOLEAN DEFAULT false,
  facebook_post_id TEXT,
  instagram_post_id TEXT
);

CREATE INDEX IF NOT EXISTS idx_produto_videos_user ON public.produto_videos(user_id);
CREATE INDEX IF NOT EXISTS idx_produto_videos_produto ON public.produto_videos(produto_id);
CREATE INDEX IF NOT EXISTS idx_produto_videos_criado ON public.produto_videos(criado_em DESC);

ALTER TABLE public.produto_videos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own videos"
  ON public.produto_videos
  FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Bucket produto-videos
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES (
  'produto-videos',
  'produto-videos',
  true,
  10485760,
  ARRAY['video/mp4', 'image/jpeg', 'image/png']
)
ON CONFLICT (id) DO NOTHING;

CREATE POLICY "Users upload own produto-videos"
  ON storage.objects FOR INSERT
  WITH CHECK (
    bucket_id = 'produto-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

CREATE POLICY "Public read produto-videos"
  ON storage.objects FOR SELECT
  USING (bucket_id = 'produto-videos');

CREATE POLICY "Users delete own produto-videos"
  ON storage.objects FOR DELETE
  USING (
    bucket_id = 'produto-videos'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );