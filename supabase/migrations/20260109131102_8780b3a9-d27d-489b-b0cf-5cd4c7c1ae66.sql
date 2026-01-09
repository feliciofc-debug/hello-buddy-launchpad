-- ============================================
-- SISTEMA DE ENVIO PROGRAMADO INTELIGENTE
-- AMZ Ofertas - Envio Automático para Grupos
-- ============================================

-- 1. TABELA PRINCIPAL: PROGRAMAÇÕES DE ENVIO
CREATE TABLE IF NOT EXISTS programacao_envio_afiliado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL,
  
  -- Nome da programação
  nome TEXT NOT NULL DEFAULT 'Minha Programação',
  descricao TEXT,
  
  -- CATEGORIAS (array de strings)
  categorias TEXT[] NOT NULL DEFAULT '{}',
  
  -- INTERVALO ENTRE ENVIOS
  intervalo_minutos INT NOT NULL DEFAULT 15,
  
  -- HORÁRIO DE FUNCIONAMENTO
  horario_inicio TIME NOT NULL DEFAULT '08:00',
  horario_fim TIME NOT NULL DEFAULT '22:00',
  
  -- DIAS DA SEMANA (0=Dom, 1=Seg, ..., 6=Sab)
  dias_semana INT[] DEFAULT '{1,2,3,4,5}',
  
  -- DIAS DO MÊS (opcional, se preenchido ignora dias_semana)
  dias_mes INT[] DEFAULT NULL,
  
  -- MODO DE SELEÇÃO DE PRODUTOS
  modo_selecao TEXT DEFAULT 'rotativo',
  
  -- GRUPOS DESTINO
  enviar_para_todos_grupos BOOLEAN DEFAULT true,
  grupos_ids UUID[] DEFAULT '{}',
  
  -- CONTROLE DE EXECUÇÃO
  ativo BOOLEAN DEFAULT false,
  proximo_envio TIMESTAMPTZ,
  ultimo_envio TIMESTAMPTZ,
  ultimo_produto_id UUID,
  
  -- ESTATÍSTICAS
  total_enviados INT DEFAULT 0,
  total_enviados_hoje INT DEFAULT 0,
  ultimo_reset_diario DATE DEFAULT CURRENT_DATE,
  
  -- CONFIG ADICIONAL
  incluir_imagem BOOLEAN DEFAULT true,
  incluir_preco BOOLEAN DEFAULT true,
  incluir_link BOOLEAN DEFAULT true,
  prefixo_mensagem TEXT DEFAULT '🔥 *OFERTA IMPERDÍVEL!*',
  sufixo_mensagem TEXT DEFAULT '💰 Comprando pelo link você ganha *2% de cashback*!',
  
  -- TIMESTAMPS
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_prog_user ON programacao_envio_afiliado(user_id);
CREATE INDEX IF NOT EXISTS idx_prog_ativo ON programacao_envio_afiliado(ativo, proximo_envio);
CREATE INDEX IF NOT EXISTS idx_prog_proximo ON programacao_envio_afiliado(proximo_envio) WHERE ativo = true;

