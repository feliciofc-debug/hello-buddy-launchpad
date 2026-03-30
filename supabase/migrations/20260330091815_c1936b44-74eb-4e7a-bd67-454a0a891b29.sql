CREATE TABLE IF NOT EXISTS social_schedule_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  platform TEXT NOT NULL CHECK (platform IN ('facebook', 'instagram', 'facebook_instagram')),
  page_id TEXT NOT NULL DEFAULT '855785300949909',
  frequencia TEXT NOT NULL CHECK (frequencia IN ('diario', 'semanal', 'personalizado')),
  dias_semana INTEGER[] DEFAULT ARRAY[1,2,3,4,5]::INTEGER[],
  horarios TIME[] NOT NULL DEFAULT ARRAY['10:00']::TIME[],
  incluir_imagem BOOLEAN DEFAULT true,
  incluir_link BOOLEAN DEFAULT true,
  ativo BOOLEAN DEFAULT true,
  produtos_fonte TEXT DEFAULT 'todos',
  categoria_filtro TEXT,
  proxima_execucao TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE social_schedule_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_schedule" ON social_schedule_config
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_social_schedule_config_user ON social_schedule_config(user_id);
CREATE INDEX idx_social_schedule_config_proxima ON social_schedule_config(proxima_execucao) WHERE ativo = true;