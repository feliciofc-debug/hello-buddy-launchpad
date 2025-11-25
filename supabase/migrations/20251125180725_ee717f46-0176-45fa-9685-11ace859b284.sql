-- Adicionar constraint única para evitar duplicatas de grupos por usuário
ALTER TABLE whatsapp_groups 
ADD CONSTRAINT whatsapp_groups_user_group_unique 
UNIQUE (user_id, group_id);