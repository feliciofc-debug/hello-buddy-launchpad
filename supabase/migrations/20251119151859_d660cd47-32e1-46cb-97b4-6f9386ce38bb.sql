-- Tabela de conversas do WhatsApp
CREATE TABLE whatsapp_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_number TEXT NOT NULL,
  user_id UUID REFERENCES auth.users(id),
  campaign_id UUID REFERENCES campanhas_prospeccao(id),
  lead_id UUID,
  status TEXT DEFAULT 'active' CHECK (status IN ('active', 'transferred', 'closed')),
  last_message_at TIMESTAMPTZ DEFAULT now(),
  transferred_to_human BOOLEAN DEFAULT false,
  transferred_at TIMESTAMPTZ,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de mensagens da conversa
CREATE TABLE whatsapp_conversation_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID REFERENCES whatsapp_conversations(id) ON DELETE CASCADE,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant', 'system')),
  content TEXT NOT NULL,
  wuzapi_message_id TEXT,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Tabela de configuração de IA por campanha
CREATE TABLE campaign_ai_configs (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  campaign_id UUID REFERENCES campanhas_prospeccao(id) ON DELETE CASCADE UNIQUE,
  user_id UUID REFERENCES auth.users(id),
  
  -- Identidade da IA
  ai_identity TEXT DEFAULT 'Assistente Virtual',
  
  -- Contexto do negócio
  company_name TEXT,
  product_or_service TEXT,
  target_audience TEXT,
  
  -- Objetivo da conversa
  conversation_goal TEXT,
  
  -- Regras customizadas
  custom_rules TEXT,
  
  -- Configurações de transbordo
  transfer_to_human_keywords TEXT[] DEFAULT ARRAY['falar com humano', 'falar com pessoa', 'atendente']::TEXT[],
  
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX idx_conversations_phone ON whatsapp_conversations(phone_number);
CREATE INDEX idx_conversations_status ON whatsapp_conversations(status);
CREATE INDEX idx_conversation_messages_conversation_id ON whatsapp_conversation_messages(conversation_id);
CREATE INDEX idx_conversation_messages_created_at ON whatsapp_conversation_messages(created_at);

-- RLS Policies
ALTER TABLE whatsapp_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE whatsapp_conversation_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE campaign_ai_configs ENABLE ROW LEVEL SECURITY;

-- Conversas
CREATE POLICY "Users can view own conversations"
  ON whatsapp_conversations FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "System can manage conversations"
  ON whatsapp_conversations FOR ALL
  USING (true);

-- Mensagens
CREATE POLICY "Users can view messages from own conversations"
  ON whatsapp_conversation_messages FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM whatsapp_conversations
      WHERE whatsapp_conversations.id = conversation_id
      AND whatsapp_conversations.user_id = auth.uid()
    )
  );

CREATE POLICY "System can manage messages"
  ON whatsapp_conversation_messages FOR ALL
  USING (true);

-- Config de IA
CREATE POLICY "Users can manage own campaign AI configs"
  ON campaign_ai_configs FOR ALL
  USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_conversations_updated_at
  BEFORE UPDATE ON whatsapp_conversations
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_campaign_ai_configs_updated_at
  BEFORE UPDATE ON campaign_ai_configs
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();