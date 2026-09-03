CREATE TABLE public.trilhas_sonoras (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  nome TEXT NOT NULL,
  descricao TEXT,
  mood TEXT NOT NULL DEFAULT 'corporativo',
  duracao_seg NUMERIC(8,2),
  storage_path TEXT NOT NULL,
  licenca TEXT NOT NULL,
  licenca_url TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  CONSTRAINT trilhas_sonoras_mood_check CHECK (mood IN ('energetico', 'corporativo', 'suave', 'inspirador'))
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.trilhas_sonoras TO authenticated;
GRANT ALL ON public.trilhas_sonoras TO service_role;

ALTER TABLE public.trilhas_sonoras ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Trilhas globais e próprias podem ser vistas"
ON public.trilhas_sonoras FOR SELECT
TO authenticated
USING (ativo = true AND (user_id IS NULL OR user_id = auth.uid()));

CREATE POLICY "Usuário pode criar sua própria trilha"
ON public.trilhas_sonoras FOR INSERT
TO authenticated
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuário pode editar sua própria trilha"
ON public.trilhas_sonoras FOR UPDATE
TO authenticated
USING (user_id = auth.uid())
WITH CHECK (user_id = auth.uid());

CREATE POLICY "Usuário pode remover sua própria trilha"
ON public.trilhas_sonoras FOR DELETE
TO authenticated
USING (user_id = auth.uid());

CREATE INDEX trilhas_sonoras_catalogo_idx ON public.trilhas_sonoras (user_id, ativo, mood);

CREATE TRIGGER update_trilhas_sonoras_updated_at
BEFORE UPDATE ON public.trilhas_sonoras
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS trilha_padrao_id UUID REFERENCES public.trilhas_sonoras(id) ON DELETE SET NULL;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.empresa_config TO authenticated;
GRANT ALL ON public.empresa_config TO service_role;