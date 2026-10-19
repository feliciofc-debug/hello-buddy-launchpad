-- Trocas (avaliação veículo na troca) — ficha, preço, destino estoque/repasse

CREATE TABLE IF NOT EXISTS public.gestao_troca_config (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  margem_alvo_pct numeric(6, 2) NOT NULL DEFAULT 10,
  km_ref_mes_padrao numeric(8, 2) NOT NULL DEFAULT 1000,
  bonus_km_baixo_pct numeric(6, 2) NOT NULL DEFAULT 2,
  desconto_km_alto_pct_por_faixa numeric(6, 2) NOT NULL DEFAULT 1,
  desconto_km_alto_teto_pct numeric(6, 2) NOT NULL DEFAULT 6,
  fator_troca_sobre_fipe numeric(8, 4) NOT NULL DEFAULT 0.85,
  fator_loja_sobre_fipe numeric(8, 4) NOT NULL DEFAULT 1.00,
  custo_dia_estoque numeric(12, 2) NOT NULL DEFAULT 0,
  dias_giro_padrao integer NOT NULL DEFAULT 45,
  desconto_leilao_pct numeric(6, 2) NOT NULL DEFAULT 25,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gestao_troca (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  placa text NULL,
  marca text NOT NULL,
  modelo text NOT NULL,
  versao text NULL,
  ano_fabricacao integer NULL,
  ano_modelo integer NULL,
  km integer NULL,
  cor text NULL,
  cliente_nome text NULL,
  cliente_telefone text NULL,
  vendedor_id uuid NULL REFERENCES public.gestao_vendedores(id) ON DELETE SET NULL,
  avaliado_por text NULL,
  status text NOT NULL DEFAULT 'em_avaliacao'
    CHECK (status IN (
      'em_avaliacao', 'aguardando_aprovacao', 'aprovada', 'fechada',
      'recusada_cliente', 'perdida', 'cancelada'
    )),
  destino text NULL CHECK (destino IS NULL OR destino IN ('estoque', 'repasse')),
  checklist_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  opcionais_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  observacoes text NULL,
  fotos_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  kbb_troca numeric(14, 2) NULL,
  kbb_loja numeric(14, 2) NULL,
  kbb_km_caracteristico integer NULL,
  fipe_valor numeric(14, 2) NULL,
  fipe_mes_ref text NULL,
  preparacao_estimada numeric(14, 2) NOT NULL DEFAULT 0,
  valor_sugerido numeric(14, 2) NULL,
  faixa_verde_min numeric(14, 2) NULL,
  faixa_verde_max numeric(14, 2) NULL,
  teto numeric(14, 2) NULL,
  semaforo text NULL CHECK (semaforo IS NULL OR semaforo IN ('verde', 'amarelo', 'vermelho')),
  justificativas_json jsonb NOT NULL DEFAULT '[]'::jsonb,
  valor_proposto numeric(14, 2) NULL,
  valor_aprovado numeric(14, 2) NULL,
  aprovado_por uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_em timestamptz NULL,
  valor_fechado numeric(14, 2) NULL,
  fechado_em timestamptz NULL,
  procedencia_consulta_id uuid NULL REFERENCES public.veiculo_procedencia_consulta(id) ON DELETE SET NULL,
  veiculo_id uuid NULL REFERENCES public.veiculos_estoque(id) ON DELETE SET NULL,
  repasse_comprador text NULL,
  repasse_valor numeric(14, 2) NULL,
  repasse_data date NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gestao_troca_user_status_idx
  ON public.gestao_troca (user_id, status, created_at DESC);

CREATE TABLE IF NOT EXISTS public.gestao_troca_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  troca_id uuid NOT NULL REFERENCES public.gestao_troca(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  tipo text NOT NULL,
  descricao text NOT NULL,
  valor numeric(14, 2) NULL,
  autor text NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS gestao_troca_evento_troca_idx
  ON public.gestao_troca_evento (troca_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.gestao_troca_despesa (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  troca_id uuid NOT NULL REFERENCES public.gestao_troca(id) ON DELETE CASCADE,
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  categoria text NOT NULL
    CHECK (categoria IN (
      'mecanica', 'funilaria_pintura', 'pneus', 'estetica', 'documentacao',
      'transporte', 'anuncio', 'comissao', 'outros'
    )),
  valor numeric(14, 2) NOT NULL,
  descricao text NULL,
  data date NOT NULL DEFAULT CURRENT_DATE,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL
);

ALTER TABLE public.gestao_troca_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_troca ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_troca_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_troca_despesa ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON public.gestao_troca_config FROM anon;
REVOKE ALL ON public.gestao_troca FROM anon;
REVOKE ALL ON public.gestao_troca_evento FROM anon;
REVOKE ALL ON public.gestao_troca_despesa FROM anon;

GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_troca_config TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_troca TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_troca_evento TO authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_troca_despesa TO authenticated;
GRANT ALL ON public.gestao_troca_config TO service_role;
GRANT ALL ON public.gestao_troca TO service_role;
GRANT ALL ON public.gestao_troca_evento TO service_role;
GRANT ALL ON public.gestao_troca_despesa TO service_role;

DROP POLICY IF EXISTS gestao_troca_config_own ON public.gestao_troca_config;
CREATE POLICY gestao_troca_config_own ON public.gestao_troca_config
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS gestao_troca_own ON public.gestao_troca;
CREATE POLICY gestao_troca_own ON public.gestao_troca
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS gestao_troca_evento_own ON public.gestao_troca_evento;
CREATE POLICY gestao_troca_evento_own ON public.gestao_troca_evento
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP POLICY IF EXISTS gestao_troca_despesa_own ON public.gestao_troca_despesa;
CREATE POLICY gestao_troca_despesa_own ON public.gestao_troca_despesa
  FOR ALL TO authenticated
  USING (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role))
  WITH CHECK (auth.uid() = user_id OR public.has_role(auth.uid(), 'admin'::public.app_role));

DROP TRIGGER IF EXISTS update_gestao_troca_updated_at ON public.gestao_troca;
CREATE TRIGGER update_gestao_troca_updated_at
  BEFORE UPDATE ON public.gestao_troca
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DROP TRIGGER IF EXISTS update_gestao_troca_config_updated_at ON public.gestao_troca_config;
CREATE TRIGGER update_gestao_troca_config_updated_at
  BEFORE UPDATE ON public.gestao_troca_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

INSERT INTO storage.buckets (id, name) VALUES ('trocas', 'trocas') ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS trocas_storage_insert_own ON storage.objects;
CREATE POLICY trocas_storage_insert_own ON storage.objects
  FOR INSERT TO authenticated
  WITH CHECK (
    bucket_id = 'trocas'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS trocas_storage_select_own ON storage.objects;
CREATE POLICY trocas_storage_select_own ON storage.objects
  FOR SELECT TO authenticated
  USING (
    bucket_id = 'trocas'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );

DROP POLICY IF EXISTS trocas_storage_delete_own ON storage.objects;
CREATE POLICY trocas_storage_delete_own ON storage.objects
  FOR DELETE TO authenticated
  USING (
    bucket_id = 'trocas'
    AND auth.uid()::text = (storage.foldername(name))[1]
  );
