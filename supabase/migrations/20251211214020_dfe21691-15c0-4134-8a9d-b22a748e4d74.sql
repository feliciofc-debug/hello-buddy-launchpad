-- 1. Sessões Ativas (controle de conversas em andamento)
CREATE TABLE IF NOT EXISTS sessoes_ativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp text NOT NULL UNIQUE,
  tipo text,
  ultima_interacao timestamp with time zone DEFAULT now(),
  ativa boolean DEFAULT true,
  dispositivo text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_sessoes_whatsapp ON sessoes_ativas(whatsapp);
CREATE INDEX IF NOT EXISTS idx_sessoes_ativa ON sessoes_ativas(ativa);

-- Enable RLS
ALTER TABLE sessoes_ativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage sessoes" ON sessoes_ativas FOR ALL USING (true);

-- 2. Campanhas Ativas (tracking de campanhas aguardando resposta)
CREATE TABLE IF NOT EXISTS campanhas_ativas (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  cliente_id uuid,
  whatsapp text NOT NULL,
  tipo text,
  mensagem text,
  enviado_em timestamp with time zone DEFAULT now(),
  aguardando_resposta boolean DEFAULT true,
  respondeu boolean DEFAULT false,
  pausado boolean DEFAULT false,
  created_at timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_campanhas_ativas_whatsapp ON campanhas_ativas(whatsapp);
CREATE INDEX IF NOT EXISTS idx_campanhas_ativas_aguardando ON campanhas_ativas(aguardando_resposta);

-- Enable RLS
ALTER TABLE campanhas_ativas ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage campanhas_ativas" ON campanhas_ativas FOR ALL USING (true);

-- 3. Histórico de Envios (para cooldown)
CREATE TABLE IF NOT EXISTS historico_envios (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  whatsapp text NOT NULL,
  tipo text,
  mensagem text,
  sucesso boolean DEFAULT true,
  erro text,
  timestamp timestamp with time zone DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_historico_envios_whatsapp ON historico_envios(whatsapp);
CREATE INDEX IF NOT EXISTS idx_historico_envios_timestamp ON historico_envios(timestamp);

-- Enable RLS
ALTER TABLE historico_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "System can manage historico_envios" ON historico_envios FOR ALL USING (true);

-- Trigger para updated_at em sessoes_ativas
CREATE TRIGGER trigger_sessoes_updated
BEFORE UPDATE ON sessoes_ativas
FOR EACH ROW
EXECUTE FUNCTION update_updated_at_column();