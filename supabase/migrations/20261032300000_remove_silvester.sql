-- SILV-0: remoção definitiva do agente legado Silvester.
-- Aplicar somente após backup e autorização explícita.

DO $$
DECLARE
  target_table regclass;
  dependency record;
BEGIN
  -- Remove views/materialized views que dependam das tabelas, inclusive nomes
  -- que possam ter sido criados manualmente fora das migrações versionadas.
  FOR dependency IN
    SELECT DISTINCT
      namespace.nspname AS schema_name,
      relation.relname AS relation_name,
      relation.relkind
    FROM pg_depend AS dep
    JOIN pg_rewrite AS rewrite ON rewrite.oid = dep.objid
    JOIN pg_class AS relation ON relation.oid = rewrite.ev_class
    JOIN pg_namespace AS namespace ON namespace.oid = relation.relnamespace
    WHERE dep.refobjid = ANY (
      ARRAY_REMOVE(
        ARRAY[
          to_regclass('public.silvester_documentos'),
          to_regclass('public.silvester_dossies')
        ],
        NULL
      )
    )
      AND relation.relkind IN ('v', 'm')
  LOOP
    IF dependency.relkind = 'm' THEN
      EXECUTE format(
        'DROP MATERIALIZED VIEW IF EXISTS %I.%I CASCADE',
        dependency.schema_name,
        dependency.relation_name
      );
    ELSE
      EXECUTE format(
        'DROP VIEW IF EXISTS %I.%I CASCADE',
        dependency.schema_name,
        dependency.relation_name
      );
    END IF;
  END LOOP;

  -- Remove policies e triggers das tabelas somente quando elas existem.
  FOREACH target_table IN ARRAY ARRAY[
    to_regclass('public.silvester_documentos'),
    to_regclass('public.silvester_dossies')
  ]
  LOOP
    IF target_table IS NULL THEN
      CONTINUE;
    END IF;

    FOR dependency IN
      SELECT policy.polname
      FROM pg_policy AS policy
      WHERE policy.polrelid = target_table
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON %s',
        dependency.polname,
        target_table
      );
    END LOOP;

    FOR dependency IN
      SELECT trigger.tgname
      FROM pg_trigger AS trigger
      WHERE trigger.tgrelid = target_table
        AND NOT trigger.tgisinternal
    LOOP
      EXECUTE format(
        'DROP TRIGGER IF EXISTS %I ON %s',
        dependency.tgname,
        target_table
      );
    END LOOP;
  END LOOP;

  -- Remove funções públicas que referenciem as tabelas, inclusive funções
  -- criadas manualmente. Agregados/procedures não entram neste filtro.
  FOR dependency IN
    SELECT
      namespace.nspname AS schema_name,
      proc.proname AS function_name,
      pg_get_function_identity_arguments(proc.oid) AS arguments
    FROM pg_proc AS proc
    JOIN pg_namespace AS namespace ON namespace.oid = proc.pronamespace
    WHERE namespace.nspname = 'public'
      AND proc.prokind = 'f'
      AND (
        lower(pg_get_functiondef(proc.oid)) LIKE '%silvester_documentos%'
        OR lower(pg_get_functiondef(proc.oid)) LIKE '%silvester_dossies%'
      )
  LOOP
    EXECUTE format(
      'DROP FUNCTION IF EXISTS %I.%I(%s) CASCADE',
      dependency.schema_name,
      dependency.function_name,
      dependency.arguments
    );
  END LOOP;

  -- Remove crons legados quando pg_cron estiver instalado.
  IF to_regclass('cron.job') IS NOT NULL THEN
    EXECUTE $sql$
      DELETE FROM cron.job
      WHERE lower(COALESCE(jobname, '')) LIKE '%silvester%'
         OR lower(command) LIKE '%silvester%'
         OR lower(command) LIKE '%silvester_dossies%'
         OR lower(command) LIKE '%silvester_documentos%'
    $sql$;
  END IF;

  -- Remove qualquer policy de storage vinculada ao bucket legado.
  IF to_regclass('storage.objects') IS NOT NULL THEN
    FOR dependency IN
      SELECT policy.polname
      FROM pg_policy AS policy
      WHERE policy.polrelid = 'storage.objects'::regclass
        AND (
          COALESCE(pg_get_expr(policy.polqual, policy.polrelid), '')
            ILIKE '%silvester-docs%'
          OR COALESCE(pg_get_expr(policy.polwithcheck, policy.polrelid), '')
            ILIKE '%silvester-docs%'
        )
    LOOP
      EXECUTE format(
        'DROP POLICY IF EXISTS %I ON storage.objects',
        dependency.polname
      );
    END LOOP;

    EXECUTE
      'DELETE FROM storage.objects WHERE bucket_id = $1'
      USING 'silvester-docs';
  END IF;

  IF to_regclass('storage.buckets') IS NOT NULL THEN
    EXECUTE
      'DELETE FROM storage.buckets WHERE id = $1'
      USING 'silvester-docs';
  END IF;
END
$$;

DROP FUNCTION IF EXISTS public.silvester_calcular_score() CASCADE;

DROP TABLE IF EXISTS public.silvester_documentos CASCADE;
DROP TABLE IF EXISTS public.silvester_dossies CASCADE;

ALTER TABLE IF EXISTS public.empresa_config
  DROP COLUMN IF EXISTS silvester_dossie_ativo;
