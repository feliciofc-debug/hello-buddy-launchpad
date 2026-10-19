-- JARVIS-TROCA-1.6.1: REVOKE explícito + trigger trava laudo finalizado no banco

REVOKE INSERT, UPDATE, DELETE ON public.gestao_troca_laudo_versao FROM authenticated;
REVOKE ALL ON public.gestao_troca_laudo_numero FROM authenticated;

CREATE OR REPLACE FUNCTION public.gestao_troca_laudo_trava_update()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  jwt_role text;
BEGIN
  jwt_role := coalesce(nullif(current_setting('request.jwt.claim.role', true), ''), '');
  IF jwt_role = 'service_role' OR coalesce(auth.role(), '') = 'service_role' THEN
    RETURN NEW;
  END IF;

  IF NEW.laudo_status IS DISTINCT FROM OLD.laudo_status
     OR NEW.laudo_numero IS DISTINCT FROM OLD.laudo_numero
     OR NEW.laudo_versao IS DISTINCT FROM OLD.laudo_versao
     OR NEW.laudo_finalizado_por IS DISTINCT FROM OLD.laudo_finalizado_por
     OR NEW.laudo_finalizado_em IS DISTINCT FROM OLD.laudo_finalizado_em
     OR NEW.laudo_reaberto_motivo IS DISTINCT FROM OLD.laudo_reaberto_motivo
  THEN
    RAISE EXCEPTION 'Laudo finalizado: reabra o laudo para alterar.';
  END IF;

  IF OLD.laudo_status = 'finalizado' THEN
    IF NEW.checklist_json IS DISTINCT FROM OLD.checklist_json
       OR NEW.fotos_json IS DISTINCT FROM OLD.fotos_json
       OR NEW.kbb_troca IS DISTINCT FROM OLD.kbb_troca
       OR NEW.kbb_loja IS DISTINCT FROM OLD.kbb_loja
       OR NEW.kbb_km_caracteristico IS DISTINCT FROM OLD.kbb_km_caracteristico
       OR NEW.fipe_valor IS DISTINCT FROM OLD.fipe_valor
       OR NEW.fipe_mes_ref IS DISTINCT FROM OLD.fipe_mes_ref
       OR NEW.preparacao_estimada IS DISTINCT FROM OLD.preparacao_estimada
       OR NEW.valor_proposto IS DISTINCT FROM OLD.valor_proposto
       OR NEW.valor_sugerido IS DISTINCT FROM OLD.valor_sugerido
       OR NEW.faixa_verde_min IS DISTINCT FROM OLD.faixa_verde_min
       OR NEW.faixa_verde_max IS DISTINCT FROM OLD.faixa_verde_max
       OR NEW.teto IS DISTINCT FROM OLD.teto
       OR NEW.semaforo IS DISTINCT FROM OLD.semaforo
       OR NEW.justificativas_json IS DISTINCT FROM OLD.justificativas_json
       OR NEW.km IS DISTINCT FROM OLD.km
       OR NEW.placa IS DISTINCT FROM OLD.placa
       OR NEW.marca IS DISTINCT FROM OLD.marca
       OR NEW.modelo IS DISTINCT FROM OLD.modelo
       OR NEW.versao IS DISTINCT FROM OLD.versao
       OR NEW.ano_fabricacao IS DISTINCT FROM OLD.ano_fabricacao
       OR NEW.ano_modelo IS DISTINCT FROM OLD.ano_modelo
       OR NEW.cor IS DISTINCT FROM OLD.cor
       OR NEW.categoria IS DISTINCT FROM OLD.categoria
    THEN
      RAISE EXCEPTION 'Laudo finalizado: reabra o laudo para alterar.';
    END IF;
  END IF;

  RETURN NEW;
END;
$$;

REVOKE ALL ON FUNCTION public.gestao_troca_laudo_trava_update() FROM PUBLIC;
REVOKE ALL ON FUNCTION public.gestao_troca_laudo_trava_update() FROM anon;
REVOKE ALL ON FUNCTION public.gestao_troca_laudo_trava_update() FROM authenticated;

DROP TRIGGER IF EXISTS gestao_troca_laudo_trava_update ON public.gestao_troca;
CREATE TRIGGER gestao_troca_laudo_trava_update
  BEFORE UPDATE ON public.gestao_troca
  FOR EACH ROW
  EXECUTE FUNCTION public.gestao_troca_laudo_trava_update();
