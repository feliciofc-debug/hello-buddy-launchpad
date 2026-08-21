-- ENUMS
DO $$ BEGIN
  CREATE TYPE public.plano_origem AS ENUM ('pagamento', 'cortesia', 'parceria', 'teste');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE TYPE public.plano_status AS ENUM ('ativo', 'expirado', 'cancelado');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- TABELA planos
CREATE TABLE public.planos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  slug TEXT NOT NULL UNIQUE,
  nome TEXT NOT NULL,
  preco_mensal NUMERIC(10,2),
  ativo BOOLEAN NOT NULL DEFAULT true,
  ordem INTEGER NOT NULL DEFAULT 0,
  agentes_whatsapp INTEGER NOT NULL DEFAULT 1,
  perfis_sociais INTEGER NOT NULL DEFAULT 1,
  imagens_ia_mes INTEGER NOT NULL DEFAULT 0,
  videos_legenda_mes INTEGER NOT NULL DEFAULT 0,
  usuarios_painel INTEGER NOT NULL DEFAULT 1,
  white_label BOOLEAN NOT NULL DEFAULT false,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

GRANT SELECT ON public.planos TO anon;
GRANT SELECT ON public.planos TO authenticated;
GRANT ALL ON public.planos TO service_role;

ALTER TABLE public.planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Planos ativos sao publicos"
  ON public.planos FOR SELECT
  USING (ativo = true);

CREATE POLICY "Admins gerenciam planos"
  ON public.planos FOR ALL
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_planos_updated_at
  BEFORE UPDATE ON public.planos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO public.planos (slug, nome, preco_mensal, ativo, ordem, agentes_whatsapp, perfis_sociais, imagens_ia_mes, videos_legenda_mes, usuarios_painel, white_label) VALUES
  ('essencial',    'Essencial',     597,  true,  1,  1,  1,  30,  10,  1, false),
  ('profissional', 'Profissional',  997,  true,  2,  1,  3, 100,  40,  3, false),
  ('avancado',     'Avançado',     1597,  true,  3,  3,  5, 300, 150, 10, false),
  ('agencia',      'Agência',      2597,  true,  4, 10, -1,  -1,  -1, -1, true),
  ('ilimitado',    'Ilimitado',    NULL, false,  5, -1, -1,  -1,  -1, -1, true);

-- TABELA user_planos
CREATE TABLE public.user_planos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  plano_id UUID NOT NULL REFERENCES public.planos(id),
  origem public.plano_origem NOT NULL DEFAULT 'pagamento',
  status public.plano_status NOT NULL DEFAULT 'ativo',
  inicia_em TIMESTAMPTZ NOT NULL DEFAULT now(),
  expira_em TIMESTAMPTZ,
  billing_subscription_id UUID REFERENCES public.billing_subscriptions(id) ON DELETE SET NULL,
  observacao TEXT,
  created_by UUID,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_user_planos_user_status ON public.user_planos (user_id, status);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.user_planos TO authenticated;
GRANT ALL ON public.user_planos TO service_role;

ALTER TABLE public.user_planos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuario le seus planos"
  ON public.user_planos FOR SELECT
  TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins inserem planos de usuario"
  ON public.user_planos FOR INSERT
  TO authenticated
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins atualizam planos de usuario"
  ON public.user_planos FOR UPDATE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'))
  WITH CHECK (public.has_role(auth.uid(), 'admin'));

CREATE POLICY "Admins removem planos de usuario"
  ON public.user_planos FOR DELETE
  TO authenticated
  USING (public.has_role(auth.uid(), 'admin'));

CREATE TRIGGER update_user_planos_updated_at
  BEFORE UPDATE ON public.user_planos
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- FUNCAO plano_efetivo
CREATE OR REPLACE FUNCTION public.plano_efetivo(p_user_id uuid)
RETURNS TABLE (
  user_plano_id uuid,
  plano_id uuid,
  slug text,
  nome text,
  preco_mensal numeric,
  origem public.plano_origem,
  expira_em timestamptz,
  agentes_whatsapp integer,
  perfis_sociais integer,
  imagens_ia_mes integer,
  videos_legenda_mes integer,
  usuarios_painel integer,
  white_label boolean
)
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT
    up.id,
    p.id,
    p.slug,
    p.nome,
    p.preco_mensal,
    up.origem,
    up.expira_em,
    p.agentes_whatsapp,
    p.perfis_sociais,
    p.imagens_ia_mes,
    p.videos_legenda_mes,
    p.usuarios_painel,
    p.white_label
  FROM public.user_planos up
  JOIN public.planos p ON p.id = up.plano_id
  WHERE up.user_id = p_user_id
    AND up.status = 'ativo'
    AND up.inicia_em <= now()
    AND (up.expira_em IS NULL OR up.expira_em > now())
  ORDER BY (
      CASE WHEN p.agentes_whatsapp   = -1 THEN 1000000 ELSE p.agentes_whatsapp   END
    + CASE WHEN p.perfis_sociais     = -1 THEN 1000000 ELSE p.perfis_sociais     END
    + CASE WHEN p.imagens_ia_mes     = -1 THEN 1000000 ELSE p.imagens_ia_mes     END
    + CASE WHEN p.videos_legenda_mes = -1 THEN 1000000 ELSE p.videos_legenda_mes END
    + CASE WHEN p.usuarios_painel    = -1 THEN 1000000 ELSE p.usuarios_painel    END
    + CASE WHEN p.white_label THEN 500000 ELSE 0 END
  ) DESC,
  (up.origem <> 'pagamento') DESC,
  up.created_at DESC
  LIMIT 1;
$$;

GRANT EXECUTE ON FUNCTION public.plano_efetivo(uuid) TO authenticated, service_role;
