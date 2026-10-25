-- OS-1.6: excluir OS em rascunho/cotação (sem vínculo financeiro)

CREATE OR REPLACE FUNCTION public.gestao_os_excluir(p_os_id uuid)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, storage
AS $$
DECLARE
  uid uuid := auth.uid();
  ordem public.gestao_os%ROWTYPE;
  prefix text;
BEGIN
  IF uid IS NULL THEN
    RAISE EXCEPTION 'Não autenticado';
  END IF;

  SELECT * INTO ordem
  FROM public.gestao_os
  WHERE id = p_os_id AND user_id = uid
  FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada';
  END IF;

  IF ordem.status NOT IN ('rascunho', 'orcamento') THEN
    RAISE EXCEPTION 'OS aprovada não pode ser excluída, apenas cancelada';
  END IF;

  IF ordem.despesa_id IS NOT NULL OR ordem.conta_lancamento_id IS NOT NULL THEN
    RAISE EXCEPTION 'OS com lançamento financeiro não pode ser excluída';
  END IF;

  IF EXISTS (
    SELECT 1 FROM public.gestao_os_cotacao c
    WHERE c.user_id = uid AND c.os_id = ordem.id AND c.status = 'escolhida'
  ) THEN
    RAISE EXCEPTION 'OS com cotação escolhida não pode ser excluída';
  END IF;

  prefix := uid::text || '/os/' || ordem.id::text || '/';

  DELETE FROM public.gestao_os_cotacao_wa_sessao s
  WHERE s.user_id = uid
    AND s.cotacao_id IN (
      SELECT c.id FROM public.gestao_os_cotacao c
      WHERE c.user_id = uid AND c.os_id = ordem.id
    );

  DELETE FROM storage.objects
  WHERE bucket_id = 'gestao-os-documentos'
    AND name LIKE prefix || '%';

  DELETE FROM public.gestao_os
  WHERE id = ordem.id AND user_id = uid;
END;
$$;

REVOKE ALL ON FUNCTION public.gestao_os_excluir(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_excluir(uuid) TO authenticated;
