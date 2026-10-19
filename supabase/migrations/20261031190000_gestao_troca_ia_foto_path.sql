ALTER TABLE public.gestao_troca_ia_item
  ADD COLUMN IF NOT EXISTS foto_path text NULL;

COMMENT ON COLUMN public.gestao_troca_ia_item.foto_path IS
  'Storage path (bucket trocas) da foto que evidencia o item; preenchido pela IA (foto_indice).';
