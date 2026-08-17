CREATE TABLE IF NOT EXISTS public.internal_cron_keys (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL UNIQUE,
  chave text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT ALL ON public.internal_cron_keys TO service_role;
ALTER TABLE public.internal_cron_keys ENABLE ROW LEVEL SECURITY;

INSERT INTO public.internal_cron_keys (nome, chave)
VALUES ('video-render-maintenance', replace(gen_random_uuid()::text, '-', '') || replace(gen_random_uuid()::text, '-', ''))
ON CONFLICT (nome) DO NOTHING;

DO $$
DECLARE k text;
BEGIN
  SELECT chave INTO k FROM public.internal_cron_keys WHERE nome = 'video-render-maintenance';
  PERFORM cron.unschedule('video-render-maintenance-5min');
  PERFORM cron.schedule('video-render-maintenance-5min', '*/5 * * * *', format($f$
  SELECT net.http_post(
    url := 'https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/video-render-maintenance',
    headers := %L::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $f$, json_build_object('Content-Type','application/json','x-cron-key',k)::text));
END $$;