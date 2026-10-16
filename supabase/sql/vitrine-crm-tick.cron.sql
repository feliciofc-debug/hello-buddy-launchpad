-- Aplicar manualmente no servidor (NÃO migration).
-- Ajuste URL e apikey para o projeto Supabase.

SELECT cron.schedule(
  'vitrine-crm-tick',
  '* * * * *',
  $$
  SELECT net.http_post(
    url := 'https://SEU_PROJETO.supabase.co/functions/v1/vitrine-crm-tick',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', 'SUA_ANON_OU_SERVICE_KEY'
    ),
    body := '{}'::jsonb
  );
  $$
);
