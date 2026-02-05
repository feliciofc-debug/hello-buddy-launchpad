-- Adicionar campos de controle de envios na tabela pj_clientes_config
ALTER TABLE public.pj_clientes_config 
ADD COLUMN IF NOT EXISTS limite_envios BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS envios_utilizados BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS envios_mes_atual BIGINT DEFAULT 0,
ADD COLUMN IF NOT EXISTS mes_referencia TEXT DEFAULT to_char(NOW(), 'YYYY-MM');

-- Configurar Peixoto com 40 milhões de envios
UPDATE public.pj_clientes_config 
SET limite_envios = 40000000,
    envios_utilizados = 0,
    envios_mes_atual = 0,
    mes_referencia = to_char(NOW(), 'YYYY-MM')
WHERE user_id = 'f7810c7b-b623-42e7-a7cf-ea9cd7e362b1';

-- Criar tabela de histórico de envios por parceiro
CREATE TABLE IF NOT EXISTS public.pj_historico_envios (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id),
  mes_referencia TEXT NOT NULL,
  total_envios BIGINT DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, mes_referencia)
);

-- RLS para histórico
ALTER TABLE public.pj_historico_envios ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios veem proprio historico" ON public.pj_historico_envios
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Sistema pode inserir historico" ON public.pj_historico_envios
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Sistema pode atualizar historico" ON public.pj_historico_envios
  FOR UPDATE USING (true);

-- Função para incrementar contador de envios
CREATE OR REPLACE FUNCTION public.incrementar_envio_pj(p_user_id UUID, p_quantidade INTEGER DEFAULT 1)
RETURNS JSON
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public'
AS $$
DECLARE
  v_config RECORD;
  v_mes_atual TEXT := to_char(NOW(), 'YYYY-MM');
  v_resultado JSON;
BEGIN
  -- Buscar configuração atual
  SELECT * INTO v_config FROM pj_clientes_config WHERE user_id = p_user_id;
  
  IF NOT FOUND THEN
    RETURN json_build_object('success', false, 'error', 'Config não encontrada');
  END IF;
  
  -- Verificar se mudou o mês (reset contador mensal)
  IF v_config.mes_referencia != v_mes_atual THEN
    -- Salvar histórico do mês anterior
    INSERT INTO pj_historico_envios (user_id, mes_referencia, total_envios)
    VALUES (p_user_id, v_config.mes_referencia, v_config.envios_mes_atual)
    ON CONFLICT (user_id, mes_referencia) 
    DO UPDATE SET total_envios = EXCLUDED.total_envios, updated_at = NOW();
    
    -- Reset contador mensal
    UPDATE pj_clientes_config 
    SET envios_mes_atual = 0, mes_referencia = v_mes_atual
    WHERE user_id = p_user_id;
  END IF;
  
  -- Verificar limite
  IF v_config.envios_utilizados + p_quantidade > v_config.limite_envios THEN
    RETURN json_build_object(
      'success', false, 
      'error', 'Limite de envios atingido',
      'limite', v_config.limite_envios,
      'utilizados', v_config.envios_utilizados,
      'restantes', v_config.limite_envios - v_config.envios_utilizados
    );
  END IF;
  
  -- Incrementar contadores
  UPDATE pj_clientes_config 
  SET 
    envios_utilizados = envios_utilizados + p_quantidade,
    envios_mes_atual = envios_mes_atual + p_quantidade
  WHERE user_id = p_user_id
  RETURNING json_build_object(
    'success', true,
    'limite', limite_envios,
    'utilizados', envios_utilizados,
    'restantes', limite_envios - envios_utilizados,
    'mes_atual', envios_mes_atual
  ) INTO v_resultado;
  
  RETURN v_resultado;
END;
$$;