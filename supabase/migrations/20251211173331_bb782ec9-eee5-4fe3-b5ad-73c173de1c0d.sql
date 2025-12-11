-- Tabela para registrar importações
CREATE TABLE public.importacoes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid NOT NULL,
  arquivo_nome text,
  total_linhas integer DEFAULT 0,
  validos integer DEFAULT 0,
  duplicados integer DEFAULT 0,
  erros integer DEFAULT 0,
  velocidade text DEFAULT 'normal',
  origem_opt_in text DEFAULT 'base_historica',
  enviar_boas_vindas boolean DEFAULT false,
  status text DEFAULT 'processando',
  progresso integer DEFAULT 0,
  tempo_decorrido_segundos integer DEFAULT 0,
  created_at timestamp with time zone DEFAULT now(),
  completed_at timestamp with time zone
);

-- Tabela para detalhes de cada linha importada
CREATE TABLE public.importacao_detalhes (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  importacao_id uuid REFERENCES public.importacoes(id) ON DELETE CASCADE,
  linha integer,
  nome text,
  whatsapp text,
  email text,
  empresa text,
  status text, -- 'sucesso', 'duplicado', 'erro'
  erro_mensagem text,
  opt_in_id uuid REFERENCES public.opt_ins(id),
  created_at timestamp with time zone DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.importacoes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.importacao_detalhes ENABLE ROW LEVEL SECURITY;

-- Policies for importacoes
CREATE POLICY "Users can view own imports" ON public.importacoes
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can create own imports" ON public.importacoes
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own imports" ON public.importacoes
  FOR UPDATE USING (auth.uid() = user_id);

-- Policies for importacao_detalhes
CREATE POLICY "Users can view own import details" ON public.importacao_detalhes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.importacoes 
      WHERE importacoes.id = importacao_detalhes.importacao_id 
      AND importacoes.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can create import details" ON public.importacao_detalhes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.importacoes 
      WHERE importacoes.id = importacao_detalhes.importacao_id 
      AND importacoes.user_id = auth.uid()
    )
  );

-- Indexes
CREATE INDEX idx_importacoes_user_id ON public.importacoes(user_id);
CREATE INDEX idx_importacao_detalhes_importacao_id ON public.importacao_detalhes(importacao_id);