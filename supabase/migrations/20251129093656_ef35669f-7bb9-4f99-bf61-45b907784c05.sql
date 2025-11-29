-- Criar tabela de interações
CREATE TABLE IF NOT EXISTS interacoes (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  lead_id UUID NOT NULL,
  lead_tipo TEXT NOT NULL,
  tipo TEXT NOT NULL,
  titulo TEXT,
  descricao TEXT,
  resultado TEXT,
  duracao_segundos INTEGER,
  metadata JSONB DEFAULT '{}',
  created_by UUID REFERENCES auth.users(id),
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Criar índices para performance
CREATE INDEX idx_interacoes_lead ON interacoes(lead_id, lead_tipo);
CREATE INDEX idx_interacoes_created ON interacoes(created_at DESC);

-- Habilitar RLS
ALTER TABLE interacoes ENABLE ROW LEVEL SECURITY;

-- Política de acesso
CREATE POLICY "Users manage own interacoes" ON interacoes
FOR ALL USING (auth.uid() = created_by)
WITH CHECK (auth.uid() = created_by);