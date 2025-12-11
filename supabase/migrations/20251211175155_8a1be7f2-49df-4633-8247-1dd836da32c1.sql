
-- Tabela de cadastros
CREATE TABLE IF NOT EXISTS public.cadastros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  -- Dados pessoais
  nome text NOT NULL,
  whatsapp text NOT NULL,
  email text,
  empresa text,
  
  -- Status
  whatsapp_validado boolean DEFAULT false,
  opt_in boolean DEFAULT true,
  opt_in_id uuid REFERENCES opt_ins(id),
  
  -- Origem
  origem text DEFAULT 'manual',
  
  -- Tags
  tags text[],
  
  -- Engajamento
  ultima_interacao timestamp with time zone,
  total_mensagens_enviadas integer DEFAULT 0,
  total_mensagens_recebidas integer DEFAULT 0,
  bloqueou boolean DEFAULT false,
  respondeu_alguma_vez boolean DEFAULT false,
  
  -- Metadados
  notas text,
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de grupos de transmissão
CREATE TABLE IF NOT EXISTS public.grupos_transmissao (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  
  nome text NOT NULL,
  descricao text,
  cor text DEFAULT '#E31E24',
  icone text DEFAULT '📋',
  
  total_membros integer DEFAULT 0,
  ativo boolean DEFAULT true,
  
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Tabela de relação N:N entre grupos e cadastros
CREATE TABLE IF NOT EXISTS public.grupo_membros (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  grupo_id uuid REFERENCES grupos_transmissao(id) ON DELETE CASCADE NOT NULL,
  cadastro_id uuid REFERENCES cadastros(id) ON DELETE CASCADE NOT NULL,
  adicionado_em timestamp with time zone DEFAULT now(),
  
  UNIQUE(grupo_id, cadastro_id)
);

-- Índices
CREATE INDEX IF NOT EXISTS idx_cadastros_whatsapp ON cadastros(whatsapp);
CREATE INDEX IF NOT EXISTS idx_cadastros_user ON cadastros(user_id);
CREATE INDEX IF NOT EXISTS idx_grupo_membros_grupo ON grupo_membros(grupo_id);
CREATE INDEX IF NOT EXISTS idx_grupo_membros_cadastro ON grupo_membros(cadastro_id);

-- RLS
ALTER TABLE cadastros ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupos_transmissao ENABLE ROW LEVEL SECURITY;
ALTER TABLE grupo_membros ENABLE ROW LEVEL SECURITY;

-- Políticas cadastros
CREATE POLICY "Users can view own cadastros" ON cadastros FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own cadastros" ON cadastros FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own cadastros" ON cadastros FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own cadastros" ON cadastros FOR DELETE USING (auth.uid() = user_id);

-- Políticas grupos_transmissao
CREATE POLICY "Users can view own grupos" ON grupos_transmissao FOR SELECT USING (auth.uid() = user_id);
CREATE POLICY "Users can insert own grupos" ON grupos_transmissao FOR INSERT WITH CHECK (auth.uid() = user_id);
CREATE POLICY "Users can update own grupos" ON grupos_transmissao FOR UPDATE USING (auth.uid() = user_id);
CREATE POLICY "Users can delete own grupos" ON grupos_transmissao FOR DELETE USING (auth.uid() = user_id);

-- Políticas grupo_membros
CREATE POLICY "Users can view own grupo_membros" ON grupo_membros FOR SELECT 
USING (EXISTS (SELECT 1 FROM grupos_transmissao WHERE grupos_transmissao.id = grupo_membros.grupo_id AND grupos_transmissao.user_id = auth.uid()));

CREATE POLICY "Users can insert own grupo_membros" ON grupo_membros FOR INSERT 
WITH CHECK (EXISTS (SELECT 1 FROM grupos_transmissao WHERE grupos_transmissao.id = grupo_membros.grupo_id AND grupos_transmissao.user_id = auth.uid()));

CREATE POLICY "Users can delete own grupo_membros" ON grupo_membros FOR DELETE 
USING (EXISTS (SELECT 1 FROM grupos_transmissao WHERE grupos_transmissao.id = grupo_membros.grupo_id AND grupos_transmissao.user_id = auth.uid()));
