-- Criar tabela de integrações para armazenar tokens da Meta e outras plataformas
CREATE TABLE IF NOT EXISTS public.integrations (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform text NOT NULL,
  access_token text NOT NULL,
  meta_user_id text,
  meta_user_name text,
  meta_user_email text,
  token_expires_at timestamp with time zone,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now(),
  UNIQUE(user_id, platform)
);

-- Habilitar RLS
ALTER TABLE public.integrations ENABLE ROW LEVEL SECURITY;

-- Política para usuários verem suas próprias integrações
CREATE POLICY "Usuários podem ver suas próprias integrações"
ON public.integrations
FOR SELECT
USING (auth.uid() = user_id);

-- Política para usuários criarem suas próprias integrações
CREATE POLICY "Usuários podem criar suas próprias integrações"
ON public.integrations
FOR INSERT
WITH CHECK (auth.uid() = user_id);

-- Política para usuários atualizarem suas próprias integrações
CREATE POLICY "Usuários podem atualizar suas próprias integrações"
ON public.integrations
FOR UPDATE
USING (auth.uid() = user_id);

-- Política para permitir que o sistema (service role) faça upsert
CREATE POLICY "Sistema pode gerenciar integrações"
ON public.integrations
FOR ALL
USING (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_integrations_updated_at
BEFORE UPDATE ON public.integrations
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();