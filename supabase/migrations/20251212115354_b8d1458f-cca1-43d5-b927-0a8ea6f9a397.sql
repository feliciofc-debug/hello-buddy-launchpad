-- Adicionar constraint UNIQUE na coluna whatsapp da tabela cadastros
-- Isso é necessário para o trigger sync_optin_to_cadastro funcionar com ON CONFLICT

ALTER TABLE public.cadastros 
ADD CONSTRAINT cadastros_whatsapp_unique UNIQUE (whatsapp);