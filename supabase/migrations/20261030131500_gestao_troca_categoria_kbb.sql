-- Categoria KBB para deep link na ficha de troca

ALTER TABLE public.gestao_troca
  ADD COLUMN IF NOT EXISTS categoria text NULL
  CHECK (
    categoria IS NULL OR categoria IN (
      'hatchback',
      'seda',
      'suv-crossover',
      'picape',
      'cupe',
      'minivan',
      'conversivel',
      'perua',
      'utilitario'
    )
  );
