-- JARVIS-TROCA-1.9.1: achado_ref + serviço sugerido

ALTER TABLE public.gestao_troca_ia_item
  ADD COLUMN IF NOT EXISTS achado_ref text NULL,
  ADD COLUMN IF NOT EXISTS servico text NULL;

ALTER TABLE public.gestao_troca_ia_item
  DROP CONSTRAINT IF EXISTS gestao_troca_ia_item_servico_check;

ALTER TABLE public.gestao_troca_ia_item
  ADD CONSTRAINT gestao_troca_ia_item_servico_check CHECK (
    servico IS NULL OR servico IN (
      'nenhum', 'funilaria', 'pintura', 'substituicao', 'martelinho', 'higienizacao', 'mecanica'
    )
  );
