CREATE TABLE public.contatos_comerciais (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  nome TEXT NOT NULL,
  empresa TEXT,
  cargo TEXT,
  whatsapp TEXT NOT NULL,
  email TEXT,
  tipo_relacionamento TEXT NOT NULL DEFAULT 'cliente',
  contexto TEXT,
  proximos_passos TEXT,
  tags TEXT[] DEFAULT ARRAY[]::TEXT[],
  ultima_interacao TIMESTAMPTZ,
  permite_jarvis_contatar BOOLEAN NOT NULL DEFAULT true,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_contatos_comerciais_user ON public.contatos_comerciais(user_id);
CREATE INDEX idx_contatos_comerciais_whatsapp ON public.contatos_comerciais(whatsapp);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.contatos_comerciais TO authenticated;
GRANT ALL ON public.contatos_comerciais TO service_role;

ALTER TABLE public.contatos_comerciais ENABLE ROW LEVEL SECURITY;

CREATE POLICY "own contatos comerciais select" ON public.contatos_comerciais
  FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "own contatos comerciais insert" ON public.contatos_comerciais
  FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own contatos comerciais update" ON public.contatos_comerciais
  FOR UPDATE USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY "own contatos comerciais delete" ON public.contatos_comerciais
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_contatos_comerciais_updated_at
  BEFORE UPDATE ON public.contatos_comerciais
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();