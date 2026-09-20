SELECT cron.unschedule('autopilot-watchdog-4h') WHERE EXISTS (SELECT 1 FROM cron.job WHERE jobname = 'autopilot-watchdog-4h');

SELECT cron.schedule(
  'autopilot-watchdog-4h',
  '25 */4 * * *',
  $$
  SELECT net.http_post(
    url := 'https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/autopilot-watchdog',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);