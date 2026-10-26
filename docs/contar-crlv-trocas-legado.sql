-- DOC-1.1b — inventário somente leitura.
-- Conta, por loja, CRLVs legados ainda referenciados em gestao_troca.fotos_json
-- e existentes no bucket trocas. Não altera nem move qualquer registro/objeto.

WITH referencias_crlv AS (
  SELECT
    troca.user_id,
    troca.id AS troca_id,
    foto->>'path' AS storage_path
  FROM public.gestao_troca AS troca
  CROSS JOIN LATERAL jsonb_array_elements(
    CASE
      WHEN jsonb_typeof(troca.fotos_json) = 'array' THEN troca.fotos_json
      ELSE '[]'::jsonb
    END
  ) AS foto
  WHERE lower(trim(COALESCE(foto->>'etiqueta', ''))) =
    lower('Documento (CRLV)')
    AND COALESCE(foto->>'path', '') <> ''
),
objetos_existentes AS (
  SELECT DISTINCT
    referencia.user_id,
    referencia.troca_id,
    referencia.storage_path
  FROM referencias_crlv AS referencia
  INNER JOIN storage.objects AS objeto
    ON objeto.bucket_id = 'trocas'
   AND objeto.name = referencia.storage_path
)
SELECT
  user_id AS loja_user_id,
  count(DISTINCT troca_id) AS trocas_com_crlv_legado,
  count(*) AS arquivos_crlv_no_bucket_trocas
FROM objetos_existentes
GROUP BY user_id
ORDER BY arquivos_crlv_no_bucket_trocas DESC, loja_user_id;
