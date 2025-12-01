-- Adicionar coluna para deduplicação de mensagens
ALTER TABLE whatsapp_messages 
ADD COLUMN wuzapi_message_id TEXT;

-- Criar índice para busca rápida
CREATE INDEX idx_whatsapp_messages_wuzapi_id 
ON whatsapp_messages(wuzapi_message_id);