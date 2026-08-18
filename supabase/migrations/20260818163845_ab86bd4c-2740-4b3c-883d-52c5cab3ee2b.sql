ALTER TABLE public.empresa_config
  ADD COLUMN IF NOT EXISTS voz_copy TEXT NOT NULL DEFAULT 'empresa',
  ADD COLUMN IF NOT EXISTS nome_assinatura TEXT;

CREATE OR REPLACE FUNCTION public.validar_voz_copy()
RETURNS TRIGGER
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF NEW.voz_copy IS NULL OR NEW.voz_copy NOT IN ('empresa','pessoa') THEN
    NEW.voz_copy := 'empresa';
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS validar_voz_copy_trigger ON public.empresa_config;
CREATE TRIGGER validar_voz_copy_trigger
BEFORE INSERT OR UPDATE ON public.empresa_config
FOR EACH ROW EXECUTE FUNCTION public.validar_voz_copy();