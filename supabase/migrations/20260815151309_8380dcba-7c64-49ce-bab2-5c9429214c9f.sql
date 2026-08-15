SELECT cron.schedule(
  'video-render-maintenance-5min',
  '*/5 * * * *',
  $$
  SELECT net.http_post(
    url := 'https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/video-render-maintenance',
    headers := '{"Content-Type": "application/json"}'::jsonb,
    body := '{"source":"cron"}'::jsonb
  );
  $$
);