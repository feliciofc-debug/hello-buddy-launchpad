CREATE TABLE IF NOT EXISTS public.client_brand_identities (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  client_name TEXT NOT NULL,
  normalized_name TEXT NOT NULL,
  site_url TEXT,
  logo_path TEXT,
  identity JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT client_brand_identities_user_name_key UNIQUE (user_id, normalized_name)
);

CREATE INDEX IF NOT EXISTS idx_client_brand_identities_user
  ON public.client_brand_identities(user_id);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.client_brand_identities TO authenticated;
GRANT ALL ON public.client_brand_identities TO service_role;

ALTER TABLE public.client_brand_identities ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own client brand identities select"
  ON public.client_brand_identities FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "own client brand identities insert"
  ON public.client_brand_identities FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own client brand identities update"
  ON public.client_brand_identities FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "own client brand identities delete"
  ON public.client_brand_identities FOR DELETE
  USING (auth.uid() = user_id);

CREATE TRIGGER update_client_brand_identities_updated_at
  BEFORE UPDATE ON public.client_brand_identities
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
