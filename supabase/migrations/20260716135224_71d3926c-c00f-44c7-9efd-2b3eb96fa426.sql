
-- ============================================================
-- SILVESTER DOSSIÊ INTELIGENTE — Fase 1
-- ============================================================

-- 1) TABELA silvester_dossies (ficha do cliente)
CREATE TABLE IF NOT EXISTS public.silvester_dossies (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,                    -- dono do agente (Marcelo)
  telefone_cliente TEXT NOT NULL,           -- número WhatsApp do cliente
  
  -- Dados pessoais
  nome_completo TEXT,
  cpf TEXT,
  rg TEXT,
  data_nascimento DATE,
  estado_civil TEXT,
  profissao TEXT,
  renda_mensal NUMERIC(12,2),
  email TEXT,
  telefone_alternativo TEXT,
  
  -- Endereço
  endereco_logradouro TEXT,
  endereco_numero TEXT,
  endereco_complemento TEXT,
  endereco_bairro TEXT,
  endereco_cidade TEXT,
  endereco_estado TEXT,
  endereco_cep TEXT,
  
  -- Interesse comercial
  interesse_bem TEXT,                       -- auto/imovel/servico/moto/caminhao
  interesse_valor_carta NUMERIC(12,2),
  interesse_prazo_meses INT,
  interesse_aceita_lance BOOLEAN,
  interesse_observacoes TEXT,
  
  -- Status
  status TEXT NOT NULL DEFAULT 'coletando', -- coletando | aguardando_proposta | proposta_enviada | fechado | descartado
  completeness_score INT NOT NULL DEFAULT 0,
  parcial_notified_at TIMESTAMPTZ,
  completo_notified_at TIMESTAMPTZ,
  
  notas_internas TEXT,
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  
  UNIQUE(user_id, telefone_cliente)
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.silvester_dossies TO authenticated;
GRANT ALL ON public.silvester_dossies TO service_role;

ALTER TABLE public.silvester_dossies ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono vê seus dossies"
  ON public.silvester_dossies FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Dono edita seus dossies"
  ON public.silvester_dossies FOR UPDATE
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Dono cria seus dossies"
  ON public.silvester_dossies FOR INSERT
  TO authenticated WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Dono deleta seus dossies"
  ON public.silvester_dossies FOR DELETE
  TO authenticated USING (auth.uid() = user_id);

CREATE INDEX idx_silvester_dossies_user ON public.silvester_dossies(user_id, status, updated_at DESC);
CREATE INDEX idx_silvester_dossies_phone ON public.silvester_dossies(telefone_cliente);


-- 2) TABELA silvester_documentos
CREATE TABLE IF NOT EXISTS public.silvester_documentos (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  dossie_id UUID NOT NULL REFERENCES public.silvester_dossies(id) ON DELETE CASCADE,
  user_id UUID NOT NULL,
  
  tipo TEXT NOT NULL DEFAULT 'outro',       -- rg, cnh, comprovante_residencia, comprovante_renda, ir, foto_bem, outro
  storage_path TEXT NOT NULL,               -- silvester-docs/{user_id}/{dossie_id}/{filename}
  mime_type TEXT,
  tamanho_bytes INT,
  
  ocr_texto TEXT,
  dados_extraidos JSONB DEFAULT '{}'::jsonb,
  status_validacao TEXT NOT NULL DEFAULT 'pendente', -- pendente | validado | ilegivel | erro
  observacoes_ia TEXT,
  
  wamid TEXT,                               -- ID original da mensagem WhatsApp
  
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  processed_at TIMESTAMPTZ
);

GRANT SELECT, INSERT, UPDATE, DELETE ON public.silvester_documentos TO authenticated;
GRANT ALL ON public.silvester_documentos TO service_role;

ALTER TABLE public.silvester_documentos ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Dono vê seus documentos"
  ON public.silvester_documentos FOR SELECT
  TO authenticated USING (auth.uid() = user_id);

CREATE POLICY "Dono edita seus documentos"
  ON public.silvester_documentos FOR ALL
  TO authenticated USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE INDEX idx_silvester_docs_dossie ON public.silvester_documentos(dossie_id, created_at DESC);


-- 3) Trigger de updated_at
CREATE TRIGGER trg_silvester_dossies_updated_at
  BEFORE UPDATE ON public.silvester_dossies
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();


-- 4) Trigger para recalcular completeness_score automaticamente
CREATE OR REPLACE FUNCTION public.silvester_calcular_score()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_score INT := 0;
  v_docs_validados INT := 0;
BEGIN
  -- Dados pessoais (max 50 pts)
  IF NEW.nome_completo IS NOT NULL AND length(NEW.nome_completo) > 3 THEN v_score := v_score + 10; END IF;
  IF NEW.cpf IS NOT NULL THEN v_score := v_score + 10; END IF;
  IF NEW.data_nascimento IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF NEW.renda_mensal IS NOT NULL AND NEW.renda_mensal > 0 THEN v_score := v_score + 10; END IF;
  IF NEW.endereco_cep IS NOT NULL OR NEW.endereco_cidade IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF NEW.profissao IS NOT NULL THEN v_score := v_score + 5; END IF;
  IF NEW.email IS NOT NULL THEN v_score := v_score + 5; END IF;
  
  -- Interesse (max 20 pts)
  IF NEW.interesse_bem IS NOT NULL THEN v_score := v_score + 10; END IF;
  IF NEW.interesse_valor_carta IS NOT NULL AND NEW.interesse_valor_carta > 0 THEN v_score := v_score + 10; END IF;
  
  -- Documentos validados (max 30 pts: 7.5 por doc)
  SELECT COUNT(*) INTO v_docs_validados
    FROM public.silvester_documentos
    WHERE dossie_id = NEW.id AND status_validacao = 'validado'
      AND tipo IN ('rg','cnh','comprovante_residencia','comprovante_renda','ir');
  v_score := v_score + LEAST(30, v_docs_validados * 8);
  
  NEW.completeness_score := LEAST(100, v_score);
  RETURN NEW;
END;
$$;

CREATE TRIGGER trg_silvester_dossies_score
  BEFORE INSERT OR UPDATE ON public.silvester_dossies
  FOR EACH ROW EXECUTE FUNCTION public.silvester_calcular_score();


-- 5) Storage RLS para bucket silvester-docs
CREATE POLICY "Dono lê seus docs no storage"
  ON storage.objects FOR SELECT
  TO authenticated
  USING (bucket_id = 'silvester-docs' AND (storage.foldername(name))[1] = auth.uid()::text);

CREATE POLICY "Service role escreve docs"
  ON storage.objects FOR INSERT
  TO service_role
  WITH CHECK (bucket_id = 'silvester-docs');

CREATE POLICY "Dono deleta seus docs no storage"
  ON storage.objects FOR DELETE
  TO authenticated
  USING (bucket_id = 'silvester-docs' AND (storage.foldername(name))[1] = auth.uid()::text);
