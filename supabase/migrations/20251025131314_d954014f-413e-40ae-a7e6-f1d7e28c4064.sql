-- Adiciona as colunas para as credenciais da Lomadee na tabela 'integrations'
ALTER TABLE public.integrations
ADD COLUMN IF NOT EXISTS lomadee_app_token text,
ADD COLUMN IF NOT EXISTS lomadee_source_id text;

-- Comentários para documentar as novas colunas
COMMENT ON COLUMN public.integrations.lomadee_app_token IS 'Token de aplicação da Lomadee do usuário';
COMMENT ON COLUMN public.integrations.lomadee_source_id IS 'Source ID da Lomadee do usuário';