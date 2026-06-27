
-- Fila de inbound da Cloud API
CREATE TABLE public.whatsapp_cloud_inbound_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  wamid text UNIQUE NOT NULL,
  user_id uuid REFERENCES auth.users(id) ON DELETE SET NULL,
  phone_number_id text NOT NULL,
  from_number text NOT NULL,
  message_type text,
  payload jsonb NOT NULL,
  status text NOT NULL DEFAULT 'received',
  attempts int NOT NULL DEFAULT 0,
  error text,
  created_at timestamptz NOT NULL DEFAULT now(),
  processed_at timestamptz
);

CREATE INDEX idx_wa_cloud_inbound_status ON public.whatsapp_cloud_inbound_queue(status);
CREATE INDEX idx_wa_cloud_inbound_created ON public.whatsapp_cloud_inbound_queue(created_at);
CREATE INDEX idx_wa_cloud_inbound_user ON public.whatsapp_cloud_inbound_queue(user_id);

GRANT SELECT ON public.whatsapp_cloud_inbound_queue TO authenticated;
GRANT ALL ON public.whatsapp_cloud_inbound_queue TO service_role;

ALTER TABLE public.whatsapp_cloud_inbound_queue ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users read own inbound"
  ON public.whatsapp_cloud_inbound_queue
  FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id);

CREATE POLICY "Service role manages inbound"
  ON public.whatsapp_cloud_inbound_queue
  FOR ALL
  TO service_role
  USING (true)
  WITH CHECK (true);

-- Configuração de agente por cliente (multi-tenant)
CREATE TABLE public.whatsapp_cloud_agent_config (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid UNIQUE NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  agent_name text,
  persona text,
  knowledge_base text,
  tone text,
  greeting text,
  handoff_rules jsonb DEFAULT '{}'::jsonb,
  is_active boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.whatsapp_cloud_agent_config TO authenticated;
GRANT ALL ON public.whatsapp_cloud_agent_config TO service_role;

ALTER TABLE public.whatsapp_cloud_agent_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users manage own agent config"
  ON public.whatsapp_cloud_agent_config
  FOR ALL
  TO authenticated
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

CREATE TRIGGER trg_wa_cloud_agent_config_updated_at
  BEFORE UPDATE ON public.whatsapp_cloud_agent_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
