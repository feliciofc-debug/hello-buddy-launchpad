
ALTER TABLE public.whatsapp_config
  ADD COLUMN IF NOT EXISTS token_expires_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS last_refresh_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS refresh_attempts INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS alert_status TEXT NOT NULL DEFAULT 'none',
  ADD COLUMN IF NOT EXISTS connection_method TEXT;

ALTER TABLE public.whatsapp_config
  DROP CONSTRAINT IF EXISTS whatsapp_config_alert_status_check;
ALTER TABLE public.whatsapp_config
  ADD CONSTRAINT whatsapp_config_alert_status_check
  CHECK (alert_status IN ('none', 'reconnect_soon', 'expired', 'refresh_failed'));

CREATE INDEX IF NOT EXISTS idx_whatsapp_config_refresh
  ON public.whatsapp_config (is_active, token_expires_at)
  WHERE is_active = true;
