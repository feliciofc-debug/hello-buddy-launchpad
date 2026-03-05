CREATE OR REPLACE FUNCTION public.process_scheduled_campaigns()
 RETURNS void
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO 'public', 'extensions', 'net'
AS $function$
DECLARE
  campaign_record RECORD;
  supabase_url TEXT := 'https://jibpvpqgplmahjhswiza.supabase.co';
  anon_key TEXT := 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImppYnB2cHFncGxtYWhqaHN3aXphIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NjA1ODA0ODcsImV4cCI6MjA3NjE1NjQ4N30.raNfZtKkNUZBHiAA6yobri0YoWZt_Ioq10qMC9hfNrc';
  campaigns_found INT := 0;
  request_id BIGINT;
BEGIN
  INSERT INTO public.campaign_execution_logs (log_type, message)
  VALUES ('INFO', 'process_scheduled_campaigns iniciada');

  FOR campaign_record IN 
    SELECT id, nome, proxima_execucao
    FROM public.campanhas_recorrentes
    WHERE ativa = true 
      AND proxima_execucao <= NOW()
    ORDER BY proxima_execucao ASC
  LOOP
    campaigns_found := campaigns_found + 1;
    
    INSERT INTO public.campaign_execution_logs (log_type, message, campaign_id, metadata)
    VALUES ('INFO', 'Campanha encontrada - disparando via pg_net', campaign_record.id, 
            jsonb_build_object('nome', campaign_record.nome, 'proxima_execucao', campaign_record.proxima_execucao));

    BEGIN
      SELECT net.http_post(
        url := supabase_url || '/functions/v1/execute-campaign',
        headers := jsonb_build_object(
          'Authorization', 'Bearer ' || anon_key,
          'Content-Type', 'application/json',
          'apikey', anon_key
        ),
        body := jsonb_build_object('campaign_id', campaign_record.id)
      ) INTO request_id;

      INSERT INTO public.campaign_execution_logs (log_type, message, campaign_id, metadata)
      VALUES ('INFO', 'Edge function disparada (async)', campaign_record.id,
              jsonb_build_object('request_id', request_id));
              
    EXCEPTION WHEN OTHERS THEN
      INSERT INTO public.campaign_execution_logs (log_type, message, campaign_id, error)
      VALUES ('ERROR', 'Erro ao disparar edge function', campaign_record.id, SQLERRM);
    END;
  END LOOP;

  INSERT INTO public.campaign_execution_logs (log_type, message, metadata)
  VALUES ('INFO', 'process_scheduled_campaigns finalizada', 
          jsonb_build_object('campanhas_processadas', campaigns_found));
END;
$function$;