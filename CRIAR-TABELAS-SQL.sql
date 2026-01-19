-- ============================================
-- SCRIPT PARA CRIAR TABELAS NO SUPABASE
-- ============================================
-- Copie TODO este código e cole no SQL Editor do Supabase
-- ============================================

-- 1. Criar função para atualizar updated_at (se não existir)
CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 2. Criar tabela clientes_afiliados
CREATE TABLE IF NOT EXISTS public.clientes_afiliados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  telefone TEXT NOT NULL,
  wuzapi_token TEXT UNIQUE,
  wuzapi_instance_id TEXT,
  wuzapi_jid TEXT,
  status TEXT DEFAULT 'pendente',
  plano TEXT DEFAULT 'afiliado',
  data_cadastro TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  data_conexao_whatsapp TIMESTAMP WITH TIME ZONE,
  afiliado_id UUID,
  nome_assistente TEXT DEFAULT 'Pietro Eugenio',
  assistente_personalidade TEXT,
  amazon_affiliate_tag TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 3. Criar tabela wuzapi_tokens_afiliados
CREATE TABLE IF NOT EXISTS public.wuzapi_tokens_afiliados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  cliente_afiliado_id UUID REFERENCES public.clientes_afiliados(id),
  em_uso BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- 4. Habilitar Row Level Security (RLS)
ALTER TABLE public.clientes_afiliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wuzapi_tokens_afiliados ENABLE ROW LEVEL SECURITY;

-- 5. Criar Policies para clientes_afiliados
DROP POLICY IF EXISTS "Clientes podem ver seus próprios dados" ON public.clientes_afiliados;
CREATE POLICY "Clientes podem ver seus próprios dados"
  ON public.clientes_afiliados FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clientes podem criar seu perfil" ON public.clientes_afiliados;
CREATE POLICY "Clientes podem criar seu perfil"
  ON public.clientes_afiliados FOR INSERT
  WITH CHECK (auth.uid() = user_id);

DROP POLICY IF EXISTS "Clientes podem atualizar seus dados" ON public.clientes_afiliados;
CREATE POLICY "Clientes podem atualizar seus dados"
  ON public.clientes_afiliados FOR UPDATE
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Sistema pode gerenciar clientes" ON public.clientes_afiliados;
CREATE POLICY "Sistema pode gerenciar clientes"
  ON public.clientes_afiliados FOR ALL
  USING (true);

-- 6. Criar Policies para wuzapi_tokens_afiliados
DROP POLICY IF EXISTS "Sistema pode gerenciar tokens" ON public.wuzapi_tokens_afiliados;
CREATE POLICY "Sistema pode gerenciar tokens"
  ON public.wuzapi_tokens_afiliados FOR ALL
  USING (true);

-- 7. Criar Trigger para atualizar updated_at
DROP TRIGGER IF EXISTS update_clientes_afiliados_updated_at ON public.clientes_afiliados;
CREATE TRIGGER update_clientes_afiliados_updated_at
  BEFORE UPDATE ON public.clientes_afiliados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- ============================================
-- PRONTO! As tabelas foram criadas!
-- ============================================
