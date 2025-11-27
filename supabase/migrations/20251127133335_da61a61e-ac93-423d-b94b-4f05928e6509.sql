-- Criar tabela de configuração da empresa
CREATE TABLE IF NOT EXISTS public.empresa_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE NOT NULL,
  segmento TEXT DEFAULT 'outros',
  nome_empresa TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Habilitar RLS
ALTER TABLE public.empresa_config ENABLE ROW LEVEL SECURITY;

-- Política para usuários gerenciarem sua própria config
CREATE POLICY "users_own_empresa_config"
ON public.empresa_config FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);