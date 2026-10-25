-- OS-1.5: fotos da OS — anúncio, troca e upload na própria OS

ALTER TABLE public.gestao_os_foto_ref
  ADD COLUMN IF NOT EXISTS origem text NOT NULL DEFAULT 'troca'
    CHECK (origem IN ('troca', 'anuncio', 'os'));

ALTER TABLE public.gestao_os_foto_ref
  ALTER COLUMN troca_id DROP NOT NULL;

ALTER TABLE public.gestao_os_foto_ref
  DROP CONSTRAINT IF EXISTS gestao_os_foto_ref_path_check;

CREATE OR REPLACE FUNCTION public.gestao_os_foto_anuncio_permitida(
  p_user_id uuid,
  p_veiculo_id uuid,
  p_ref text
)
RETURNS boolean
LANGUAGE sql
STABLE
SET search_path = public
AS $$
  SELECT EXISTS (
    SELECT 1
    FROM public.veiculos_estoque v,
         unnest(coalesce(v.fotos, ARRAY[]::text[])) AS foto(url)
    WHERE v.user_id = p_user_id
      AND v.id = p_veiculo_id
      AND trim(foto.url) <> ''
      AND foto.url = trim(p_ref)
  );
$$;

CREATE OR REPLACE FUNCTION public.gestao_os_foto_ref_valida_origem()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  ordem public.gestao_os%ROWTYPE;
BEGIN
  SELECT * INTO ordem
  FROM public.gestao_os
  WHERE user_id = NEW.user_id AND id = NEW.os_id;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'OS não encontrada para esta loja';
  END IF;

  IF NEW.origem = 'troca' THEN
    IF NEW.troca_id IS NULL THEN
      RAISE EXCEPTION 'Foto de troca exige troca_id';
    END IF;
    IF ordem.troca_id IS DISTINCT FROM NEW.troca_id THEN
      RAISE EXCEPTION 'Troca não pertence a esta OS';
    END IF;
    IF NEW.storage_path NOT LIKE NEW.user_id::text || '/' || NEW.troca_id::text || '/%' THEN
      RAISE EXCEPTION 'Caminho da foto de troca inválido';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.origem = 'anuncio' THEN
    NEW.troca_id := NULL;
    IF NOT public.gestao_os_foto_anuncio_permitida(
      NEW.user_id, ordem.veiculo_id, NEW.storage_path
    ) THEN
      RAISE EXCEPTION 'Foto não pertence ao anúncio deste veículo';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW.origem = 'os' THEN
    NEW.troca_id := NULL;
    IF NEW.storage_path NOT LIKE NEW.user_id::text || '/os/' || NEW.os_id::text || '/%' THEN
      RAISE EXCEPTION 'Caminho da foto da OS inválido';
    END IF;
    IF NOT EXISTS (
      SELECT 1 FROM public.gestao_os_documento d
      WHERE d.user_id = NEW.user_id
        AND d.os_id = NEW.os_id
        AND d.storage_path = NEW.storage_path
        AND d.deleted_at IS NULL
        AND d.mime_type LIKE 'image/%'
        AND d.tipo IN ('foto_checkin', 'foto_checkout', 'outro')
    ) THEN
      RAISE EXCEPTION 'Documento de imagem da OS não encontrado';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'Origem de foto inválida';
END;
$$;

CREATE OR REPLACE FUNCTION public.gestao_os_foto_ref_bloqueia_crlv()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
DECLARE
  etiqueta text;
BEGIN
  IF NEW.origem IS DISTINCT FROM 'troca' THEN
    RETURN NEW;
  END IF;
  etiqueta := public.gestao_os_foto_ref_etiqueta_troca(
    NEW.user_id, NEW.troca_id, NEW.storage_path
  );
  IF public.gestao_os_foto_ref_crlv(etiqueta) THEN
    RAISE EXCEPTION 'Documento (CRLV) não pode ser vinculado à OS nem enviado ao parceiro';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS gestao_os_foto_ref_valida_origem ON public.gestao_os_foto_ref;
CREATE TRIGGER gestao_os_foto_ref_valida_origem
  BEFORE INSERT OR UPDATE ON public.gestao_os_foto_ref
  FOR EACH ROW EXECUTE FUNCTION public.gestao_os_foto_ref_valida_origem();

CREATE OR REPLACE FUNCTION public.gestao_os_fotos_sincronizar(p_os_id uuid)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  uid uuid := auth.uid();
  ordem public.gestao_os%ROWTYPE;
  troca public.gestao_troca%ROWTYPE;
  veic public.veiculos_estoque%ROWTYPE;
  inseridas integer := 0;
  n integer;
  idx integer := 0;
