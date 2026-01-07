-- Tabela para histórico de conversas do assistente AMZ Ofertas
CREATE TABLE IF NOT EXISTS public.afiliado_conversas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('user', 'assistant')),
  content TEXT NOT NULL,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Índice para buscar conversas por telefone
CREATE INDEX IF NOT EXISTS idx_afiliado_conversas_phone ON public.afiliado_conversas(phone);
CREATE INDEX IF NOT EXISTS idx_afiliado_conversas_created ON public.afiliado_conversas(created_at DESC);

-- RLS
ALTER TABLE public.afiliado_conversas ENABLE ROW LEVEL SECURITY;

-- Política para service role (edge functions)
CREATE POLICY "Service role full access conversas" ON public.afiliado_conversas
FOR ALL USING (true) WITH CHECK (true);