
-- Adicionar tabela de logs para debug
CREATE TABLE IF NOT EXISTS public.campaign_execution_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  log_type TEXT NOT NULL,
  message TEXT,
  campaign_id UUID,
  error TEXT,
  metadata JSONB
);

-- Recriar função com logging detalhado
CREATE OR REPLACE FUNCTION process_scheduled_campaigns()
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, extensions, vault
AS $$
DECLARE
  campaign_record RECORD;
  supabase_url TEXT;
  service_role_key TEXT;
  http_response extensions.http_response;
  campaigns_found INT := 0;
BEGIN
  -- Log início da execução
  INSERT INTO public.campaign_execution_logs (log_type, message)
  VALUES ('INFO', 'process_scheduled_campaigns iniciada');

  -- Buscar campanhas que precisam ser executadas
  FOR campaign_record IN 
    SELECT id, nome, proxima_execucao
    FROM public.campanhas_recorrentes
    WHERE ativa = true 
      AND proxima_execucao <= NOW()
    ORDER BY proxima_execucao ASC
  LOOP
    campaigns_found := campaigns_found + 1;
    
    -- Log campanha encontrada
    INSERT INTO public.campaign_execution_logs (log_type, message, campaign_id, metadata)
    VALUES ('INFO', 'Campanha encontrada', campaign_record.id, 
            jsonb_build_object('nome', campaign_record.nome, 'proxima_execucao', campaign_record.proxima_execucao));

    -- Configurar URLs
    supabase_url := 'https://jibpvpqgplmahjhswiza.supabase.co';
    
    -- Buscar service role key
    BEGIN
      SELECT decrypted_secret INTO service_role_key
      FROM vault.decrypted_secrets
      WHERE name = 'SUPABASE_SERVICE_ROLE_KEY'
      LIMIT 1;
      
      IF service_role_key IS NULL THEN
        INSERT INTO public.campaign_execution_logs (log_type, message, campaign_id, error)
        VALUES ('ERROR', 'Service role key não encontrada', campaign_record.id, 'SUPABASE_SERVICE_ROLE_KEY missing');
        CONTINUE;
      END IF;
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.campaign_execution_logs (log_type, message, campaign_id, error)
      VALUES ('ERROR', 'Erro ao buscar service role key', campaign_record.id, SQLERRM);
      CONTINUE;
    END;

    -- Chamar edge function
    BEGIN
      SELECT * INTO http_response
      FROM extensions.http((
        'POST',
        supabase_url || '/functions/v1/execute-campaign',
        ARRAY[
          extensions.http_header('Authorization', 'Bearer ' || service_role_key),
          extensions.http_header('Content-Type', 'application/json')
        ],
        'application/json',
        json_build_object('campaign_id', campaign_record.id)::text
      ));

      -- Log resposta
      INSERT INTO public.campaign_execution_logs (log_type, message, campaign_id, metadata)
      VALUES ('INFO', 'Edge function chamada', campaign_record.id,
              jsonb_build_object('status', http_response.status, 'response', http_response.content));
              
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.campaign_execution_logs (log_type, message, campaign_id, error)
      VALUES ('ERROR', 'Erro ao chamar edge function', campaign_record.id, SQLERRM);
    END;
  END LOOP;

  -- Log final
  INSERT INTO public.campaign_execution_logs (log_type, message, metadata)
  VALUES ('INFO', 'process_scheduled_campaigns finalizada', 
          jsonb_build_object('campanhas_processadas', campaigns_found));
END;
$$;

-- Remover job antigo se existir
SELECT cron.unschedule('process-campaigns-every-5min');

-- Criar novo job
SELECT cron.schedule(
  'process-campaigns-every-5min',
  '*/5 * * * *',
  $$SELECT process_scheduled_campaigns();$$
);

-- Executar uma vez manualmente para testar
SELECT process_scheduled_campaigns();
