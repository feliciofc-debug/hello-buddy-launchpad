-- Criar tabela para solicitações de exclusão de dados
CREATE TABLE IF NOT EXISTS public.deletion_requests (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  reason TEXT,
  status TEXT NOT NULL DEFAULT 'pending',
  error_message TEXT,
  requested_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  completed_at TIMESTAMP WITH TIME ZONE
);

-- Criar índice para melhorar performance de consultas por status
CREATE INDEX IF NOT EXISTS idx_deletion_requests_status ON public.deletion_requests(status);

-- Criar índice para consultas por email
CREATE INDEX IF NOT EXISTS idx_deletion_requests_email ON public.deletion_requests(email);

-- Habilitar RLS
ALTER TABLE public.deletion_requests ENABLE ROW LEVEL SECURITY;

-- Política para permitir que qualquer pessoa insira solicitações (página pública)
CREATE POLICY "Qualquer pessoa pode criar solicitação de exclusão"
ON public.deletion_requests
FOR INSERT
WITH CHECK (true);

-- Política para usuários verem apenas suas próprias solicitações
CREATE POLICY "Usuários podem ver suas próprias solicitações"
ON public.deletion_requests
FOR SELECT
USING (auth.uid() = user_id OR email = auth.email());

-- Política para sistema atualizar status das solicitações
CREATE POLICY "Sistema pode atualizar solicitações"
ON public.deletion_requests
FOR UPDATE
USING (true);