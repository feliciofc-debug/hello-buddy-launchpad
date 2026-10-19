-- Laudo IA — análise de fotos da troca, itens sugeridos e tabela de custos por loja

CREATE TABLE IF NOT EXISTS public.gestao_troca_analise_ia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  troca_id uuid NOT NULL REFERENCES public.gestao_troca(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  status text NOT NULL DEFAULT 'processando'
    CHECK (status IN ('processando', 'concluida', 'erro')),
  km_painel_lido integer NULL,
  km_ficha integer NULL,
  alerta_km boolean NOT NULL DEFAULT false,
  aviso_carroceria boolean NOT NULL DEFAULT false,
  luzes_painel boolean NULL,
  resumo text NULL,
  qualidade_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  modelo_ia text NULL,
  erro text NULL,
  total_preparacao numeric(14, 2) NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  concluida_em timestamptz NULL
);

CREATE INDEX IF NOT EXISTS gestao_troca_analise_ia_troca_idx
  ON public.gestao_troca_analise_ia (troca_id, created_at DESC);

CREATE INDEX IF NOT EXISTS gestao_troca_analise_ia_user_dia_idx
  ON public.gestao_troca_analise_ia (user_id, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gestao_troca_ia_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  analise_id uuid NOT NULL REFERENCES public.gestao_troca_analise_ia(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  troca_id uuid NOT NULL REFERENCES public.gestao_troca(id) ON DELETE CASCADE,
  ordem integer NOT NULL DEFAULT 0,
  area text NOT NULL,
  tipo text NOT NULL,
  gravidade text NOT NULL
    CHECK (gravidade IN ('leve', 'moderada', 'grave')),
  confianca text NOT NULL
    CHECK (confianca IN ('alta', 'media', 'baixa')),
  descricao text NOT NULL,
  categoria_custo text NULL
    CHECK (categoria_custo IS NULL OR categoria_custo IN (
      'mecanica', 'funilaria_pintura', 'pneus', 'estetica', 'outros'
    )),
  valor_estimado numeric(14, 2) NULL,
  decisao text NOT NULL DEFAULT 'pendente'
    CHECK (decisao IN ('pendente', 'aceito', 'ignorado')),
  checklist_key text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gestao_troca_ia_item_analise_idx
  ON public.gestao_troca_ia_item (analise_id, ordem ASC);

CREATE TABLE IF NOT EXISTS public.gestao_troca_custo_reparo (
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria text NOT NULL
    CHECK (categoria IN ('mecanica', 'funilaria_pintura', 'pneus', 'estetica', 'outros')),
  gravidade text NOT NULL
    CHECK (gravidade IN ('leve', 'moderada', 'grave')),
  valor numeric(14, 2) NOT NULL CHECK (valor >= 0),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, categoria, gravidade)
);

ALTER TABLE public.gestao_troca
  ADD COLUMN IF NOT EXISTS km_painel_conferido boolean NOT NULL DEFAULT false;

ALTER TABLE public.gestao_troca_analise_ia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_troca_ia_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_troca_custo_reparo ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.gestao_troca_analise_ia FROM anon;
REVOKE ALL ON public.gestao_troca_ia_item FROM anon;
REVOKE ALL ON public.gestao_troca_custo_reparo FROM anon;

GRANT SELECT ON public.gestao_troca_analise_ia TO authenticated;
GRANT SELECT ON public.gestao_troca_ia_item TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_troca_custo_reparo TO authenticated;

GRANT ALL ON public.gestao_troca_analise_ia TO service_role;
GRANT ALL ON public.gestao_troca_ia_item TO service_role;
GRANT ALL ON public.gestao_troca_custo_reparo TO service_role;

REVOKE INSERT, UPDATE, DELETE ON public.gestao_troca_analise_ia FROM authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.gestao_troca_ia_item FROM authenticated;

DROP POLICY IF EXISTS gestao_troca_analise_ia_select ON public.gestao_troca_analise_ia;
CREATE POLICY gestao_troca_analise_ia_select ON public.gestao_troca_analise_ia
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS gestao_troca_ia_item_select ON public.gestao_troca_ia_item;
CREATE POLICY gestao_troca_ia_item_select ON public.gestao_troca_ia_item
  FOR SELECT TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP POLICY IF EXISTS gestao_troca_custo_reparo_own ON public.gestao_troca_custo_reparo;
CREATE POLICY gestao_troca_custo_reparo_own ON public.gestao_troca_custo_reparo
  FOR ALL TO authenticated
  USING (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  )
  WITH CHECK (
    auth.uid() = user_id
    OR public.has_role(auth.uid(), 'admin'::public.app_role)
  );

DROP TRIGGER IF EXISTS update_gestao_troca_ia_item_updated_at ON public.gestao_troca_ia_item;
CREATE TRIGGER update_gestao_troca_ia_item_updated_at
  BEFORE UPDATE ON public.gestao_troca_ia_item
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_gestao_troca_custo_reparo_updated_at ON public.gestao_troca_custo_reparo;
CREATE TRIGGER update_gestao_troca_custo_reparo_updated_at
  BEFORE UPDATE ON public.gestao_troca_custo_reparo
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
