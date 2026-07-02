
CREATE TABLE IF NOT EXISTS public.jarvis_alerts_state (
  alert_key TEXT PRIMARY KEY,
  last_sent_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  payload JSONB
);
GRANT ALL ON public.jarvis_alerts_state TO service_role;
ALTER TABLE public.jarvis_alerts_state ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_only" ON public.jarvis_alerts_state FOR ALL USING (false);