BEGIN
  IF uid IS NULL THEN RAISE EXCEPTION 'Não autenticado'; END IF;
  SELECT * INTO ordem FROM public.gestao_os
   WHERE user_id = uid AND id = p_os_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'OS não encontrada'; END IF;

  SELECT * INTO veic FROM public.veiculos_estoque
   WHERE user_id = uid AND id = ordem.veiculo_id;
  IF NOT FOUND THEN RAISE EXCEPTION 'Veículo não encontrado'; END IF;

  IF ordem.troca_id IS NOT NULL THEN
    SELECT * INTO troca FROM public.gestao_troca
     WHERE user_id = uid AND id = ordem.troca_id;
    IF FOUND THEN
      INSERT INTO public.gestao_os_foto_ref (
        user_id, os_id, troca_id, origem, storage_path, troca_ia_item_id, selecionada, ordem
      )
      SELECT
        uid,
        ordem.id,
        troca.id,
        'troca',
        item.foto_path,
        item.id,
        true,
        item.ordem
      FROM public.gestao_troca_ia_item item
      WHERE item.user_id = uid
        AND item.troca_id = troca.id
        AND item.foto_path IS NOT NULL
        AND item.foto_path LIKE uid::text || '/' || troca.id::text || '/%'
        AND NOT public.gestao_os_foto_ref_crlv(
          public.gestao_os_foto_ref_etiqueta_troca(uid, troca.id, item.foto_path)
        )
        AND item.analise_id = (
          SELECT a.id FROM public.gestao_troca_analise_ia a
          WHERE a.user_id = uid AND a.troca_id = troca.id AND a.status = 'concluida'
          ORDER BY a.created_at DESC LIMIT 1
        )
      ON CONFLICT (os_id, storage_path) DO NOTHING;
      GET DIAGNOSTICS n = ROW_COUNT;
      inseridas := inseridas + n;

      INSERT INTO public.gestao_os_foto_ref (
        user_id, os_id, troca_id, origem, storage_path, selecionada, ordem
      )
      SELECT
        uid,
        ordem.id,
        troca.id,
        'troca',
        foto->>'path',
        false,
        (row_number() OVER (ORDER BY foto->>'path'))::integer + 1000
      FROM jsonb_array_elements(coalesce(troca.fotos_json, '[]'::jsonb)) AS foto
      WHERE foto ? 'path'
        AND coalesce(foto->>'path', '') <> ''
        AND foto->>'path' LIKE uid::text || '/' || troca.id::text || '/%'
        AND NOT public.gestao_os_foto_ref_crlv(foto->>'etiqueta')
        AND NOT EXISTS (
          SELECT 1 FROM public.gestao_os_foto_ref r
          WHERE r.os_id = ordem.id AND r.storage_path = foto->>'path'
        )
      ON CONFLICT (os_id, storage_path) DO NOTHING;
      GET DIAGNOSTICS n = ROW_COUNT;
      inseridas := inseridas + n;
    END IF;
  END IF;

  INSERT INTO public.gestao_os_foto_ref (
    user_id, os_id, troca_id, origem, storage_path, selecionada, ordem
  )
  SELECT
    uid,
    ordem.id,
    NULL,
    'anuncio',
    trim(foto.url),
    false,
    (row_number() OVER (ORDER BY foto.ord))::integer
  FROM unnest(coalesce(veic.fotos, ARRAY[]::text[])) WITH ORDINALITY AS foto(url, ord)
  WHERE trim(foto.url) <> ''
    AND NOT EXISTS (
      SELECT 1 FROM public.gestao_os_foto_ref r
      WHERE r.os_id = ordem.id AND r.storage_path = trim(foto.url)
    )
  ON CONFLICT (os_id, storage_path) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  inseridas := inseridas + n;

  INSERT INTO public.gestao_os_foto_ref (
    user_id, os_id, troca_id, origem, storage_path, selecionada, ordem
  )
  SELECT
    uid,
    ordem.id,
    NULL,
    'os',
    d.storage_path,
    false,
    2000 + (row_number() OVER (ORDER BY d.created_at))::integer
  FROM public.gestao_os_documento d
  WHERE d.user_id = uid
    AND d.os_id = ordem.id
    AND d.deleted_at IS NULL
    AND d.mime_type LIKE 'image/%'
    AND d.tipo IN ('foto_checkin', 'foto_checkout', 'outro')
    AND NOT EXISTS (
      SELECT 1 FROM public.gestao_os_foto_ref r
      WHERE r.os_id = ordem.id AND r.storage_path = d.storage_path
    )
  ON CONFLICT (os_id, storage_path) DO NOTHING;
  GET DIAGNOSTICS n = ROW_COUNT;
  inseridas := inseridas + n;

  IF NOT EXISTS (
    SELECT 1 FROM public.gestao_os_foto_ref
    WHERE os_id = ordem.id AND origem = 'troca'
  ) THEN
    UPDATE public.gestao_os_foto_ref r SET selecionada = true
    WHERE r.id IN (
      SELECT id FROM public.gestao_os_foto_ref
      WHERE os_id = ordem.id AND origem = 'anuncio'
      ORDER BY ordem ASC
      LIMIT 4
    );
  END IF;

  RETURN inseridas;
END;
$$;
REVOKE ALL ON FUNCTION public.gestao_os_fotos_sincronizar(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.gestao_os_fotos_sincronizar(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.gestao_os_fotos_sincronizar_troca(p_os_id uuid)
RETURNS integer
LANGUAGE sql
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT public.gestao_os_fotos_sincronizar(p_os_id);
$$;
