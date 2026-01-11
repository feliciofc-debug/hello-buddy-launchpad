-- Tabela para armazenar histórico de posts do TikTok
CREATE TABLE IF NOT EXISTS public.tiktok_posts (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  content_type TEXT NOT NULL,
  content_url TEXT NOT NULL,
  title TEXT NOT NULL,
  post_mode TEXT NOT NULL DEFAULT 'draft',
  status TEXT NOT NULL DEFAULT 'pending',
  publish_id TEXT,
  tiktok_response JSONB,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.tiktok_posts ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para tiktok_posts
CREATE POLICY "Users can view their own tiktok posts" 
ON public.tiktok_posts 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own tiktok posts" 
ON public.tiktok_posts 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own tiktok posts" 
ON public.tiktok_posts 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Tabela para configurações do usuário (se não existir)
CREATE TABLE IF NOT EXISTS public.user_settings (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL UNIQUE,
  tiktok_default_post_mode TEXT DEFAULT 'draft',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

-- Políticas RLS para user_settings
CREATE POLICY "Users can view their own settings" 
ON public.user_settings 
FOR SELECT 
USING (auth.uid() = user_id);

CREATE POLICY "Users can create their own settings" 
ON public.user_settings 
FOR INSERT 
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own settings" 
ON public.user_settings 
FOR UPDATE 
USING (auth.uid() = user_id);

-- Adicionar coluna expires_at na tabela integrations se não existir
DO $$ 
BEGIN
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_name = 'integrations' AND column_name = 'expires_at') THEN
    ALTER TABLE public.integrations ADD COLUMN expires_at TIMESTAMP WITH TIME ZONE;
  END IF;
END $$;

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_tiktok_posts_user_id ON public.tiktok_posts(user_id);
CREATE INDEX IF NOT EXISTS idx_tiktok_posts_created_at ON public.tiktok_posts(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_user_settings_user_id ON public.user_settings(user_id);