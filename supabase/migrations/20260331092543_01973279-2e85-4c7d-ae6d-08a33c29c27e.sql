CREATE TABLE IF NOT EXISTS autopilot_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL DEFAULT 'Meu Autopilot',
  produto_fonte TEXT NOT NULL DEFAULT 'todos',
  categoria_filtro TEXT,
  produto_ids UUID[],
  postar_facebook BOOLEAN DEFAULT true,
  postar_instagram BOOLEAN DEFAULT true,
  posts_por_dia INTEGER NOT NULL DEFAULT 3,
  dias_semana INTEGER[] NOT NULL DEFAULT ARRAY[1,2,3,4,5,6]::INTEGER[],
  horario_inicio TIME NOT NULL DEFAULT '08:00',
  horario_fim TIME NOT NULL DEFAULT '22:00',
  incluir_imagem BOOLEAN DEFAULT true,
  incluir_link BOOLEAN DEFAULT true,
  gerar_texto_ia BOOLEAN DEFAULT true,
  estilo_texto TEXT DEFAULT 'variado',
  repetir_ciclo BOOLEAN DEFAULT true,
  ativo BOOLEAN DEFAULT false,
  ultimo_produto_index INTEGER DEFAULT 0,
  ultima_execucao TIMESTAMPTZ,
  proxima_execucao TIMESTAMPTZ,
  total_publicados INTEGER DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE autopilot_config ENABLE ROW LEVEL SECURITY;

CREATE POLICY "users_own_autopilot" ON autopilot_config
  FOR ALL USING (auth.uid() = user_id);

CREATE INDEX idx_autopilot_ativo ON autopilot_config(ativo, proxima_execucao) WHERE ativo = true;
CREATE INDEX idx_autopilot_user ON autopilot_config(user_id);