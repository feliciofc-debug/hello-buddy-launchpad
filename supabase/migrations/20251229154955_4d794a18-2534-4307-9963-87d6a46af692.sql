-- Tabela de produtos importados pelos afiliados
CREATE TABLE public.afiliado_produtos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  imagem_url TEXT,
  preco DECIMAL,
  link_afiliado TEXT NOT NULL,
  marketplace TEXT NOT NULL,
  descricao TEXT,
  status TEXT DEFAULT 'ativo',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de disparos agendados
CREATE TABLE public.afiliado_disparos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  produto_id UUID REFERENCES public.afiliado_produtos(id) ON DELETE CASCADE,
  data_agendada TIMESTAMP WITH TIME ZONE NOT NULL,
  status TEXT DEFAULT 'agendado',
  destinatarios TEXT[],
  tipo_envio TEXT,
  mensagem TEXT,
  data_envio TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de vendas registradas
CREATE TABLE public.afiliado_vendas (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  produto_id UUID REFERENCES public.afiliado_produtos(id) ON DELETE SET NULL,
  valor DECIMAL NOT NULL,
  marketplace TEXT NOT NULL,
  estimativa_comissao DECIMAL,
  comprovante_url TEXT,
  observacao TEXT,
  data_venda TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Tabela de ebooks
CREATE TABLE public.afiliado_ebooks (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  titulo TEXT NOT NULL,
  arquivo_url TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Enable RLS
ALTER TABLE public.afiliado_produtos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliado_disparos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliado_vendas ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliado_ebooks ENABLE ROW LEVEL SECURITY;

-- RLS Policies para afiliado_produtos
CREATE POLICY "Users can view own products" ON public.afiliado_produtos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own products" ON public.afiliado_produtos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own products" ON public.afiliado_produtos
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own products" ON public.afiliado_produtos
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies para afiliado_disparos
CREATE POLICY "Users can view own dispatches" ON public.afiliado_disparos
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own dispatches" ON public.afiliado_disparos
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own dispatches" ON public.afiliado_disparos
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own dispatches" ON public.afiliado_disparos
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies para afiliado_vendas
CREATE POLICY "Users can view own sales" ON public.afiliado_vendas
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own sales" ON public.afiliado_vendas
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own sales" ON public.afiliado_vendas
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own sales" ON public.afiliado_vendas
  FOR DELETE USING (auth.uid() = user_id);

-- RLS Policies para afiliado_ebooks
CREATE POLICY "Users can view own ebooks" ON public.afiliado_ebooks
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can create own ebooks" ON public.afiliado_ebooks
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own ebooks" ON public.afiliado_ebooks
  FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own ebooks" ON public.afiliado_ebooks
  FOR DELETE USING (auth.uid() = user_id);