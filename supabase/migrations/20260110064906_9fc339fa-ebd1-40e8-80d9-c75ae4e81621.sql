-- Fix timezone handling for affiliate scheduled sending (America/Sao_Paulo)
-- The schedule fields (horario_inicio/horario_fim) are interpreted as Sao Paulo local time.

CREATE OR REPLACE FUNCTION public.calcular_proximo_envio(p_programacao_id uuid)
RETURNS timestamp with time zone
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $function$
DECLARE
  v_prog RECORD;
  -- Work in Sao Paulo local time (timestamp without time zone)
  v_agora_local TIMESTAMP := (now() AT TIME ZONE 'America/Sao_Paulo');
  v_proximo_local TIMESTAMP;
  v_hoje DATE;
  v_hora_atual TIME;
  v_dia_semana INT;
  v_dia_mes INT;
  v_tentativas INT := 0;
BEGIN
  SELECT * INTO v_prog
  FROM programacao_envio_afiliado
  WHERE id = p_programacao_id;

  IF NOT FOUND OR NOT v_prog.ativo THEN
    RETURN NULL;
  END IF;

  -- Start from "now" in local time and add the interval
  v_proximo_local := v_agora_local + (v_prog.intervalo_minutos || ' minutes')::INTERVAL;

  WHILE v_tentativas < 100 LOOP
    v_tentativas := v_tentativas + 1;

    v_hoje := v_proximo_local::DATE;
    v_hora_atual := v_proximo_local::TIME;
    v_dia_semana := EXTRACT(DOW FROM v_proximo_local)::INT;
    v_dia_mes := EXTRACT(DAY FROM v_proximo_local)::INT;

    -- Clamp to allowed window (local time)
    IF v_hora_atual < v_prog.horario_inicio THEN
      v_proximo_local := v_hoje + v_prog.horario_inicio;
      CONTINUE;
    END IF;

    IF v_hora_atual > v_prog.horario_fim THEN
      v_proximo_local := (v_hoje + INTERVAL '1 day') + v_prog.horario_inicio;
      CONTINUE;
    END IF;

    -- Validate day constraints (local calendar)
    IF v_prog.dias_mes IS NOT NULL AND array_length(v_prog.dias_mes, 1) > 0 THEN
      IF NOT (v_dia_mes = ANY(v_prog.dias_mes)) THEN
        v_proximo_local := (v_proximo_local + INTERVAL '1 day')::DATE + v_prog.horario_inicio;
        CONTINUE;
      END IF;
    ELSE
      IF v_prog.dias_semana IS NOT NULL AND NOT (v_dia_semana = ANY(v_prog.dias_semana)) THEN
        v_proximo_local := (v_proximo_local + INTERVAL '1 day')::DATE + v_prog.horario_inicio;
        CONTINUE;
      END IF;
    END IF;

    -- Convert local timestamp to timestamptz using Sao Paulo timezone
    RETURN (v_proximo_local AT TIME ZONE 'America/Sao_Paulo');
  END LOOP;

  -- Fallback: 1 hour from now
  RETURN ( (v_agora_local + INTERVAL '1 hour') AT TIME ZONE 'America/Sao_Paulo' );
END;
$function$;
