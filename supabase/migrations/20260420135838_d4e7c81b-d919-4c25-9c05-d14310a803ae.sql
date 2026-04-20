CREATE TABLE IF NOT EXISTS public.autopilot_textos_personalizados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  texto TEXT NOT NULL,
  ordem INT DEFAULT 0,
  ativo BOOLEAN DEFAULT true,
  criado_em TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_textos_user 
  ON public.autopilot_textos_personalizados(user_id);

ALTER TABLE public.autopilot_textos_personalizados 
  ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage their own texts"
  ON public.autopilot_textos_personalizados FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);