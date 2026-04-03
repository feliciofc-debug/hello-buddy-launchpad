CREATE TABLE IF NOT EXISTS public.videos_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  produto_id UUID REFERENCES public.produtos(id) ON DELETE SET NULL,
  titulo TEXT,
  descricao TEXT,
  video_url TEXT NOT NULL,
  thumbnail_url TEXT,
  duracao_segundos INTEGER,
  tamanho_mb NUMERIC(10,2),
  tipo TEXT DEFAULT 'reels',
  status TEXT DEFAULT 'disponivel',
  publicado_facebook BOOLEAN DEFAULT false,
  publicado_instagram BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.videos_produtos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_videos" ON public.videos_produtos
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_videos_produtos_user ON public.videos_produtos(user_id);