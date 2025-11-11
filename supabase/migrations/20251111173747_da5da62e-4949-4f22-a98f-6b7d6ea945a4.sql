-- Criar tabela prospects_qualificados se não existir
CREATE TABLE IF NOT EXISTS prospects_qualificados (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users NOT NULL,
  socio_id uuid NOT NULL,
  score integer NOT NULL DEFAULT 0,
  justificativa text,
  insights jsonb DEFAULT '[]'::jsonb,
  mensagens_geradas jsonb,
  mensagem_selecionada text,
  enviado_whatsapp boolean DEFAULT false,
  enviado_em timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Habilitar RLS
ALTER TABLE prospects_qualificados ENABLE ROW LEVEL SECURITY;

-- Políticas RLS
CREATE POLICY "Users can view their own qualified prospects"
  ON prospects_qualificados FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own qualified prospects"
  ON prospects_qualificados FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own qualified prospects"
  ON prospects_qualificados FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own qualified prospects"
  ON prospects_qualificados FOR DELETE
  USING (auth.uid() = user_id);

-- Trigger para updated_at
CREATE OR REPLACE FUNCTION update_prospects_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_prospects_qualificados_updated_at
  BEFORE UPDATE ON prospects_qualificados
  FOR EACH ROW
  EXECUTE FUNCTION update_prospects_updated_at();