-- OS-1: parceiros, ordens de serviço, garantias e storage privado

ALTER TABLE public.veiculos_estoque
  ADD COLUMN IF NOT EXISTS pronto_anunciar_em timestamptz NULL;

ALTER TABLE public.veiculo_despesas
  ADD COLUMN IF NOT EXISTS origem_operacional text NULL,
  ADD COLUMN IF NOT EXISTS origem_operacional_id uuid NULL;

ALTER TABLE public.veiculo_despesas
  DROP CONSTRAINT IF EXISTS veiculo_despesas_origem_operacional_check;
ALTER TABLE public.veiculo_despesas
  ADD CONSTRAINT veiculo_despesas_origem_operacional_check CHECK (
    origem_operacional IS NULL OR origem_operacional IN (
      'os_preparacao', 'os_garantia', 'os_revisao', 'os_avulsa'
    )
  );

ALTER TABLE public.gestao_conta_lancamento
  DROP CONSTRAINT IF EXISTS gestao_conta_lancamento_origem_check;
ALTER TABLE public.gestao_conta_lancamento
  ADD CONSTRAINT gestao_conta_lancamento_origem_check CHECK (
    origem IN ('manual', 'bonus_g2', 'recorrencia', 'os_auto')
  );

CREATE UNIQUE INDEX IF NOT EXISTS veiculos_estoque_user_id_id_uidx
  ON public.veiculos_estoque (user_id, id);
CREATE UNIQUE INDEX IF NOT EXISTS gestao_troca_user_id_id_uidx
  ON public.gestao_troca (user_id, id);

