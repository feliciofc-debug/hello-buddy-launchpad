-- DOC-0 — inventário e redação de descrições antigas de documentos.
-- NÃO é migração. Revise o user_id e rode manualmente dentro de uma transação.
--
-- Locais onde a descrição de visão do fluxo antigo pode ter sido persistida:
--   whatsapp_cloud_messages.content
--   whatsapp_cloud_conversations.agent_state (vision_description e pendências)
--   midias_whatsapp.contexto_original ([visão] ...)
--   produtos.descricao_visual

BEGIN;
SELECT set_config(
  'doc_cleanup.user_id',
  'SUBSTITUA-PELO-UUID-DA-LOJA',
  true
);

-- Contagem solicitada antes da limpeza.
SELECT 'whatsapp_cloud_messages.content' AS local, count(*) AS encontrados
FROM public.whatsapp_cloud_messages
WHERE user_id = current_setting('doc_cleanup.user_id')::uuid
  AND content ~* '(detran|licenciamento|habilita[cç][aã]o|renavam|crlv|foto real de um documento)'
UNION ALL
SELECT 'whatsapp_cloud_conversations.agent_state', count(*)
FROM public.whatsapp_cloud_conversations
WHERE user_id = current_setting('doc_cleanup.user_id')::uuid
  AND agent_state::text ~* '(detran|licenciamento|habilita[cç][aã]o|renavam|crlv|foto real de um documento)'
UNION ALL
SELECT 'midias_whatsapp.contexto_original', count(*)
FROM public.midias_whatsapp
WHERE user_id = current_setting('doc_cleanup.user_id')::uuid
  AND contexto_original ~* '(detran|licenciamento|habilita[cç][aã]o|renavam|crlv|foto real de um documento)'
UNION ALL
SELECT 'produtos.descricao_visual', count(*)
FROM public.produtos
WHERE user_id = current_setting('doc_cleanup.user_id')::uuid
  AND descricao_visual ~* '(detran|licenciamento|habilita[cç][aã]o|renavam|crlv|foto real de um documento)';

CREATE OR REPLACE FUNCTION pg_temp.redigir_descricao_documento(value jsonb)
RETURNS jsonb
LANGUAGE plpgsql
IMMUTABLE
AS $$
DECLARE
  result jsonb;
  item record;
BEGIN
  IF value IS NULL THEN
    RETURN value;
  END IF;
  IF jsonb_typeof(value) = 'string' THEN
    IF trim(both '"' from value::text)
      ~* '(detran|licenciamento|habilita[cç][aã]o|renavam|crlv|foto real de um documento)'
    THEN
      RETURN to_jsonb('[documento removido por segurança]'::text);
    END IF;
    RETURN value;
  END IF;
  IF jsonb_typeof(value) = 'array' THEN
    SELECT coalesce(jsonb_agg(pg_temp.redigir_descricao_documento(element)), '[]')
      INTO result
    FROM jsonb_array_elements(value) AS element;
    RETURN result;
  END IF;
  IF jsonb_typeof(value) = 'object' THEN
    result := '{}'::jsonb;
    FOR item IN SELECT key, val FROM jsonb_each(value) AS entry(key, val)
    LOOP
      result := result || jsonb_build_object(
        item.key,
        CASE
          WHEN item.key IN ('vision_description', 'descricao_visual', 'texto_ocr')
            AND item.val::text
              ~* '(detran|licenciamento|habilita[cç][aã]o|renavam|crlv|foto real de um documento)'
          THEN to_jsonb('[documento removido por segurança]'::text)
          ELSE pg_temp.redigir_descricao_documento(item.val)
        END
      );
    END LOOP;
    RETURN result;
  END IF;
  RETURN value;
END;
$$;

UPDATE public.whatsapp_cloud_messages
SET content = '[documento removido por segurança]'
WHERE user_id = current_setting('doc_cleanup.user_id')::uuid
  AND content ~* '(detran|licenciamento|habilita[cç][aã]o|renavam|crlv|foto real de um documento)';

UPDATE public.whatsapp_cloud_conversations
SET agent_state = pg_temp.redigir_descricao_documento(agent_state)
WHERE user_id = current_setting('doc_cleanup.user_id')::uuid
  AND agent_state::text ~* '(detran|licenciamento|habilita[cç][aã]o|renavam|crlv|foto real de um documento)';

UPDATE public.midias_whatsapp
SET contexto_original = '[documento removido por segurança]'
WHERE user_id = current_setting('doc_cleanup.user_id')::uuid
  AND contexto_original ~* '(detran|licenciamento|habilita[cç][aã]o|renavam|crlv|foto real de um documento)';

UPDATE public.produtos
SET descricao_visual = NULL
WHERE user_id = current_setting('doc_cleanup.user_id')::uuid
  AND descricao_visual ~* '(detran|licenciamento|habilita[cç][aã]o|renavam|crlv|foto real de um documento)';

COMMIT;
