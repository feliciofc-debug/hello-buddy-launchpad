ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS plano_solicitado text,
  ADD COLUMN IF NOT EXISTS plano_solicitado_em timestamptz,
  ADD COLUMN IF NOT EXISTS pagamento_status text,
  ADD COLUMN IF NOT EXISTS cadastro_notificado_em timestamptz,
  ADD COLUMN IF NOT EXISTS cadastro_notificacao_erro text;

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_plano_solicitado_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_plano_solicitado_check
  CHECK (plano_solicitado IS NULL OR plano_solicitado IN ('essencial', 'profissional', 'avancado'));

ALTER TABLE public.profiles
  DROP CONSTRAINT IF EXISTS profiles_pagamento_status_check;
ALTER TABLE public.profiles
  ADD CONSTRAINT profiles_pagamento_status_check
  CHECK (pagamento_status IS NULL OR pagamento_status IN ('pending_payment', 'active', 'cancelled'));

COMMENT ON COLUMN public.profiles.plano_solicitado IS
  'Plano escolhido no autocadastro; não concede acesso por si só.';
COMMENT ON COLUMN public.profiles.plano_solicitado_em IS
  'Data em que o cliente escolheu o plano no autocadastro.';
COMMENT ON COLUMN public.profiles.pagamento_status IS
  'Sinalização comercial manual. NULL preserva clientes preexistentes e pending_payment não bloqueia o painel.';
COMMENT ON COLUMN public.profiles.cadastro_notificado_em IS
  'Data em que o responsável recebeu a notificação do cadastro no WhatsApp.';

CREATE OR REPLACE FUNCTION public.protect_profile_commercial_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF auth.role() = 'authenticated'
     AND NOT public.has_role(auth.uid(), 'admin')
     AND (
       new.plano_solicitado IS DISTINCT FROM old.plano_solicitado
       OR new.plano_solicitado_em IS DISTINCT FROM old.plano_solicitado_em
       OR new.pagamento_status IS DISTINCT FROM old.pagamento_status
       OR new.cadastro_notificado_em IS DISTINCT FROM old.cadastro_notificado_em
       OR new.cadastro_notificacao_erro IS DISTINCT FROM old.cadastro_notificacao_erro
     )
  THEN
    RAISE EXCEPTION 'commercial_profile_fields_are_read_only';
  END IF;
  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS protect_profile_commercial_state ON public.profiles;
CREATE TRIGGER protect_profile_commercial_state
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW
  EXECUTE FUNCTION public.protect_profile_commercial_state();

ALTER TABLE public.planos
  ADD COLUMN IF NOT EXISTS posts_mes integer NOT NULL DEFAULT 0;

UPDATE public.planos
SET
  nome = 'Essencial',
  preco_mensal = 597,
  agentes_whatsapp = 0,
  posts_mes = 60,
  ativo = true,
  ordem = 1
WHERE slug = 'essencial';

UPDATE public.planos
SET
  nome = 'Profissional',
  preco_mensal = 997,
  agentes_whatsapp = 0,
  posts_mes = -1,
  ativo = true,
  ordem = 2
WHERE slug = 'profissional';

UPDATE public.planos
SET
  nome = 'Avançado com IA',
  preco_mensal = 1597,
  agentes_whatsapp = 1,
  posts_mes = -1,
  ativo = true,
  ordem = 3
WHERE slug = 'avancado';

UPDATE public.planos
SET ativo = false
WHERE slug NOT IN ('essencial', 'profissional', 'avancado');

CREATE OR REPLACE FUNCTION public.initialize_signup_commercial_state()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  requested_plan text;
BEGIN
  requested_plan := COALESCE(NULLIF(new.raw_user_meta_data->>'plano_solicitado', ''), 'essencial');
  IF requested_plan NOT IN ('essencial', 'profissional', 'avancado') THEN
    requested_plan := 'essencial';
  END IF;

  INSERT INTO public.user_roles (user_id, role)
  VALUES (new.id, 'empresa')
  ON CONFLICT (user_id, role) DO NOTHING;

  UPDATE public.profiles
  SET
    plano_solicitado = requested_plan,
    plano_solicitado_em = now(),
    pagamento_status = 'pending_payment'
  WHERE id = new.id;

  RETURN new;
END;
$$;

DROP TRIGGER IF EXISTS zz_on_auth_user_commercial_state ON auth.users;
CREATE TRIGGER zz_on_auth_user_commercial_state
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.initialize_signup_commercial_state();
