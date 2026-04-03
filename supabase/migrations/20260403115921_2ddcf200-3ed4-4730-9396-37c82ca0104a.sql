CREATE TABLE IF NOT EXISTS public.whatsapp_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  phone_number_id TEXT,
  waba_id TEXT,
  access_token TEXT,
  display_phone TEXT,
  business_name TEXT,
  is_active BOOLEAN DEFAULT false,
  is_verified BOOLEAN DEFAULT false,
  last_verified_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(user_id)
);

ALTER TABLE public.whatsapp_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_whatsapp_config" ON public.whatsapp_config
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_whatsapp_config_user ON public.whatsapp_config(user_id);