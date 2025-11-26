-- Tabela de campanhas recorrentes WhatsApp para produtos
CREATE TABLE IF NOT EXISTS campanhas_recorrentes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  produto_id UUID NOT NULL REFERENCES produtos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  listas_ids UUID[] NOT NULL,
  frequencia TEXT NOT NULL CHECK (frequencia IN ('uma_vez', 'diario', 'semanal', 'personalizado')),
  data_inicio DATE NOT NULL,
  horarios TIME[] NOT NULL DEFAULT ARRAY['10:00']::TIME[],
  dias_semana INTEGER[] DEFAULT ARRAY[]::INTEGER[],
  mensagem_template TEXT NOT NULL,
  ativa BOOLEAN DEFAULT true,
  proxima_execucao TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE campanhas_recorrentes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_campaigns" 
ON campanhas_recorrentes FOR ALL 
USING (auth.uid() = user_id);

-- Índices para performance
CREATE INDEX idx_campanhas_recorrentes_user ON campanhas_recorrentes(user_id);
CREATE INDEX idx_campanhas_recorrentes_proxima_exec ON campanhas_recorrentes(proxima_execucao) WHERE ativa = true;