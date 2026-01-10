-- Tabela para controlar a fila de prospecção do Pietro Eugenio
CREATE TABLE public.fila_prospeccao_pietro (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL,
  lead_id UUID,
  phone TEXT NOT NULL,
  nome TEXT,
  status TEXT NOT NULL DEFAULT 'pendente',
  lote INTEGER NOT NULL DEFAULT 1,
  enviado_em TIMESTAMP WITH TIME ZONE,
  respondeu BOOLEAN DEFAULT false,
  erro TEXT,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.fila_prospeccao_pietro ENABLE ROW LEVEL SECURITY;

-- Policies
CREATE POLICY "Users can view their own queue"
ON public.fila_prospeccao_pietro
FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own queue"
ON public.fila_prospeccao_pietro
FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own queue"
ON public.fila_prospeccao_pietro
FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own queue"
ON public.fila_prospeccao_pietro
FOR DELETE USING (auth.uid() = user_id);

-- Index para performance
CREATE INDEX idx_fila_prospeccao_status ON public.fila_prospeccao_pietro(user_id, status, lote);
CREATE INDEX idx_fila_prospeccao_phone ON public.fila_prospeccao_pietro(phone);

-- Trigger para updated_at
CREATE TRIGGER update_fila_prospeccao_updated_at
BEFORE UPDATE ON public.fila_prospeccao_pietro
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();