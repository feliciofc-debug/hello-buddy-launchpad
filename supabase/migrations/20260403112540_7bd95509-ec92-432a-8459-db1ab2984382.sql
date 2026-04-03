
CREATE TABLE IF NOT EXISTS public.meta_connections (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  meta_user_id TEXT,
  meta_user_name TEXT,
  meta_user_email TEXT,
  user_access_token TEXT,
  page_id TEXT,
  page_name TEXT,
  page_access_token TEXT,
  ig_account_id TEXT,
  ig_username TEXT,
  permissions TEXT[],
  is_active BOOLEAN DEFAULT true,
  token_expires_at TIMESTAMPTZ,
  last_verified_at TIMESTAMPTZ,
  connection_error TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.meta_connections ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own meta connection"
ON public.meta_connections FOR SELECT TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own meta connection"
ON public.meta_connections FOR INSERT TO authenticated
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own meta connection"
ON public.meta_connections FOR UPDATE TO authenticated
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own meta connection"
ON public.meta_connections FOR DELETE TO authenticated
USING (auth.uid() = user_id);

-- Service role needs full access for edge functions
CREATE POLICY "Service role full access meta_connections"
ON public.meta_connections FOR ALL TO service_role
USING (true) WITH CHECK (true);

CREATE INDEX idx_meta_connections_user ON public.meta_connections(user_id);

CREATE TRIGGER update_meta_connections_updated_at
BEFORE UPDATE ON public.meta_connections
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
