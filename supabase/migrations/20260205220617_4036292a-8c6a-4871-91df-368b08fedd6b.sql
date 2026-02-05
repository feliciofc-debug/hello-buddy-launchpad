-- Tabela para monitorar saúde das Edge Functions
CREATE TABLE IF NOT EXISTS public.edge_functions_health (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL UNIQUE,
  last_check TIMESTAMP WITH TIME ZONE DEFAULT now(),
  status TEXT NOT NULL DEFAULT 'unknown', -- 'online', 'offline', 'unknown'
  last_online TIMESTAMP WITH TIME ZONE,
  last_error TEXT,
  consecutive_failures INTEGER DEFAULT 0,
  is_critical BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Inserir funções críticas para monitorar
INSERT INTO public.edge_functions_health (function_name, is_critical) VALUES
  ('executar-envio-programado', true),
  ('processar-fila-afiliado', true),
  ('send-wuzapi-message-afiliado', true),
  ('send-wuzapi-group-message', true),
  ('wuzapi-webhook-afiliados', true),
  ('wuzapi-webhook-pj', true),
  ('send-wuzapi-message-pj', true),
  ('executar-campanhas-agendadas', true),
  ('send-wuzapi-group-message-pj', true)
ON CONFLICT (function_name) DO NOTHING;

-- Tabela de logs de incidentes
CREATE TABLE IF NOT EXISTS public.edge_functions_incidents (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  function_name TEXT NOT NULL,
  incident_type TEXT NOT NULL, -- 'offline', 'recovered', 'error'
  details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE public.edge_functions_health ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.edge_functions_incidents ENABLE ROW LEVEL SECURITY;

-- Políticas - Leitura pública para o dashboard, escrita apenas via service role
CREATE POLICY "Anyone can read health status" ON public.edge_functions_health FOR SELECT USING (true);
CREATE POLICY "Anyone can read incidents" ON public.edge_functions_incidents FOR SELECT USING (true);

-- Index para performance
CREATE INDEX IF NOT EXISTS idx_health_status ON public.edge_functions_health(status);
CREATE INDEX IF NOT EXISTS idx_incidents_created ON public.edge_functions_incidents(created_at DESC);