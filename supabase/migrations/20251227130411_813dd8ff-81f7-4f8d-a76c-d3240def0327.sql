-- Tabela de créditos de vídeo
CREATE TABLE IF NOT EXISTS user_video_credits (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE UNIQUE,
  credits_remaining INTEGER DEFAULT 10,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_user_video_credits_user_id ON user_video_credits(user_id);

-- RLS
ALTER TABLE user_video_credits ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own credits"
  ON user_video_credits FOR SELECT
  USING (auth.uid() = user_id);

CREATE POLICY "Users can update own credits"
  ON user_video_credits FOR UPDATE
  USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own credits"
  ON user_video_credits FOR INSERT
  WITH CHECK (auth.uid() = user_id);

CREATE POLICY "System can manage credits"
  ON user_video_credits FOR ALL
  USING (true);

-- Trigger para criar créditos quando usuário se cadastra
CREATE OR REPLACE FUNCTION public.create_user_video_credits()
RETURNS TRIGGER 
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  INSERT INTO user_video_credits (user_id, credits_remaining)
  VALUES (NEW.id, 10)
  ON CONFLICT (user_id) DO NOTHING;
  RETURN NEW;
END;
$$;

-- Trigger
DROP TRIGGER IF EXISTS on_user_created_video_credits ON auth.users;
CREATE TRIGGER on_user_created_video_credits
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.create_user_video_credits();