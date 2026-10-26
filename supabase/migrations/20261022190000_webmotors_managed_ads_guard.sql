-- WEBMOTORS-1: somente anúncios criados pela plataforma podem ser alterados/excluídos.

ALTER TABLE public.veiculos_portais
  ADD COLUMN IF NOT EXISTS managed_by_platform boolean NOT NULL DEFAULT false;

ALTER TABLE public.webmotors_foto_vinculo
  ADD COLUMN IF NOT EXISTS ordem integer NULL;

COMMENT ON COLUMN public.veiculos_portais.managed_by_platform IS
  'True somente quando o anúncio externo foi criado por uma edge function da plataforma.';

-- Os vínculos Webmotors anteriores só podiam ser criados pelo fluxo server-side existente.
UPDATE public.veiculos_portais
SET managed_by_platform = true
WHERE portal = 'webmotors'
  AND external_id IS NOT NULL;

CREATE OR REPLACE FUNCTION public.guard_webmotors_managed_ad_fields()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public
AS $$
BEGIN
  IF current_user IN ('authenticated', 'anon') THEN
    IF TG_OP = 'INSERT' AND NEW.managed_by_platform THEN
      RAISE EXCEPTION 'Webmotors ownership fields are server-managed';
    END IF;

    IF TG_OP = 'UPDATE'
       AND NEW.managed_by_platform IS DISTINCT FROM OLD.managed_by_platform THEN
      RAISE EXCEPTION 'Webmotors ownership fields are server-managed';
    END IF;

    IF NEW.portal = 'webmotors' THEN
      IF TG_OP = 'INSERT' AND NEW.external_id IS NOT NULL THEN
        RAISE EXCEPTION 'Webmotors ownership fields are server-managed';
      END IF;

      IF TG_OP = 'UPDATE'
         AND (
           NEW.external_id IS DISTINCT FROM OLD.external_id
           OR (
             OLD.portal IS DISTINCT FROM 'webmotors'
             AND NEW.external_id IS NOT NULL
           )
         ) THEN
        RAISE EXCEPTION 'Webmotors ownership fields are server-managed';
      END IF;
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS guard_webmotors_managed_ad_fields
  ON public.veiculos_portais;
CREATE TRIGGER guard_webmotors_managed_ad_fields
  BEFORE INSERT OR UPDATE ON public.veiculos_portais
  FOR EACH ROW EXECUTE FUNCTION public.guard_webmotors_managed_ad_fields();
