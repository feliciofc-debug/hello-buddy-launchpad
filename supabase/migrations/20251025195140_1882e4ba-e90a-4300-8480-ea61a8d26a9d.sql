-- Adiciona as colunas para as credenciais da Lomadee na tabela 'integrations'
ALTER TABLE public.integrations
ADD COLUMN IF NOT EXISTS lomadee_app_token text,
ADD COLUMN IF NOT EXISTS lomadee_source_id text,
ADD COLUMN IF NOT EXISTS lomadee_connected_at timestamptz;