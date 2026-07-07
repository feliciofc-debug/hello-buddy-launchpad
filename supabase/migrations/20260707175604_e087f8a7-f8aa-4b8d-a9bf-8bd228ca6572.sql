
-- ============================================================================
-- BASE DE CONHECIMENTO POR SEGMENTO — travas rígidas + conhecimento consultável
-- Arquitetura: 1 segmento (ex: Ademicon) herda para N consultores.
-- ============================================================================

-- 1) SEGMENTS
CREATE TABLE public.agent_knowledge_segments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  descricao TEXT,
  ativo BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.agent_knowledge_segments TO authenticated;
GRANT ALL ON public.agent_knowledge_segments TO service_role;

ALTER TABLE public.agent_knowledge_segments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "segments: authenticated pode ler ativos"
  ON public.agent_knowledge_segments FOR SELECT
  TO authenticated
  USING (ativo = true);

CREATE POLICY "segments: service_role gerencia tudo"
  ON public.agent_knowledge_segments FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_agent_knowledge_segments_updated_at
  BEFORE UPDATE ON public.agent_knowledge_segments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 2) RULES (TRAVAS INVIOLÁVEIS)
CREATE TABLE public.agent_knowledge_rules (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES public.agent_knowledge_segments(id) ON DELETE CASCADE,
  ordem INT NOT NULL DEFAULT 0,
  regra TEXT NOT NULL,
  motivo TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_knowledge_rules_segment ON public.agent_knowledge_rules(segment_id, ordem) WHERE ativa = true;

GRANT SELECT ON public.agent_knowledge_rules TO authenticated;
GRANT ALL ON public.agent_knowledge_rules TO service_role;

ALTER TABLE public.agent_knowledge_rules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "rules: authenticated pode ler ativas"
  ON public.agent_knowledge_rules FOR SELECT
  TO authenticated
  USING (ativa = true);

CREATE POLICY "rules: service_role gerencia tudo"
  ON public.agent_knowledge_rules FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_agent_knowledge_rules_updated_at
  BEFORE UPDATE ON public.agent_knowledge_rules
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 3) TOPICS (CONHECIMENTO CONSULTÁVEL)
CREATE TABLE public.agent_knowledge_topics (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  segment_id UUID NOT NULL REFERENCES public.agent_knowledge_segments(id) ON DELETE CASCADE,
  titulo TEXT NOT NULL,
  tags TEXT[] NOT NULL DEFAULT '{}',
  conteudo_tecnico TEXT,
  traducao_leve TEXT NOT NULL,
  exemplo TEXT,
  ativa BOOLEAN NOT NULL DEFAULT true,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_agent_knowledge_topics_segment ON public.agent_knowledge_topics(segment_id) WHERE ativa = true;
CREATE INDEX idx_agent_knowledge_topics_tags ON public.agent_knowledge_topics USING GIN(tags);

GRANT SELECT ON public.agent_knowledge_topics TO authenticated;
GRANT ALL ON public.agent_knowledge_topics TO service_role;

ALTER TABLE public.agent_knowledge_topics ENABLE ROW LEVEL SECURITY;

CREATE POLICY "topics: authenticated pode ler ativas"
  ON public.agent_knowledge_topics FOR SELECT
  TO authenticated
  USING (ativa = true);

CREATE POLICY "topics: service_role gerencia tudo"
  ON public.agent_knowledge_topics FOR ALL
  TO service_role
  USING (true) WITH CHECK (true);

CREATE TRIGGER update_agent_knowledge_topics_updated_at
  BEFORE UPDATE ON public.agent_knowledge_topics
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4) LIGAÇÃO CONSULTOR → SEGMENTO
ALTER TABLE public.whatsapp_cloud_agent_config
  ADD COLUMN IF NOT EXISTS knowledge_segment_id UUID
    REFERENCES public.agent_knowledge_segments(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_whatsapp_cloud_agent_config_segment
  ON public.whatsapp_cloud_agent_config(knowledge_segment_id)
  WHERE knowledge_segment_id IS NOT NULL;


-- 5) SEED INICIAL — segmento Ademicon vazio, pronto para receber conteúdo
INSERT INTO public.agent_knowledge_segments (slug, nome, descricao)
VALUES (
  'consorcio_ademicon',
  'Consórcio Ademicon',
  'Base de conhecimento e travas de compliance para consultores da Ademicon. Travas invioláveis protegem contra promessas de contemplação, garantias de prazo e qualquer alegação que possa gerar processo no MP/Bacen.'
)
ON CONFLICT (slug) DO NOTHING;
