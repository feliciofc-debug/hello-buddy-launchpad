ALTER TABLE public.autopilot_config
  ADD COLUMN IF NOT EXISTS desativado_por text,
  ADD COLUMN IF NOT EXISTS desativado_em timestamptz,
  ADD COLUMN IF NOT EXISTS desativado_motivo text;

CREATE TABLE IF NOT EXISTS public.autopilot_auditoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  config_id uuid,
  user_id uuid,
  acao text NOT NULL,
  origem text,
  motivo text,
  detalhes jsonb DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now()
);

GRANT SELECT ON public.autopilot_auditoria TO authenticated;
GRANT ALL ON public.autopilot_auditoria TO service_role;

ALTER TABLE public.autopilot_auditoria ENABLE ROW LEVEL SECURITY;

CREATE POLICY "usuario_ve_sua_auditoria_autopilot"
ON public.autopilot_auditoria
FOR SELECT
TO authenticated
USING (user_id = auth.uid());

CREATE INDEX IF NOT EXISTS idx_autopilot_auditoria_created ON public.autopilot_auditoria (created_at DESC);

CREATE OR REPLACE FUNCTION public.autopilot_registrar_mudanca_ativo()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.ativo IS DISTINCT FROM OLD.ativo THEN
    INSERT INTO public.autopilot_auditoria (config_id, user_id, acao, origem, motivo, detalhes)
    VALUES (
      NEW.id,
      NEW.user_id,
      CASE WHEN NEW.ativo THEN 'ativado' ELSE 'desativado' END,
      COALESCE(NEW.desativado_por, 'desconhecido'),
      NEW.desativado_motivo,
      jsonb_build_object(
        'ultimo_produto_index', NEW.ultimo_produto_index,
        'repetir_ciclo', NEW.repetir_ciclo,
        'db_user', current_user
      )
    );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_autopilot_auditoria ON public.autopilot_config;
CREATE TRIGGER trg_autopilot_auditoria
AFTER UPDATE ON public.autopilot_config
FOR EACH ROW
EXECUTE FUNCTION public.autopilot_registrar_mudanca_ativo();