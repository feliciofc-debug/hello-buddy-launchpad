ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS videos_motion_dia integer NOT NULL DEFAULT 5;

ALTER TABLE public.pj_clientes_config
  ADD COLUMN IF NOT EXISTS limite_videos_motion_dia integer;

ALTER TABLE public.planos
  ADD CONSTRAINT planos_videos_motion_dia_valido
  CHECK (videos_motion_dia = -1 OR videos_motion_dia > 0);

ALTER TABLE public.pj_clientes_config
  ADD CONSTRAINT pj_clientes_config_limite_videos_motion_dia_valido
  CHECK (limite_videos_motion_dia IS NULL OR limite_videos_motion_dia = -1 OR limite_videos_motion_dia > 0);

UPDATE public.planos
SET videos_motion_dia = CASE slug
  WHEN 'essencial' THEN 5
  WHEN 'profissional' THEN 10
  WHEN 'avancado' THEN 20
  WHEN 'agencia' THEN -1
  WHEN 'ilimitado' THEN -1
  ELSE 5
END;

CREATE OR REPLACE FUNCTION public.video_motion_cota_efetiva(p_user_id uuid)
RETURNS TABLE(limite integer, origem text)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_override integer;
  v_plano integer;
BEGIN
  IF public.has_role(p_user_id, 'admin'::public.app_role) THEN
    RETURN QUERY SELECT -1, 'administrador'::text;
    RETURN;
  END IF;

  SELECT c.limite_videos_motion_dia
    INTO v_override
  FROM public.pj_clientes_config c
  WHERE c.user_id = p_user_id
    AND c.limite_videos_motion_dia IS NOT NULL
  ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_override, 'conta'::text;
    RETURN;
  END IF;

  SELECT p.videos_motion_dia
    INTO v_plano
  FROM public.user_planos up
  JOIN public.planos p ON p.id = up.plano_id
  WHERE up.user_id = p_user_id
    AND up.status = 'ativo'::public.plano_status
    AND up.inicia_em <= now()
    AND (up.expira_em IS NULL OR up.expira_em > now())
    AND p.ativo = true
  ORDER BY up.inicia_em DESC, up.created_at DESC
  LIMIT 1;

  IF FOUND THEN
    RETURN QUERY SELECT v_plano, 'plano'::text;
    RETURN;
  END IF;

  RETURN QUERY SELECT -1, 'sem_plano'::text;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_video_motion_quotas()
RETURNS TABLE(
  user_id uuid,
  email text,
  nome text,
  plano_nome text,
  plano_limite integer,
  limite_individual integer,
  limite_efetivo integer,
  origem_limite text,
  usado_hoje bigint
)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito a administradores';
  END IF;

  RETURN QUERY
  WITH contas AS (
    SELECT u.id, u.email::text, pr.nome,
      (SELECT c.limite_videos_motion_dia
       FROM public.pj_clientes_config c
       WHERE c.user_id = u.id AND c.limite_videos_motion_dia IS NOT NULL
       ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
       LIMIT 1) AS individual
    FROM auth.users u
    LEFT JOIN public.profiles pr ON pr.id = u.id
  ), plano_atual AS (
    SELECT DISTINCT ON (up.user_id)
      up.user_id, p.nome, p.videos_motion_dia
    FROM public.user_planos up
    JOIN public.planos p ON p.id = up.plano_id
    WHERE up.status = 'ativo'::public.plano_status
      AND up.inicia_em <= now()
      AND (up.expira_em IS NULL OR up.expira_em > now())
      AND p.ativo = true
    ORDER BY up.user_id, up.inicia_em DESC, up.created_at DESC
  ), uso AS (
    SELECT j.user_id, count(*)::bigint AS total
    FROM public.video_motion_jobs j
    WHERE j.created_at >= (date_trunc('day', now() AT TIME ZONE 'America/Sao_Paulo') AT TIME ZONE 'America/Sao_Paulo')
      AND j.status IN ('pendente', 'processando', 'concluido', 'aguardando_aprovacao', 'publicado')
    GROUP BY j.user_id
  )
  SELECT c.id, c.email, c.nome, pa.nome, pa.videos_motion_dia, c.individual,
    q.limite, q.origem, coalesce(u.total, 0)
  FROM contas c
  LEFT JOIN plano_atual pa ON pa.user_id = c.id
  LEFT JOIN uso u ON u.user_id = c.id
  CROSS JOIN LATERAL public.video_motion_cota_efetiva(c.id) q
  ORDER BY c.nome NULLS LAST, c.email;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_video_motion_quota(p_user_id uuid, p_limite integer)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NOT public.has_role(auth.uid(), 'admin'::public.app_role) THEN
    RAISE EXCEPTION 'Acesso restrito a administradores';
  END IF;
  IF p_limite IS NOT NULL AND p_limite <> -1 AND p_limite <= 0 THEN
    RAISE EXCEPTION 'Use -1 para ilimitado ou um número maior que zero';
  END IF;

  UPDATE public.pj_clientes_config
  SET limite_videos_motion_dia = p_limite, updated_at = now()
  WHERE id = (
    SELECT c.id FROM public.pj_clientes_config c
    WHERE c.user_id = p_user_id
    ORDER BY c.updated_at DESC NULLS LAST, c.created_at DESC NULLS LAST
    LIMIT 1
  );

  IF NOT FOUND THEN
    INSERT INTO public.pj_clientes_config (user_id, limite_videos_motion_dia)
    VALUES (p_user_id, p_limite);
  END IF;
END;
$$;

GRANT EXECUTE ON FUNCTION public.video_motion_cota_efetiva(uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_list_video_motion_quotas() TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.admin_set_video_motion_quota(uuid, integer) TO authenticated, service_role;