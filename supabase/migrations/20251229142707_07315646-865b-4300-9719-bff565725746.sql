-- Tabela de afiliados (quem indica)
CREATE TABLE public.afiliados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  email TEXT NOT NULL,
  codigo_referencia TEXT UNIQUE NOT NULL,
  taxa_comissao DECIMAL DEFAULT 0.30,
  total_indicacoes INTEGER DEFAULT 0,
  total_comissoes DECIMAL DEFAULT 0.00,
  conta_bancaria JSONB DEFAULT '{}'::jsonb,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de clientes afiliados (quem paga R$ 199/mês)
CREATE TABLE public.clientes_afiliados (
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
  afiliado_id UUID REFERENCES public.afiliados(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de comissões
CREATE TABLE public.comissoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  afiliado_id UUID REFERENCES public.afiliados(id) ON DELETE CASCADE,
  cliente_id UUID REFERENCES public.clientes_afiliados(id) ON DELETE CASCADE,
  valor DECIMAL NOT NULL,
  mes_referencia TEXT NOT NULL,
  status TEXT DEFAULT 'pendente',
  data_pagamento TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de tokens Wuzapi disponíveis
CREATE TABLE public.wuzapi_tokens_afiliados (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token TEXT UNIQUE NOT NULL,
  cliente_afiliado_id UUID REFERENCES public.clientes_afiliados(id),
  em_uso BOOLEAN DEFAULT false,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.afiliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clientes_afiliados ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.comissoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.wuzapi_tokens_afiliados ENABLE ROW LEVEL SECURITY;

-- Policies para afiliados
CREATE POLICY "Afiliados podem ver seus próprios dados"
  ON public.afiliados FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Afiliados podem criar seu perfil"
  ON public.afiliados FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Afiliados podem atualizar seus dados"
  ON public.afiliados FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Código de referência público para lookup"
  ON public.afiliados FOR SELECT
  USING (true);

-- Policies para clientes_afiliados
CREATE POLICY "Clientes podem ver seus próprios dados"
  ON public.clientes_afiliados FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Clientes podem criar seu perfil"
  ON public.clientes_afiliados FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Clientes podem atualizar seus dados"
  ON public.clientes_afiliados FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode gerenciar clientes"
  ON public.clientes_afiliados FOR ALL
  USING (true);

-- Policies para comissões
CREATE POLICY "Afiliados podem ver suas comissões"
  ON public.comissoes FOR SELECT
  USING (
    afiliado_id IN (SELECT id FROM public.afiliados WHERE user_id = auth.uid())
  );

CREATE POLICY "Sistema pode gerenciar comissões"
  ON public.comissoes FOR ALL
  USING (true);

-- Policies para tokens
CREATE POLICY "Sistema pode gerenciar tokens"
  ON public.wuzapi_tokens_afiliados FOR ALL
  USING (true);

-- Triggers para updated_at
CREATE TRIGGER update_afiliados_updated_at
  BEFORE UPDATE ON public.afiliados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_clientes_afiliados_updated_at
  BEFORE UPDATE ON public.clientes_afiliados
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();