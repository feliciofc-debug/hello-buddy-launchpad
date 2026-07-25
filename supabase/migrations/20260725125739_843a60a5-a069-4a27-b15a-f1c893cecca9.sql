-- 1) Dedup: manter o row mais antigo (MIN id) de cada (lista_id, telefone)
DELETE FROM public.pj_lista_membros a
USING public.pj_lista_membros b
WHERE a.lista_id = b.lista_id
  AND a.telefone = b.telefone
  AND a.id > b.id;

-- 2) Índices de idempotência
CREATE UNIQUE INDEX IF NOT EXISTS pj_listas_categoria_user_nome_uniq
  ON public.pj_listas_categoria (user_id, nome);

CREATE UNIQUE INDEX IF NOT EXISTS pj_lista_membros_lista_tel_uniq
  ON public.pj_lista_membros (lista_id, telefone);