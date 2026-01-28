-- ═══════════════════════════════════════
-- TABELA: fila_atendimento_pj
-- Fila anti-bloqueio humanizada para PJ
-- ═══════════════════════════════════════

DROP TABLE IF EXISTS public.fila_atendimento_pj CASCADE;

CREATE TABLE public.fila_atendimento_pj (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID,
  lead_phone TEXT NOT NULL,
  lead_name TEXT,
  mensagem TEXT NOT NULL,
  imagem_url TEXT,
  tipo_mensagem TEXT DEFAULT 'resposta_ia',
  prioridade INT DEFAULT 5,
  status TEXT DEFAULT 'pendente',
  wuzapi_token TEXT,
  wuzapi_url TEXT,
  tentativas INT DEFAULT 0,
  scheduled_at TIMESTAMPTZ DEFAULT now(),
  sent_at TIMESTAMPTZ,
  erro TEXT,
  metadata JSONB,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.fila_atendimento_pj ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuarios podem ver sua fila pj" ON public.fila_atendimento_pj
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Service role full access pj fila" ON public.fila_atendimento_pj
  FOR ALL USING (true);

-- Índices para performance
CREATE INDEX idx_fila_pj_status ON public.fila_atendimento_pj(status);
CREATE INDEX idx_fila_pj_scheduled ON public.fila_atendimento_pj(scheduled_at);
CREATE INDEX idx_fila_pj_user ON public.fila_atendimento_pj(user_id);

-- ═══════════════════════════════════════
-- FUNÇÃO: pegar_proximo_fila_pj
-- Busca e trava itens da fila para processamento
-- ═══════════════════════════════════════

CREATE OR REPLACE FUNCTION public.pegar_proximo_fila_pj(
  p_user_id UUID DEFAULT NULL,
  p_limit INT DEFAULT 3
)
RETURNS SETOF public.fila_atendimento_pj
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  RETURN QUERY
  UPDATE fila_atendimento_pj
  SET 
    status = 'processando',
    tentativas = tentativas + 1
  WHERE id IN (
    SELECT f.id 
    FROM fila_atendimento_pj f
    WHERE f.status = 'pendente'
      AND f.scheduled_at <= now()
      AND f.tentativas < 3
      AND (p_user_id IS NULL OR f.user_id = p_user_id)
    ORDER BY f.prioridade ASC, f.scheduled_at ASC
    LIMIT p_limit
    FOR UPDATE SKIP LOCKED
  )
  RETURNING *;
END;
$$;