-- =========================================================
-- FASE 1: MODO ENGAJAMENTO FACEBOOK — SCHEMA
-- =========================================================

-- 1. Colunas novas em produtos
ALTER TABLE public.produtos
  ADD COLUMN IF NOT EXISTS modo_postagem_fb text NOT NULL DEFAULT 'promocional',
  ADD COLUMN IF NOT EXISTS engajamento_estilos text[] NOT NULL 
    DEFAULT ARRAY['escassez','curiosidade','pergunta','polemica','dado','tabu'];

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'produtos_modo_postagem_fb_check'
  ) THEN
    ALTER TABLE public.produtos
      ADD CONSTRAINT produtos_modo_postagem_fb_check 
      CHECK (modo_postagem_fb IN ('promocional','engajamento'));
  END IF;
END$$;

-- 2. Blacklist (contexto-aware: termo_simples + regex_pattern)
CREATE TABLE IF NOT EXISTS public.engagement_blacklist (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  termo_simples text,
  regex_pattern text,
  categoria text NOT NULL,
  descricao text,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT engagement_blacklist_pelo_menos_um CHECK (
    termo_simples IS NOT NULL OR regex_pattern IS NOT NULL
  ),
  CONSTRAINT engagement_blacklist_categoria_check CHECK (
    categoria IN ('conspiracao','claim_contextual','medico_absoluto','fake_news','depreciativo')
  )
);

CREATE UNIQUE INDEX IF NOT EXISTS engagement_blacklist_termo_simples_uniq
  ON public.engagement_blacklist (lower(termo_simples))
  WHERE termo_simples IS NOT NULL;

ALTER TABLE public.engagement_blacklist ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Admins gerenciam blacklist" ON public.engagement_blacklist;
CREATE POLICY "Admins gerenciam blacklist" ON public.engagement_blacklist
  FOR ALL
  USING (public.has_role(auth.uid(),'admin'))
  WITH CHECK (public.has_role(auth.uid(),'admin'));

DROP POLICY IF EXISTS "Authenticated leem blacklist" ON public.engagement_blacklist;
CREATE POLICY "Authenticated leem blacklist" ON public.engagement_blacklist
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- 3. Logs de geração
CREATE TABLE IF NOT EXISTS public.engagement_post_logs (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  produto_id uuid REFERENCES public.produtos(id) ON DELETE CASCADE,
  user_id uuid NOT NULL,
  estilo_usado text,
  tentativas integer NOT NULL DEFAULT 1,
  caption_final text,
  fallback_para_promocional boolean NOT NULL DEFAULT false,
  motivo_fallback text,
  tipo_chamada text NOT NULL DEFAULT 'autopilot',
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT engagement_post_logs_tipo_chamada_check CHECK (
    tipo_chamada IN ('autopilot','preview','manual')
  )
);

CREATE INDEX IF NOT EXISTS engagement_post_logs_user_idx
  ON public.engagement_post_logs (user_id, created_at DESC);

CREATE INDEX IF NOT EXISTS engagement_post_logs_produto_idx
  ON public.engagement_post_logs (produto_id, created_at DESC);

ALTER TABLE public.engagement_post_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Users veem seus logs" ON public.engagement_post_logs;
CREATE POLICY "Users veem seus logs" ON public.engagement_post_logs
  FOR SELECT
  USING (auth.uid() = user_id);

DROP POLICY IF EXISTS "Service insere logs" ON public.engagement_post_logs;
CREATE POLICY "Service insere logs" ON public.engagement_post_logs
  FOR INSERT
  WITH CHECK (true);

-- 4. SEED inicial — 2 camadas
-- Camada 1: termos ABSOLUTOS (string match)
INSERT INTO public.engagement_blacklist (termo_simples, categoria, descricao) VALUES
  ('proibido','conspiracao','Termo de teoria conspiratória'),
  ('banido','conspiracao','Sugere produto censurado'),
  ('ilegal','conspiracao','Claim ilegal'),
  ('censurado','conspiracao','Sugere censura'),
  ('médicos odeiam','medico_absoluto','Clickbait médico clássico'),
  ('medicos odeiam','medico_absoluto','Variação sem acento'),
  ('governo quer banir','conspiracao','Conspiração governo'),
  ('conspiração','conspiracao','Termo direto'),
  ('conspiracao','conspiracao','Variação sem acento'),
  ('fda aprovou','medico_absoluto','Instituição falsa'),
  ('anvisa proibiu','medico_absoluto','Instituição falsa'),
  ('anvisa aprovou','medico_absoluto','Instituição falsa'),
  ('oms recomenda','medico_absoluto','Instituição falsa'),
  ('100% garantido','fake_news','Promessa absoluta'),
  ('100 por cento garantido','fake_news','Promessa absoluta'),
  ('milagroso','fake_news','Promessa absoluta'),
  ('milagrosa','fake_news','Promessa absoluta'),
  ('resultado milagroso','fake_news','Promessa absoluta'),
  ('melhor que amazon','depreciativo','Comparação com marca real'),
  ('melhor que magalu','depreciativo','Comparação com marca real'),
  ('melhor que mercado livre','depreciativo','Comparação com marca real'),
  ('melhor que magazine luiza','depreciativo','Comparação com marca real')
ON CONFLICT DO NOTHING;

-- Camada 2: REGEX contextuais (permite o termo no nome do produto, bloqueia em afirmação)
INSERT INTO public.engagement_blacklist (regex_pattern, categoria, descricao) VALUES
  ('\b(produto|fórmula|formula|composto|creme|pomada)\s+(cura|trata|elimina)\b','claim_contextual','Bloqueia claim médico em contexto de afirmação'),
  ('\b(emagrec\w+)\s+sem\s+(dieta|exercício|exercicio)\b','claim_contextual','Promessa de emagrecimento sem esforço'),
  ('\b(queima\s+gordura)\s+(rápido|rapido|em\s+\d+)\b','claim_contextual','Promessa de queima rápida'),
  ('\b(cura)\s+(definitiva|garantida|comprovada|para\s+sempre)\b','claim_contextual','Cura absoluta'),
  ('\b(elimina)\s+(rugas|celulite|estrias)\s+(em|para\s+sempre)\b','claim_contextual','Eliminação cosmética absoluta'),
  ('\b(perde|perca)\s+\d+\s*(kg|quilos)\s+em\s+\d+','claim_contextual','Promessa numérica de emagrecimento')
ON CONFLICT DO NOTHING;