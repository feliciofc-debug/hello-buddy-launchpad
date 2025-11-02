-- Criar tabela de lojas/clientes
CREATE TABLE public.lojas (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  nome TEXT NOT NULL,
  descricao TEXT,
  contato TEXT,
  email TEXT,
  telefone TEXT,
  ativo BOOLEAN DEFAULT true,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.lojas ENABLE ROW LEVEL SECURITY;

-- RLS Policies para lojas
CREATE POLICY "Usuários podem ver suas próprias lojas"
ON public.lojas FOR SELECT
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem criar suas próprias lojas"
ON public.lojas FOR INSERT
WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Usuários podem atualizar suas próprias lojas"
ON public.lojas FOR UPDATE
USING (auth.uid() = user_id);

CREATE POLICY "Usuários podem deletar suas próprias lojas"
ON public.lojas FOR DELETE
USING (auth.uid() = user_id);

-- Adicionar loja_id à tabela produtos (NULL = produtos próprios da empresa)
ALTER TABLE public.produtos ADD COLUMN loja_id UUID REFERENCES public.lojas(id) ON DELETE CASCADE;

-- Criar trigger para updated_at em lojas
CREATE TRIGGER update_lojas_updated_at
BEFORE UPDATE ON public.lojas
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();