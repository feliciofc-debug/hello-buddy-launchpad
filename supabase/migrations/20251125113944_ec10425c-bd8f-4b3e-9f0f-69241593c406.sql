-- =============================================
-- VOICE AI CALLING - DATABASE UPDATE
-- =============================================

-- Adicionar campos de refinamento no ICP (caso não existam)
ALTER TABLE icp_configs 
ADD COLUMN IF NOT EXISTS refinamento_geografico TEXT,
ADD COLUMN IF NOT EXISTS refinamento_comportamental TEXT;

-- Atualizar constraint de tipo para incluir 'ambos'
DO $$ 
BEGIN
  ALTER TABLE icp_configs DROP CONSTRAINT IF EXISTS icp_configs_tipo_check;
  ALTER TABLE icp_configs ADD CONSTRAINT icp_configs_tipo_check CHECK (tipo IN ('b2b', 'b2c', 'ambos'));
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

-- Criar políticas RLS para voice_calls (se não existirem)
DO $$ 
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'voice_calls' 
    AND policyname = 'Users can view their own voice calls'
  ) THEN
    CREATE POLICY "Users can view their own voice calls"
      ON voice_calls FOR SELECT
      USING (
        user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM campanhas_prospeccao 
          WHERE campanhas_prospeccao.id = voice_calls.campanha_id 
          AND campanhas_prospeccao.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'voice_calls' 
    AND policyname = 'Users can insert voice calls'
  ) THEN
    CREATE POLICY "Users can insert voice calls"
      ON voice_calls FOR INSERT
      WITH CHECK (
        user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM campanhas_prospeccao 
          WHERE campanhas_prospeccao.id = campanha_id 
          AND campanhas_prospeccao.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'voice_calls' 
    AND policyname = 'Users can update their own voice calls'
  ) THEN
    CREATE POLICY "Users can update their own voice calls"
      ON voice_calls FOR UPDATE
      USING (
        user_id = auth.uid() OR
        EXISTS (
          SELECT 1 FROM campanhas_prospeccao 
          WHERE campanhas_prospeccao.id = voice_calls.campanha_id 
          AND campanhas_prospeccao.user_id = auth.uid()
        )
      );
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM pg_policies 
    WHERE tablename = 'call_queue' 
    AND policyname = 'Users can manage their own queue'
  ) THEN
    CREATE POLICY "Users can manage their own queue"
      ON call_queue FOR ALL
      USING (auth.uid() = user_id);
  END IF;
END $$;