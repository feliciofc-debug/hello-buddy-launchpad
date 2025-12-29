-- Tabela de campanhas isolada para afiliados
CREATE TABLE public.afiliado_campanhas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  produto_id UUID REFERENCES public.afiliado_produtos(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  mensagem_template TEXT NOT NULL,
  frequencia TEXT NOT NULL DEFAULT 'diaria',
  data_inicio DATE NOT NULL,
  horarios TIME[] NOT NULL DEFAULT ARRAY['10:00:00'::time],
  dias_semana INTEGER[] DEFAULT ARRAY[]::integer[],
  ativa BOOLEAN DEFAULT true,
  status TEXT DEFAULT 'ativa',
  proxima_execucao TIMESTAMP WITH TIME ZONE,
  ultima_execucao TIMESTAMP WITH TIME ZONE,
  total_enviados INTEGER DEFAULT 0,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.afiliado_campanhas ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can manage own afiliado_campanhas"
ON public.afiliado_campanhas
FOR ALL
USING (auth.uid() = user_id)
WITH CHECK (auth.uid() = user_id);

-- Trigger para updated_at
CREATE TRIGGER update_afiliado_campanhas_updated_at
BEFORE UPDATE ON public.afiliado_campanhas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();