
CREATE TABLE IF NOT EXISTS public.feature_flags (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  flag_key TEXT NOT NULL UNIQUE,
  description TEXT,
  is_enabled BOOLEAN DEFAULT false,
  allowed_emails TEXT[] DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.feature_flags ENABLE ROW LEVEL SECURITY;

-- Any authenticated user can read flags
CREATE POLICY "Authenticated users can read flags"
  ON public.feature_flags FOR SELECT
  TO authenticated
  USING (true);

-- Only admin can insert
CREATE POLICY "Only admin can insert flags"
  ON public.feature_flags FOR INSERT
  TO authenticated
  WITH CHECK (auth.jwt() ->> 'email' = 'expo@atombrasildigital.com');

-- Only admin can update
CREATE POLICY "Only admin can update flags"
  ON public.feature_flags FOR UPDATE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'expo@atombrasildigital.com');

-- Only admin can delete
CREATE POLICY "Only admin can delete flags"
  ON public.feature_flags FOR DELETE
  TO authenticated
  USING (auth.jwt() ->> 'email' = 'expo@atombrasildigital.com');

-- Trigger for updated_at
CREATE TRIGGER update_feature_flags_updated_at
  BEFORE UPDATE ON public.feature_flags
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Insert initial flags
INSERT INTO public.feature_flags (flag_key, description, is_enabled, allowed_emails) VALUES
  ('tiktok_integration', 'Integração TikTok na área PJ (botões publicar + conexão)', false, ARRAY['expo@atombrasildigital.com']),
  ('ai_video_generation', 'Geração de vídeos com IA na aba Videos', false, ARRAY['expo@atombrasildigital.com']),
  ('facebook_ads', 'Integração Facebook Ads / Manus Performance', false, ARRAY['expo@atombrasildigital.com']),
  ('whatsapp_official', 'WhatsApp Business API Oficial', false, ARRAY['expo@atombrasildigital.com']),
  ('autopilot_tiktok', 'TikTok como destino no Autopilot Social', false, ARRAY['expo@atombrasildigital.com']);
