-- Tabela para validações de pedidos
CREATE TABLE IF NOT EXISTS public.validacoes_pedidos (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  numero_pedido TEXT NOT NULL,
  whatsapp_cliente TEXT NOT NULL,
  nome_cliente TEXT,
  produto_nome TEXT,
  valor_compra NUMERIC,
  data_compra DATE,
  status TEXT NOT NULL DEFAULT 'pendente',
  imagem_url TEXT,
  dados_ia JSONB DEFAULT '{}',
  confianca_ia INTEGER,
  ebook_enviado BOOLEAN DEFAULT false,
  message_id TEXT,
  instance_name TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now(),
  validated_at TIMESTAMPTZ,
  validated_by UUID REFERENCES auth.users(id)
);

-- Tabela para logs de análise IA
CREATE TABLE IF NOT EXISTS public.logs_analise_ia (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo TEXT NOT NULL,
  whatsapp_cliente TEXT,
  confianca INTEGER,
  dados_extraidos JSONB,
  erro TEXT,
  tempo_processamento INTEGER,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- Índices para performance
CREATE INDEX IF NOT EXISTS idx_validacoes_numero_pedido ON public.validacoes_pedidos(numero_pedido);
CREATE INDEX IF NOT EXISTS idx_validacoes_whatsapp ON public.validacoes_pedidos(whatsapp_cliente);
CREATE INDEX IF NOT EXISTS idx_validacoes_status ON public.validacoes_pedidos(status);
CREATE INDEX IF NOT EXISTS idx_logs_tipo ON public.logs_analise_ia(tipo);
CREATE INDEX IF NOT EXISTS idx_logs_created_at ON public.logs_analise_ia(created_at);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_validacoes_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER validacoes_pedidos_updated_at
  BEFORE UPDATE ON public.validacoes_pedidos
  FOR EACH ROW
  EXECUTE FUNCTION update_validacoes_updated_at();

-- RLS Policies
ALTER TABLE public.validacoes_pedidos ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.logs_analise_ia ENABLE ROW LEVEL SECURITY;

-- Admin pode ver tudo
CREATE POLICY "Admin pode gerenciar validacoes"
  ON public.validacoes_pedidos
  FOR ALL
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

CREATE POLICY "Admin pode ver logs"
  ON public.logs_analise_ia
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM public.user_roles
      WHERE user_id = auth.uid() AND role = 'admin'
    )
  );

-- Sistema pode inserir
CREATE POLICY "Sistema pode inserir validacoes"
  ON public.validacoes_pedidos
  FOR INSERT
  WITH CHECK (true);

CREATE POLICY "Sistema pode inserir logs"
  ON public.logs_analise_ia
  FOR INSERT
  WITH CHECK (true);