-- 2. TABELA: HISTÓRICO DE ENVIOS PROGRAMADOS
CREATE TABLE IF NOT EXISTS historico_envio_programado (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programacao_id UUID REFERENCES programacao_envio_afiliado(id) ON DELETE CASCADE,
  user_id UUID,
  
  -- Produto enviado
  produto_id UUID,
  produto_titulo TEXT,
  produto_preco DECIMAL(10,2),
  produto_categoria TEXT,
  produto_link TEXT,
  produto_imagem TEXT,
  
  -- Grupos que receberam
  grupos_enviados INT DEFAULT 0,
  grupos_ids UUID[],
  
  -- Status
  sucesso BOOLEAN DEFAULT true,
  erro TEXT,
  
  -- Timestamp
  enviado_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_hist_prog ON historico_envio_programado(programacao_id, enviado_at DESC);
CREATE INDEX IF NOT EXISTS idx_hist_data ON historico_envio_programado(enviado_at DESC);

-- 3. TABELA: PRODUTOS JÁ ENVIADOS (evitar repetição)
CREATE TABLE IF NOT EXISTS produtos_enviados_programacao (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  programacao_id UUID NOT NULL REFERENCES programacao_envio_afiliado(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL,
  enviado_at TIMESTAMPTZ DEFAULT now(),
  
  UNIQUE(programacao_id, produto_id)
);

CREATE INDEX IF NOT EXISTS idx_prod_env_prog ON produtos_enviados_programacao(programacao_id);

-- 4. FUNÇÃO: CALCULAR PRÓXIMO ENVIO
CREATE OR REPLACE FUNCTION calcular_proximo_envio(
  p_programacao_id UUID
) RETURNS TIMESTAMPTZ AS $$
DECLARE
  v_prog RECORD;
  v_agora TIMESTAMPTZ := now();
  v_hoje DATE := CURRENT_DATE;
  v_hora_atual TIME := CURRENT_TIME;
  v_dia_semana INT := EXTRACT(DOW FROM v_agora)::INT;
  v_dia_mes INT := EXTRACT(DAY FROM v_agora)::INT;
  v_proximo TIMESTAMPTZ;
  v_tentativas INT := 0;
BEGIN
  SELECT * INTO v_prog FROM programacao_envio_afiliado WHERE id = p_programacao_id;
  
  IF NOT FOUND OR NOT v_prog.ativo THEN
    RETURN NULL;
  END IF;
  
  v_proximo := v_agora + (v_prog.intervalo_minutos || ' minutes')::INTERVAL;
  
  WHILE v_tentativas < 100 LOOP
    v_tentativas := v_tentativas + 1;
    
    v_hoje := v_proximo::DATE;
    v_hora_atual := v_proximo::TIME;
    v_dia_semana := EXTRACT(DOW FROM v_proximo)::INT;
    v_dia_mes := EXTRACT(DAY FROM v_proximo)::INT;
    
    IF v_hora_atual < v_prog.horario_inicio THEN
      v_proximo := v_hoje + v_prog.horario_inicio;
      CONTINUE;
    END IF;
    
    IF v_hora_atual > v_prog.horario_fim THEN
      v_proximo := (v_hoje + INTERVAL '1 day') + v_prog.horario_inicio;
      CONTINUE;
    END IF;
    
    IF v_prog.dias_mes IS NOT NULL AND array_length(v_prog.dias_mes, 1) > 0 THEN
      IF NOT (v_dia_mes = ANY(v_prog.dias_mes)) THEN
        v_proximo := v_proximo + INTERVAL '1 day';
        v_proximo := v_proximo::DATE + v_prog.horario_inicio;
        CONTINUE;
      END IF;
    ELSE
      IF v_prog.dias_semana IS NOT NULL AND NOT (v_dia_semana = ANY(v_prog.dias_semana)) THEN
        v_proximo := v_proximo + INTERVAL '1 day';
        v_proximo := v_proximo::DATE + v_prog.horario_inicio;
        CONTINUE;
      END IF;
    END IF;
    
    RETURN v_proximo;
  END LOOP;
  
  RETURN v_agora + INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 5. FUNÇÃO: PEGAR PRÓXIMO PRODUTO PARA ENVIAR
CREATE OR REPLACE FUNCTION pegar_proximo_produto_programacao(
  p_programacao_id UUID
) RETURNS TABLE(
  produto_id UUID,
  titulo TEXT,
  preco DECIMAL,
  link_afiliado TEXT,
  imagem_url TEXT,
  categoria TEXT
) AS $$
DECLARE
  v_prog RECORD;
  v_produto RECORD;
BEGIN
  SELECT * INTO v_prog FROM programacao_envio_afiliado WHERE id = p_programacao_id;
  
  IF NOT FOUND THEN
    RETURN;
  END IF;
  
  IF v_prog.modo_selecao = 'rotativo' THEN
    SELECT ap.* INTO v_produto
    FROM afiliado_produtos ap
    WHERE ap.user_id = v_prog.user_id
      AND ap.status = 'ativo'
      AND (array_length(v_prog.categorias, 1) IS NULL 
           OR LOWER(ap.categoria) = ANY(SELECT LOWER(unnest(v_prog.categorias))))
      AND NOT EXISTS (
        SELECT 1 FROM produtos_enviados_programacao pep 
        WHERE pep.programacao_id = p_programacao_id 
        AND pep.produto_id = ap.id
      )
    ORDER BY ap.created_at ASC
    LIMIT 1;
    
    IF NOT FOUND THEN
      DELETE FROM produtos_enviados_programacao WHERE programacao_id = p_programacao_id;
      
      SELECT ap.* INTO v_produto
      FROM afiliado_produtos ap
      WHERE ap.user_id = v_prog.user_id
        AND ap.status = 'ativo'
        AND (array_length(v_prog.categorias, 1) IS NULL 
             OR LOWER(ap.categoria) = ANY(SELECT LOWER(unnest(v_prog.categorias))))
      ORDER BY ap.created_at ASC
      LIMIT 1;
    END IF;
    
  ELSIF v_prog.modo_selecao = 'aleatorio' THEN
    SELECT ap.* INTO v_produto
    FROM afiliado_produtos ap
    WHERE ap.user_id = v_prog.user_id
      AND ap.status = 'ativo'
      AND (array_length(v_prog.categorias, 1) IS NULL 
           OR LOWER(ap.categoria) = ANY(SELECT LOWER(unnest(v_prog.categorias))))
    ORDER BY RANDOM()
    LIMIT 1;
    
  ELSIF v_prog.modo_selecao = 'preco_baixo' THEN
    SELECT ap.* INTO v_produto
    FROM afiliado_produtos ap
    WHERE ap.user_id = v_prog.user_id
      AND ap.status = 'ativo'
      AND (array_length(v_prog.categorias, 1) IS NULL 
           OR LOWER(ap.categoria) = ANY(SELECT LOWER(unnest(v_prog.categorias))))
      AND NOT EXISTS (
        SELECT 1 FROM produtos_enviados_programacao pep 
        WHERE pep.programacao_id = p_programacao_id 
        AND pep.produto_id = ap.id
      )
    ORDER BY ap.preco ASC NULLS LAST
    LIMIT 1;
    
  ELSIF v_prog.modo_selecao = 'mais_recente' THEN
    SELECT ap.* INTO v_produto
    FROM afiliado_produtos ap
    WHERE ap.user_id = v_prog.user_id
      AND ap.status = 'ativo'
      AND (array_length(v_prog.categorias, 1) IS NULL 
           OR LOWER(ap.categoria) = ANY(SELECT LOWER(unnest(v_prog.categorias))))
    ORDER BY ap.created_at DESC
    LIMIT 1;
    
  ELSE
    SELECT ap.* INTO v_produto
    FROM afiliado_produtos ap
    WHERE ap.user_id = v_prog.user_id
      AND ap.status = 'ativo'
    ORDER BY ap.created_at ASC
    LIMIT 1;
  END IF;
  
  IF FOUND THEN
    RETURN QUERY SELECT 
      v_produto.id,
      v_produto.titulo,
      v_produto.preco,
      v_produto.link_afiliado,
      v_produto.imagem_url,
      v_produto.categoria;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

-- 6. TRIGGER: ATUALIZAR updated_at
CREATE OR REPLACE FUNCTION update_programacao_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS trg_programacao_updated ON programacao_envio_afiliado;
CREATE TRIGGER trg_programacao_updated
  BEFORE UPDATE ON programacao_envio_afiliado
  FOR EACH ROW
  EXECUTE FUNCTION update_programacao_timestamp();

-- 7. RLS - Row Level Security
ALTER TABLE programacao_envio_afiliado ENABLE ROW LEVEL SECURITY;
ALTER TABLE historico_envio_programado ENABLE ROW LEVEL SECURITY;
ALTER TABLE produtos_enviados_programacao ENABLE ROW LEVEL SECURITY;

-- Políticas para usuários
CREATE POLICY "Users can manage own programacoes" ON programacao_envio_afiliado
  FOR ALL USING (auth.uid() = user_id) WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can view own historico" ON historico_envio_programado
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own historico" ON historico_envio_programado
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Service can manage produtos_enviados" ON produtos_enviados_programacao
  FOR ALL USING (true) WITH CHECK (true);