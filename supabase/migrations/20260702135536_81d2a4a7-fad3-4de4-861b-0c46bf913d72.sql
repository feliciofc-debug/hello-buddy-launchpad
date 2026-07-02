
CREATE TABLE IF NOT EXISTS public.whatsapp_user_locations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  contact_number TEXT NOT NULL,
  latitude DOUBLE PRECISION NOT NULL,
  longitude DOUBLE PRECISION NOT NULL,
  name TEXT,
  address TEXT,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  UNIQUE (user_id, contact_number)
);
GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_user_locations TO authenticated;
GRANT ALL ON public.whatsapp_user_locations TO service_role;
ALTER TABLE public.whatsapp_user_locations ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role manages locations" ON public.whatsapp_user_locations FOR ALL TO service_role USING (true) WITH CHECK (true);
