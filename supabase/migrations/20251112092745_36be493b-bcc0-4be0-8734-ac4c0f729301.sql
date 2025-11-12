-- Criar tabela enrichment_queue
CREATE TABLE IF NOT EXISTS enrichment_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id uuid REFERENCES socios(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  tentativas integer DEFAULT 0,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_enrichment_queue_status ON enrichment_queue(status);
CREATE INDEX IF NOT EXISTS idx_enrichment_queue_socio ON enrichment_queue(socio_id);

-- Criar tabela qualification_queue
CREATE TABLE IF NOT EXISTS qualification_queue (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  socio_id uuid REFERENCES socios(id) ON DELETE CASCADE,
  status text DEFAULT 'pending' CHECK (status IN ('pending', 'processing', 'completed', 'failed')),
  error_message text,
  tentativas integer DEFAULT 0,
  processed_at timestamptz,
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_qualification_queue_status ON qualification_queue(status);
CREATE INDEX IF NOT EXISTS idx_qualification_queue_socio ON qualification_queue(socio_id);

-- Adicionar coluna enrichment_data na tabela socios (se não existir)
ALTER TABLE socios ADD COLUMN IF NOT EXISTS enrichment_data jsonb DEFAULT '{}'::jsonb;
ALTER TABLE socios ADD COLUMN IF NOT EXISTS patrimonio_estimado numeric DEFAULT 0;

-- RLS
ALTER TABLE enrichment_queue ENABLE ROW LEVEL SECURITY;
ALTER TABLE qualification_queue ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "users_own_enrichment_queue" ON enrichment_queue;
CREATE POLICY "users_own_enrichment_queue" ON enrichment_queue FOR ALL USING (true);

DROP POLICY IF EXISTS "users_own_qualification_queue" ON qualification_queue;
CREATE POLICY "users_own_qualification_queue" ON qualification_queue FOR ALL USING (true);