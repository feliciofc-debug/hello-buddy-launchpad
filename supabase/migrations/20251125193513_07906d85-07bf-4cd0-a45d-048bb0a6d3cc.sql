-- Tabela para controlar onboarding do usuário
CREATE TABLE IF NOT EXISTS user_onboarding (
  user_id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  whatsapp_connected BOOLEAN DEFAULT FALSE,
  onboarding_completed BOOLEAN DEFAULT FALSE,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- RLS
ALTER TABLE user_onboarding ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Usuários gerenciam próprio onboarding"
ON user_onboarding FOR ALL
TO authenticated
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);