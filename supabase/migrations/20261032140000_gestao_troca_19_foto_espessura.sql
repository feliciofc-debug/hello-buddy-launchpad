-- JARVIS-TROCA-1.9: laudo foto a foto, roteiro, espessura

ALTER TABLE public.gestao_troca_analise_ia
  ADD COLUMN IF NOT EXISTS fotos_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS estrutura_json jsonb NULL,
  ADD COLUMN IF NOT EXISTS progresso_foto integer NULL,
  ADD COLUMN IF NOT EXISTS progresso_total integer NULL;

ALTER TABLE public.gestao_troca
  ADD COLUMN IF NOT EXISTS espessura_json jsonb NULL;

ALTER TABLE public.gestao_troca_config
  ADD COLUMN IF NOT EXISTS espessura_original_max integer NOT NULL DEFAULT 180,
  ADD COLUMN IF NOT EXISTS espessura_repintura_max integer NOT NULL DEFAULT 300;
