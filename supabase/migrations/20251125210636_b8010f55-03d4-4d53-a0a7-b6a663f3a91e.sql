-- Adicionar constraint UNIQUE para permitir upsert de contatos
-- Remove duplicatas existentes primeiro (mantém o mais recente)
DELETE FROM whatsapp_contacts a
USING whatsapp_contacts b
WHERE a.id < b.id 
  AND a.user_id = b.user_id 
  AND a.phone = b.phone;

-- Adiciona constraint UNIQUE
ALTER TABLE whatsapp_contacts 
ADD CONSTRAINT whatsapp_contacts_user_phone_unique 
UNIQUE (user_id, phone);