
-- Grant schema usage
GRANT USAGE ON SCHEMA public TO anon;
GRANT USAGE ON SCHEMA public TO authenticated;

-- Grant table permissions for anon
GRANT SELECT, UPDATE ON public.fila_atendimento_pj TO anon;
GRANT SELECT, INSERT, UPDATE ON public.gateway_status TO anon;

-- Drop existing policies to avoid conflicts
DROP POLICY IF EXISTS "anon_dispatcher_select" ON public.fila_atendimento_pj;
DROP POLICY IF EXISTS "anon_dispatcher_update" ON public.fila_atendimento_pj;
DROP POLICY IF EXISTS "anon_gateway_all" ON public.gateway_status;
DROP POLICY IF EXISTS "dispatcher_read" ON public.fila_atendimento_pj;
DROP POLICY IF EXISTS "dispatcher_update" ON public.fila_atendimento_pj;
DROP POLICY IF EXISTS "gateway_all" ON public.gateway_status;

-- RLS policies for anon dispatcher
CREATE POLICY "anon_dispatcher_select" ON public.fila_atendimento_pj
  FOR SELECT TO anon
  USING (status IN ('pendente', 'processando'));

CREATE POLICY "anon_dispatcher_update" ON public.fila_atendimento_pj
  FOR UPDATE TO anon
  USING (status IN ('pendente', 'processando'));

CREATE POLICY "anon_gateway_all" ON public.gateway_status
  FOR ALL TO anon
  USING (true) WITH CHECK (true);