CREATE TABLE IF NOT EXISTS public.gestao_os_config (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  alerta_os_parada_dias integer NOT NULL DEFAULT 7 CHECK (alerta_os_parada_dias > 0),
  alerta_preparacao_parada_dias integer NOT NULL DEFAULT 15
    CHECK (alerta_preparacao_parada_dias > 0),
  garantia_legal_dias integer NOT NULL DEFAULT 90 CHECK (garantia_legal_dias >= 0),
  garantia_contratual_dias integer NULL CHECK (
    garantia_contratual_dias IS NULL OR garantia_contratual_dias >= 0
  ),
  conta_pagar_vencimento_dias integer NOT NULL DEFAULT 0
    CHECK (conta_pagar_vencimento_dias >= 0),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS public.gestao_parceiro (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome text NOT NULL,
  nome_fantasia text NULL,
  documento text NULL,
  whatsapp_e164 text NULL,
  email text NULL,
  endereco_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  tipos text[] NOT NULL DEFAULT '{}'::text[],
  prazo_medio_dias integer NULL CHECK (prazo_medio_dias IS NULL OR prazo_medio_dias >= 0),
  ativo boolean NOT NULL DEFAULT true,
  observacao text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gestao_parceiro_tipos_check CHECK (
    tipos <@ ARRAY[
      'mecanica', 'funilaria', 'estetica', 'pneus', 'vidros',
      'despachante', 'outros'
    ]::text[]
  ),
  UNIQUE (user_id, id)
);

CREATE INDEX IF NOT EXISTS gestao_parceiro_user_ativo_nome_idx
  ON public.gestao_parceiro (user_id, ativo, nome);

ALTER TABLE public.gestao_conta_lancamento
  ADD COLUMN IF NOT EXISTS parceiro_id uuid NULL;
ALTER TABLE public.gestao_conta_lancamento
  DROP CONSTRAINT IF EXISTS gestao_conta_lancamento_parceiro_tenant_fk;
ALTER TABLE public.gestao_conta_lancamento
  ADD CONSTRAINT gestao_conta_lancamento_parceiro_tenant_fk
    FOREIGN KEY (user_id, parceiro_id)
    REFERENCES public.gestao_parceiro(user_id, id) ON DELETE SET NULL;

CREATE TABLE IF NOT EXISTS public.gestao_parceiro_servico (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  parceiro_id uuid NOT NULL,
  codigo text NULL,
  nome text NOT NULL,
  categoria_despesa text NOT NULL CHECK (categoria_despesa IN (
    'mecanica', 'funilaria_pintura', 'pneus', 'estetica', 'documentacao',
    'transporte', 'anuncio', 'comissao', 'outros'
  )),
  preco_referencia numeric(14, 2) NULL CHECK (
    preco_referencia IS NULL OR preco_referencia >= 0
  ),
  prazo_medio_dias integer NULL CHECK (prazo_medio_dias IS NULL OR prazo_medio_dias >= 0),
  tipo_veiculo text NULL,
  ativo boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gestao_parceiro_servico_tenant_fk
    FOREIGN KEY (user_id, parceiro_id)
    REFERENCES public.gestao_parceiro(user_id, id) ON DELETE CASCADE,
  UNIQUE (user_id, id)
);

CREATE UNIQUE INDEX IF NOT EXISTS gestao_parceiro_servico_codigo_uidx
  ON public.gestao_parceiro_servico (parceiro_id, codigo)
  WHERE codigo IS NOT NULL;
CREATE INDEX IF NOT EXISTS gestao_parceiro_servico_user_parceiro_idx
  ON public.gestao_parceiro_servico (user_id, parceiro_id, ativo);

CREATE TABLE IF NOT EXISTS public.gestao_os_sequencia (
  user_id uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  ultimo_numero bigint NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS public.gestao_os (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  numero bigint NOT NULL,
  veiculo_id uuid NOT NULL,
  parceiro_id uuid NULL,
  tipo text NOT NULL CHECK (tipo IN ('preparacao', 'garantia', 'revisao', 'avulsa')),
  status text NOT NULL DEFAULT 'rascunho' CHECK (status IN (
    'rascunho', 'orcamento', 'aguardando_aprovacao', 'aprovada', 'checkin',
    'em_execucao', 'aguardando_retirada', 'checkout', 'concluida', 'cancelada'
  )),
  origem text NOT NULL DEFAULT 'manual' CHECK (
    origem IN ('manual', 'compra', 'troca', 'venda_garantia')
  ),
  troca_id uuid NULL,
  garantia_id uuid NULL,
  ocorrencia_garantia_id uuid NULL,
  km_checkin integer NULL CHECK (km_checkin IS NULL OR km_checkin >= 0),
  km_checkout integer NULL CHECK (km_checkout IS NULL OR km_checkout >= 0),
  data_prevista date NULL,
  iniciada_em timestamptz NULL,
  concluida_em timestamptz NULL,
  valor_estimado numeric(14, 2) NOT NULL DEFAULT 0 CHECK (valor_estimado >= 0),
  valor_aprovado numeric(14, 2) NULL CHECK (valor_aprovado IS NULL OR valor_aprovado >= 0),
  valor_real numeric(14, 2) NULL CHECK (valor_real IS NULL OR valor_real >= 0),
  descontar_do_consignante boolean NULL,
  aprovado_por uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  aprovado_em timestamptz NULL,
  despesa_id uuid NULL REFERENCES public.veiculo_despesas(id) ON DELETE SET NULL,
  conta_lancamento_id uuid NULL REFERENCES public.gestao_conta_lancamento(id) ON DELETE SET NULL,
  valor_sincronizado numeric(14, 2) NULL,
  despesa_categoria_sincronizada text NULL,
  conta_vencimento_sincronizado date NULL,
  parceiro_sincronizado_id uuid NULL,
  sync_aviso text NULL,
  conta_vencimento date NULL,
  observacao text NULL,
  ultima_movimentacao_em timestamptz NOT NULL DEFAULT now(),
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gestao_os_veiculo_tenant_fk
    FOREIGN KEY (user_id, veiculo_id)
    REFERENCES public.veiculos_estoque(user_id, id) ON DELETE CASCADE,
  CONSTRAINT gestao_os_parceiro_tenant_fk
    FOREIGN KEY (user_id, parceiro_id)
    REFERENCES public.gestao_parceiro(user_id, id) ON DELETE RESTRICT,
  CONSTRAINT gestao_os_troca_tenant_fk
    FOREIGN KEY (user_id, troca_id)
    REFERENCES public.gestao_troca(user_id, id) ON DELETE SET NULL,
  UNIQUE (user_id, id),
  UNIQUE (user_id, numero)
);

CREATE INDEX IF NOT EXISTS gestao_os_user_status_prazo_idx
  ON public.gestao_os (user_id, status, data_prevista);
CREATE INDEX IF NOT EXISTS gestao_os_user_veiculo_idx
  ON public.gestao_os (user_id, veiculo_id, created_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS gestao_os_troca_preparacao_uidx
  ON public.gestao_os (user_id, troca_id)
  WHERE troca_id IS NOT NULL AND tipo = 'preparacao' AND origem = 'troca';

CREATE TABLE IF NOT EXISTS public.gestao_os_item (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  os_id uuid NOT NULL,
  parceiro_servico_id uuid NULL,
  descricao text NOT NULL,
  categoria_despesa text NOT NULL CHECK (categoria_despesa IN (
    'mecanica', 'funilaria_pintura', 'pneus', 'estetica', 'documentacao',
    'transporte', 'anuncio', 'comissao', 'outros'
  )),
  quantidade numeric(10, 2) NOT NULL DEFAULT 1 CHECK (quantidade > 0),
  valor_estimado numeric(14, 2) NOT NULL DEFAULT 0 CHECK (valor_estimado >= 0),
  valor_aprovado numeric(14, 2) NULL CHECK (valor_aprovado IS NULL OR valor_aprovado >= 0),
  valor_real numeric(14, 2) NULL CHECK (valor_real IS NULL OR valor_real >= 0),
  status text NOT NULL DEFAULT 'sugerido' CHECK (
    status IN ('sugerido', 'aprovado', 'recusado', 'executado', 'cancelado')
  ),
  origem text NOT NULL DEFAULT 'manual' CHECK (origem IN ('manual', 'laudo')),
  troca_ia_item_id uuid NULL REFERENCES public.gestao_troca_ia_item(id) ON DELETE SET NULL,
  checklist_key text NULL,
  observacao text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gestao_os_item_tenant_fk
    FOREIGN KEY (user_id, os_id)
    REFERENCES public.gestao_os(user_id, id) ON DELETE CASCADE,
  CONSTRAINT gestao_os_item_servico_tenant_fk
    FOREIGN KEY (user_id, parceiro_servico_id)
    REFERENCES public.gestao_parceiro_servico(user_id, id) ON DELETE SET NULL
);

CREATE UNIQUE INDEX IF NOT EXISTS gestao_os_item_laudo_uidx
  ON public.gestao_os_item (os_id, troca_ia_item_id)
  WHERE troca_ia_item_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS gestao_os_item_checklist_uidx
  ON public.gestao_os_item (os_id, checklist_key)
  WHERE checklist_key IS NOT NULL;

CREATE TABLE IF NOT EXISTS public.gestao_os_vistoria (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  os_id uuid NOT NULL,
  tipo text NOT NULL CHECK (tipo IN ('checkin', 'checkout')),
  km integer NOT NULL CHECK (km >= 0),
  checklist_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  registrado_por uuid NOT NULL REFERENCES auth.users(id) ON DELETE RESTRICT,
  registrado_em timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gestao_os_vistoria_tenant_fk
    FOREIGN KEY (user_id, os_id)
    REFERENCES public.gestao_os(user_id, id) ON DELETE CASCADE,
  UNIQUE (os_id, tipo),
  UNIQUE (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.gestao_os_documento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  os_id uuid NOT NULL,
  vistoria_id uuid NULL,
  tipo text NOT NULL CHECK (tipo IN (
    'foto_checkin', 'foto_checkout', 'orcamento', 'nota', 'comprovante', 'outro'
  )),
  storage_path text NOT NULL,
  mime_type text NOT NULL,
  tamanho_bytes bigint NOT NULL CHECK (tamanho_bytes > 0),
  sha256 text NULL,
  sensibilidade text NOT NULL DEFAULT 'interno' CHECK (
    sensibilidade IN ('interno', 'pessoal', 'financeiro')
  ),
  created_at timestamptz NOT NULL DEFAULT now(),
  deleted_at timestamptz NULL,
  CONSTRAINT gestao_os_documento_tenant_fk
    FOREIGN KEY (user_id, os_id)
    REFERENCES public.gestao_os(user_id, id) ON DELETE CASCADE,
  CONSTRAINT gestao_os_documento_vistoria_tenant_fk
    FOREIGN KEY (user_id, vistoria_id)
    REFERENCES public.gestao_os_vistoria(user_id, id) ON DELETE SET NULL,
  CONSTRAINT gestao_os_documento_path_check
    CHECK (storage_path LIKE user_id::text || '/os/' || os_id::text || '/%')
);

CREATE TABLE IF NOT EXISTS public.gestao_os_evento (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  os_id uuid NOT NULL,
  status_anterior text NULL,
  status_novo text NULL,
  tipo text NOT NULL,
  autor_id uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  origem text NOT NULL DEFAULT 'painel' CHECK (origem IN ('painel', 'automacao')),
  mensagem text NOT NULL,
  metadados_json jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gestao_os_evento_tenant_fk
    FOREIGN KEY (user_id, os_id)
    REFERENCES public.gestao_os(user_id, id) ON DELETE CASCADE
);

CREATE INDEX IF NOT EXISTS gestao_os_evento_os_created_idx
  ON public.gestao_os_evento (os_id, created_at ASC);

CREATE TABLE IF NOT EXISTS public.gestao_garantia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  veiculo_id uuid NOT NULL,
  venda_veiculo_id uuid NOT NULL,
  inicio date NOT NULL,
  prazo_legal_dias integer NOT NULL DEFAULT 90 CHECK (prazo_legal_dias >= 0),
  prazo_contratual_dias integer NULL CHECK (
    prazo_contratual_dias IS NULL OR prazo_contratual_dias >= 0
  ),
  fim_legal date GENERATED ALWAYS AS (inicio + prazo_legal_dias) STORED,
  fim_contratual date GENERATED ALWAYS AS (
    CASE WHEN prazo_contratual_dias IS NULL THEN NULL
      ELSE inicio + prazo_contratual_dias END
  ) STORED,
  status text NOT NULL DEFAULT 'ativa' CHECK (
    status IN ('ativa', 'expirada', 'suspensa', 'encerrada')
  ),
  observacao text NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gestao_garantia_veiculo_tenant_fk
    FOREIGN KEY (user_id, veiculo_id)
    REFERENCES public.veiculos_estoque(user_id, id) ON DELETE CASCADE,
  CONSTRAINT gestao_garantia_venda_tenant_fk
    FOREIGN KEY (user_id, venda_veiculo_id)
    REFERENCES public.veiculo_venda(user_id, veiculo_id) ON DELETE CASCADE,
  UNIQUE (user_id, veiculo_id),
  UNIQUE (user_id, id)
);

CREATE TABLE IF NOT EXISTS public.gestao_garantia_ocorrencia (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  garantia_id uuid NOT NULL,
  os_id uuid NULL,
  relato text NOT NULL,
  status text NOT NULL DEFAULT 'aberta' CHECK (
    status IN ('aberta', 'em_analise', 'aprovada', 'recusada', 'concluida')
  ),
  cobertura text NOT NULL DEFAULT 'pendente' CHECK (
    cobertura IN ('pendente', 'coberta', 'nao_coberta', 'cortesia')
  ),
  decidido_por uuid NULL REFERENCES auth.users(id) ON DELETE SET NULL,
  decidido_em timestamptz NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT gestao_garantia_ocorrencia_tenant_fk
    FOREIGN KEY (user_id, garantia_id)
    REFERENCES public.gestao_garantia(user_id, id) ON DELETE CASCADE,
  UNIQUE (user_id, id)
);

ALTER TABLE public.gestao_os
  ADD CONSTRAINT gestao_os_garantia_tenant_fk
    FOREIGN KEY (user_id, garantia_id)
    REFERENCES public.gestao_garantia(user_id, id) ON DELETE SET NULL,
  ADD CONSTRAINT gestao_os_ocorrencia_tenant_fk
    FOREIGN KEY (user_id, ocorrencia_garantia_id)
    REFERENCES public.gestao_garantia_ocorrencia(user_id, id) ON DELETE SET NULL;

ALTER TABLE public.gestao_garantia_ocorrencia
  ADD CONSTRAINT gestao_garantia_ocorrencia_os_tenant_fk
    FOREIGN KEY (user_id, os_id)
    REFERENCES public.gestao_os(user_id, id) ON DELETE SET NULL;

ALTER TABLE public.gestao_os_config ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_parceiro ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_parceiro_servico ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_os_sequencia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_os ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_os_item ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_os_vistoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_os_documento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_os_evento ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_garantia ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.gestao_garantia_ocorrencia ENABLE ROW LEVEL SECURITY;

CREATE POLICY gestao_os_config_owner ON public.gestao_os_config
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY gestao_parceiro_owner ON public.gestao_parceiro
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY gestao_parceiro_servico_owner ON public.gestao_parceiro_servico
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY gestao_os_owner ON public.gestao_os
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY gestao_os_item_owner ON public.gestao_os_item
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY gestao_os_vistoria_owner ON public.gestao_os_vistoria
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY gestao_os_documento_owner ON public.gestao_os_documento
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY gestao_os_evento_owner_select ON public.gestao_os_evento
  FOR SELECT TO authenticated USING (auth.uid() = user_id);
CREATE POLICY gestao_os_evento_owner_insert ON public.gestao_os_evento
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = user_id);
CREATE POLICY gestao_garantia_owner ON public.gestao_garantia
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);
CREATE POLICY gestao_garantia_ocorrencia_owner ON public.gestao_garantia_ocorrencia
  FOR ALL TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

REVOKE ALL ON public.gestao_os_config, public.gestao_parceiro,
  public.gestao_parceiro_servico, public.gestao_os_sequencia, public.gestao_os,
  public.gestao_os_item, public.gestao_os_vistoria, public.gestao_os_documento,
  public.gestao_os_evento, public.gestao_garantia,
  public.gestao_garantia_ocorrencia FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.gestao_os_config,
  public.gestao_parceiro, public.gestao_parceiro_servico,
  public.gestao_os_item, public.gestao_os_vistoria, public.gestao_os_documento,
  public.gestao_garantia, public.gestao_garantia_ocorrencia TO authenticated;
REVOKE INSERT, UPDATE, DELETE ON public.gestao_os FROM authenticated;
GRANT SELECT ON public.gestao_os TO authenticated;
GRANT UPDATE (
  parceiro_id, data_prevista, observacao, conta_vencimento, valor_estimado
) ON public.gestao_os TO authenticated;
GRANT SELECT, INSERT ON public.gestao_os_evento TO authenticated;
GRANT ALL ON public.gestao_os_config, public.gestao_parceiro,
  public.gestao_parceiro_servico, public.gestao_os_sequencia, public.gestao_os,
  public.gestao_os_item, public.gestao_os_vistoria, public.gestao_os_documento,
  public.gestao_os_evento, public.gestao_garantia,
  public.gestao_garantia_ocorrencia TO service_role;

CREATE TRIGGER update_gestao_os_config_updated_at
  BEFORE UPDATE ON public.gestao_os_config
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gestao_parceiro_updated_at
  BEFORE UPDATE ON public.gestao_parceiro
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gestao_parceiro_servico_updated_at
  BEFORE UPDATE ON public.gestao_parceiro_servico
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gestao_os_updated_at
  BEFORE UPDATE ON public.gestao_os
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gestao_os_item_updated_at
  BEFORE UPDATE ON public.gestao_os_item
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gestao_garantia_updated_at
  BEFORE UPDATE ON public.gestao_garantia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
CREATE TRIGGER update_gestao_garantia_ocorrencia_updated_at
  BEFORE UPDATE ON public.gestao_garantia_ocorrencia
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM information_schema.columns
    WHERE table_schema = 'storage'
      AND table_name = 'buckets'
      AND column_name = 'public'
  ) THEN
    INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
    VALUES (
      'gestao-os-documentos', 'gestao-os-documentos', false, 15728640,
      ARRAY['image/jpeg', 'image/png', 'image/webp', 'application/pdf']
    )
    ON CONFLICT (id) DO UPDATE SET public = false;
  ELSE
    INSERT INTO storage.buckets (id, name)
    VALUES ('gestao-os-documentos', 'gestao-os-documentos')
    ON CONFLICT (id) DO NOTHING;
  END IF;
END;
$$;

CREATE POLICY gestao_os_documentos_insert_owner ON storage.objects
  FOR INSERT TO authenticated WITH CHECK (
    bucket_id = 'gestao-os-documentos'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (storage.foldername(name))[2] = 'os'
  );
CREATE POLICY gestao_os_documentos_select_owner ON storage.objects
  FOR SELECT TO authenticated USING (
    bucket_id = 'gestao-os-documentos'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (storage.foldername(name))[2] = 'os'
  );
CREATE POLICY gestao_os_documentos_delete_owner ON storage.objects
  FOR DELETE TO authenticated USING (
    bucket_id = 'gestao-os-documentos'
    AND auth.uid()::text = (storage.foldername(name))[1]
    AND (storage.foldername(name))[2] = 'os'
  );
