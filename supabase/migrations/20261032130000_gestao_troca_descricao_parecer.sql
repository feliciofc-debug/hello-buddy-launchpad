-- JARVIS-TROCA-1.8: laudo descritivo IA + parecer da avaliação

ALTER TABLE public.gestao_troca_analise_ia
  ADD COLUMN IF NOT EXISTS descricao_areas_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS conclusao_visual text NULL;

ALTER TABLE public.gestao_troca
  ADD COLUMN IF NOT EXISTS parecer_json jsonb NULL;
