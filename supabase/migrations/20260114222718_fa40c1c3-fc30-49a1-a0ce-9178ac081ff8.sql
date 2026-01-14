-- Agendamento 24/7 do envio programado para grupos (independente de aba/logado)

-- Extensões necessárias para cron + HTTP
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Remover agendamento antigo (se existir)
do $$
declare
  j record;
begin
  for j in (select jobid from cron.job where jobname = 'executar_envio_programado_each_minute') loop
    perform cron.unschedule(j.jobid);
  end loop;
end $$;

-- Agendar execução a cada 1 minuto
select
  cron.schedule(
    job_name := 'executar_envio_programado_each_minute',
    schedule := '* * * * *',
    command := $$
      select
        net.http_post(
          url := 'https://jibpvpqgplmahjhswiza.supabase.co/functions/v1/executar-envio-programado',
          headers := jsonb_build_object('Content-Type','application/json'),
          body := '{}'::jsonb
        );
    $$
  );
