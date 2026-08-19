CREATE TABLE IF NOT EXISTS public.linkedin_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  member_urn TEXT NOT NULL,
  nome TEXT,
  avatar_url TEXT,
  access_token TEXT NOT NULL,
  refresh_token TEXT,
  token_expires_at TIMESTAMPTZ,
  refresh_expires_at TIMESTAMPTZ,
  scopes TEXT,
  is_active BOOLEAN DEFAULT true,
  alert_status TEXT DEFAULT 'ok',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (user_id)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.linkedin_connections TO authenticated;
GRANT ALL ON public.linkedin_connections TO service_role;

ALTER TABLE public.linkedin_connections ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "own linkedin connection" ON public.linkedin_connections;
CREATE POLICY "own linkedin connection" ON public.linkedin_connections
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

-- state do OAuth (validado no callback; sem acesso do cliente)
CREATE TABLE IF NOT EXISTS public.linkedin_oauth_states (
  state TEXT PRIMARY KEY,
  user_id UUID NOT NULL,
  redirect_to TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW()
);

GRANT ALL ON public.linkedin_oauth_states TO service_role;
ALTER TABLE public.linkedin_oauth_states ENABLE ROW LEVEL SECURITY;

-- fila existente passa a aceitar linkedin
ALTER TABLE public.social_posts_queue
  ADD COLUMN IF NOT EXISTS linkedin_post_urn TEXT,
  ADD COLUMN IF NOT EXISTS link_no_primeiro_comentario BOOLEAN DEFAULT true,
  ADD COLUMN IF NOT EXISTS post_text_linkedin TEXT;

ALTER TABLE public.social_posts_queue ALTER COLUMN page_id DROP NOT NULL;