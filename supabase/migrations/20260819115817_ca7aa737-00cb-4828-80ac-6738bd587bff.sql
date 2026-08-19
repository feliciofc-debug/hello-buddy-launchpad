select cron.unschedule('linkedin-token-refresh-diario') where exists (select 1 from cron.job where jobname='linkedin-token-refresh-diario');

select cron.schedule(
  'linkedin-token-refresh-diario',
  '10 4 * * *',
  $$
  select net.http_post(
    url := 'https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/linkedin-token-refresh',
    headers := '{"Content-Type":"application/json"}'::jsonb,
    body := '{}'::jsonb
  );
  $$
);