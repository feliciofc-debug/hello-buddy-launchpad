-- Tabela para debug de payloads do webhook
CREATE TABLE IF NOT EXISTS public.webhook_debug_logs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  payload JSONB,
  extracted_phone TEXT,
  extracted_message TEXT,
  processing_result TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- RLS para permitir inserção do webhook e leitura dos usuários
ALTER TABLE public.webhook_debug_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can insert debug logs" ON public.webhook_debug_logs
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Authenticated users can view debug logs" ON public.webhook_debug_logs
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY "System can delete debug logs" ON public.webhook_debug_logs
  FOR DELETE USING (true);