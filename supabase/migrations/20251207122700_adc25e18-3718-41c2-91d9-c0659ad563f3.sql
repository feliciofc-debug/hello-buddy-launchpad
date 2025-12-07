-- Tabela de integrações de estoque
CREATE TABLE IF NOT EXISTS public.stock_integrations (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  
  -- Config básica
  name TEXT NOT NULL,
  integration_type TEXT NOT NULL, -- 'bling', 'tiny', 'omie', 'custom'
  active BOOLEAN DEFAULT true,
  
  -- Credenciais
  api_url TEXT NOT NULL,
  api_key TEXT,
  api_token TEXT,
  auth_type TEXT DEFAULT 'api_key', -- 'api_key', 'bearer', 'basic', 'token'
  
  -- Mapeamento de campos (JSON)
  field_mapping JSONB NOT NULL DEFAULT '{}'::jsonb,
  
  -- Status
  last_sync_at TIMESTAMPTZ,
  last_sync_status TEXT, -- 'success', 'error', 'pending'
  last_error TEXT,
  sync_count INTEGER DEFAULT 0,
  products_synced INTEGER DEFAULT 0,
  
  -- Auto-sync
  auto_sync BOOLEAN DEFAULT true,
  sync_interval INTEGER DEFAULT 300, -- 5 minutos em segundos
  
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_stock_integrations_user ON public.stock_integrations(user_id);
CREATE INDEX IF NOT EXISTS idx_stock_integrations_active ON public.stock_integrations(active) WHERE active = true;
CREATE INDEX IF NOT EXISTS idx_stock_integrations_type ON public.stock_integrations(integration_type);

-- Habilitar RLS
ALTER TABLE public.stock_integrations ENABLE ROW LEVEL SECURITY;

-- Políticas de segurança
CREATE POLICY "Users can view own integrations"
ON public.stock_integrations FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Users can create own integrations"
ON public.stock_integrations FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own integrations"
ON public.stock_integrations FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own integrations"
ON public.stock_integrations FOR DELETE
USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE TRIGGER update_stock_integrations_updated_at
BEFORE UPDATE ON public.stock_integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();