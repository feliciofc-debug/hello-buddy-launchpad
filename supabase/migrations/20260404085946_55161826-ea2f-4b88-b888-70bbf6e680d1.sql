
CREATE TABLE IF NOT EXISTS public.carrosseis_gerados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  tema TEXT NOT NULL,
  estilo TEXT DEFAULT 'modern',
  num_slides INTEGER DEFAULT 5,
  slides_data JSONB,
  imagens_urls TEXT[],
  caption TEXT,
  publicado_instagram BOOLEAN DEFAULT false,
  publicado_facebook BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.carrosseis_gerados ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_carrosseis" ON public.carrosseis_gerados
  FOR ALL USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);
