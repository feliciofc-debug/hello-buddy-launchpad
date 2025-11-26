
-- Habilitar RLS na tabela de logs
ALTER TABLE public.campaign_execution_logs ENABLE ROW LEVEL SECURITY;

-- Política para permitir leitura dos logs (apenas para autenticados)
CREATE POLICY "Usuários podem ver logs" ON public.campaign_execution_logs
  FOR SELECT
  USING (true);

-- Política para permitir o sistema inserir logs
CREATE POLICY "Sistema pode inserir logs" ON public.campaign_execution_logs
  FOR INSERT
  WITH CHECK (true);
