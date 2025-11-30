-- Adicionar campos de login e senha na tabela vendedores
ALTER TABLE public.vendedores 
ADD COLUMN IF NOT EXISTS login TEXT UNIQUE,
ADD COLUMN IF NOT EXISTS senha TEXT;

-- Criar índice para login
CREATE INDEX IF NOT EXISTS idx_vendedores_login ON public.vendedores(login);

-- Atualizar política RLS para permitir leitura por login (sem autenticação)
DROP POLICY IF EXISTS "Vendedores podem fazer login" ON public.vendedores;
CREATE POLICY "Vendedores podem fazer login" 
ON public.vendedores 
FOR SELECT 
USING (true);
