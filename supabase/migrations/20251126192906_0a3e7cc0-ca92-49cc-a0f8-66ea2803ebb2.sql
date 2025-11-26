-- Adicionar campo "origem" nas tabelas de conversas
ALTER TABLE whatsapp_conversations 
ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'campanha';

ALTER TABLE whatsapp_messages 
ADD COLUMN IF NOT EXISTS origem TEXT DEFAULT 'campanha';

-- Criar índices para melhor performance
CREATE INDEX IF NOT EXISTS idx_conversations_origem ON whatsapp_conversations(user_id, origem);
CREATE INDEX IF NOT EXISTS idx_messages_origem ON whatsapp_messages(user_id, origem);

-- Comentários
COMMENT ON COLUMN whatsapp_conversations.origem IS 'Tipo de conversa: campanha (produtos) ou prospeccao (leads B2B/B2C)';
COMMENT ON COLUMN whatsapp_messages.origem IS 'Tipo de conversa: campanha (produtos) ou prospeccao (leads B2B/B2C)';