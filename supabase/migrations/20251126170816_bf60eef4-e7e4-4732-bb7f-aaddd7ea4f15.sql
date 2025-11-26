-- Ativar extensões necessárias
CREATE EXTENSION IF NOT EXISTS pg_cron;
CREATE EXTENSION IF NOT EXISTS http WITH SCHEMA extensions;

-- Função PostgreSQL que dispara a edge function para processar campanhas
CREATE OR REPLACE FUNCTION process_scheduled_campaigns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  campaign RECORD;
  result_status INTEGER;
  service_role_key TEXT;
  supabase_url TEXT := 'https://jibpvpqgplmahjhswiza.supabase.co';
BEGIN
  -- Buscar service role key das secrets do Supabase
  SELECT decrypted_secret INTO service_role_key
  FROM vault.decrypted_secrets
  WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
  LIMIT 1;

  -- Buscar campanhas que devem executar AGORA
  FOR campaign IN
    SELECT id
    FROM campanhas_recorrentes
    WHERE ativa = true
    AND proxima_execucao <= NOW()
    ORDER BY proxima_execucao ASC
  LOOP
    -- Log da campanha sendo processada
    RAISE NOTICE 'Processando campanha ID: %', campaign.id;
    
    -- Chamar edge function via extensão http
    SELECT status INTO result_status
    FROM extensions.http((
      'POST',
      supabase_url || '/functions/v1/execute-campaign',
      ARRAY[
        extensions.http_header('Content-Type', 'application/json'),
        extensions.http_header('Authorization', 'Bearer ' || service_role_key)
      ],
      'application/json',
      json_build_object('campaign_id', campaign.id)::text
    )::extensions.http_request);
    
    RAISE NOTICE 'Resposta HTTP: %', result_status;
  END LOOP;
END;
$$;

-- Agendar para rodar A CADA 5 MINUTOS
SELECT cron.schedule(
  'process-campaigns-every-5min',
  '*/5 * * * *',
  $$SELECT process_scheduled_campaigns();$$
);