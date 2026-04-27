-- Função utilitária para inspeção segura de cron jobs (SECURITY DEFINER)
-- Apenas permite SELECT em cron.job — não executa nada destrutivo.
CREATE OR REPLACE FUNCTION public.admin_list_cron_jobs()
RETURNS TABLE (
  jobid bigint,
  jobname text,
  schedule text,
  active boolean,
  command text
)
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, cron
AS $$
  SELECT jobid, jobname, schedule, active, command
  FROM cron.job
  ORDER BY jobid;
$$;

REVOKE ALL ON FUNCTION public.admin_list_cron_jobs() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.admin_list_cron_jobs() TO service_role;

COMMENT ON FUNCTION public.admin_list_cron_jobs() IS
  'Inspeção administrativa de cron jobs. Apenas service_role.';
