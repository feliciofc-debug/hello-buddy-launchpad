
-- Adicionar campos para integração com Gateway Local (Sophia Dispatcher)
ALTER TABLE public.fila_atendimento_pj 
  ADD COLUMN IF NOT EXISTS opt_in_status text DEFAULT 'novo',
  ADD COLUMN IF NOT EXISTS campanha_id uuid,
  ADD COLUMN IF NOT EXISTS lead_source text DEFAULT 'manual';

-- Índices para performance do polling do dispatcher
CREATE INDEX IF NOT EXISTS idx_fila_pj_status_scheduled 
  ON public.fila_atendimento_pj (status, scheduled_at) 
  WHERE status = 'pendente';

CREATE INDEX IF NOT EXISTS idx_fila_pj_opt_in_status 
  ON public.fila_atendimento_pj (opt_in_status);

CREATE INDEX IF NOT EXISTS idx_fila_pj_campanha 
  ON public.fila_atendimento_pj (campanha_id);

-- Tabela de campanhas do Sophia Dispatcher
CREATE TABLE IF NOT EXISTS public.sophia_campanhas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  nome text NOT NULL,
  produto text DEFAULT 'Arquivo Confidencial',
  link_hotmart text DEFAULT 'https://go.hotmart.com/C104903078G',
  mensagem_template text NOT NULL,
  tipo text DEFAULT 'completa', -- 'optin' ou 'completa'
  status text DEFAULT 'rascunho', -- rascunho | agendada | executando | concluida | pausada
  total_leads integer DEFAULT 0,
  total_enviados integer DEFAULT 0,
  total_erros integer DEFAULT 0,
  total_quentes integer DEFAULT 0,
  total_frios integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.sophia_campanhas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can manage their own sophia campaigns"
  ON public.sophia_campanhas FOR ALL
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Trigger updated_at
CREATE TRIGGER update_sophia_campanhas_updated_at
  BEFORE UPDATE ON public.sophia_campanhas
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Tabela de status do gateway (reportado pelo .exe)
CREATE TABLE IF NOT EXISTS public.gateway_status (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  status text DEFAULT 'offline', -- online | offline | qr_pending
  last_heartbeat timestamptz DEFAULT now(),
  phone_number text,
  gateway_version text,
  ip_type text DEFAULT 'residential',
  metadata jsonb,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

ALTER TABLE public.gateway_status ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own gateway status"
  ON public.gateway_status FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Allow all inserts and updates for gateway status"
  ON public.gateway_status FOR ALL
  USING (true)
  WITH CHECK (true);

CREATE TRIGGER update_gateway_status_updated_at
  BEFORE UPDATE ON public.gateway_status
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime for gateway_status and fila_atendimento_pj
ALTER PUBLICATION supabase_realtime ADD TABLE public.gateway_status;
ALTER PUBLICATION supabase_realtime ADD TABLE public.sophia_campanhas;
