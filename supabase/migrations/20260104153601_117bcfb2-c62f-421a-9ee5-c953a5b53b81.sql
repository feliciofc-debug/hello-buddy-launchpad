-- 1. Tabela de Listas por Categoria (Casa, Bebê, Gamer, etc.)
CREATE TABLE public.afiliado_listas_categoria (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome VARCHAR(100) NOT NULL,
  icone VARCHAR(10) DEFAULT '📦',
  descricao TEXT,
  cor VARCHAR(20) DEFAULT '#3B82F6',
  ativa BOOLEAN DEFAULT true,
  total_membros INTEGER DEFAULT 0,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- 2. Tabela de Leads captados via eBook
CREATE TABLE public.leads_ebooks (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  phone VARCHAR(20) NOT NULL,
  nome VARCHAR(255),
  origem VARCHAR(100) DEFAULT 'ebook',
  origem_detalhe VARCHAR(255),
  ebook_recebido VARCHAR(255),
  cashback_ativo BOOLEAN DEFAULT true,
  primeiro_contato_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  ultimo_contato_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  total_interacoes INTEGER DEFAULT 1,
  user_id UUID,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(phone)
);

-- 3. Tabela de relacionamento N:N (Lead <-> Lista)
CREATE TABLE public.afiliado_lista_membros (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  lead_id UUID NOT NULL REFERENCES public.leads_ebooks(id) ON DELETE CASCADE,
  lista_id UUID NOT NULL REFERENCES public.afiliado_listas_categoria(id) ON DELETE CASCADE,
  adicionado_em TIMESTAMP WITH TIME ZONE DEFAULT now(),
  UNIQUE(lead_id, lista_id)
);

-- Índices para performance
CREATE INDEX idx_leads_ebooks_phone ON public.leads_ebooks(phone);
CREATE INDEX idx_afiliado_lista_membros_lead ON public.afiliado_lista_membros(lead_id);
CREATE INDEX idx_afiliado_lista_membros_lista ON public.afiliado_lista_membros(lista_id);

-- Enable RLS
ALTER TABLE public.afiliado_listas_categoria ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads_ebooks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.afiliado_lista_membros ENABLE ROW LEVEL SECURITY;

-- RLS Policies - Listas visíveis para todos (públicas do sistema)
CREATE POLICY "Listas públicas para leitura" 
ON public.afiliado_listas_categoria 
FOR SELECT 
USING (true);

CREATE POLICY "Admins podem gerenciar listas" 
ON public.afiliado_listas_categoria 
FOR ALL 
USING (auth.uid() IS NOT NULL);

-- RLS Policies - Leads
CREATE POLICY "Leads visíveis para usuários autenticados" 
ON public.leads_ebooks 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Inserir leads sem autenticação" 
ON public.leads_ebooks 
FOR INSERT 
WITH CHECK (true);

CREATE POLICY "Atualizar leads autenticados" 
ON public.leads_ebooks 
FOR UPDATE 
USING (auth.uid() IS NOT NULL);

-- RLS Policies - Membros
CREATE POLICY "Membros visíveis para autenticados" 
ON public.afiliado_lista_membros 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

CREATE POLICY "Inserir membros sem autenticação" 
ON public.afiliado_lista_membros 
FOR INSERT 
WITH CHECK (true);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_leads_ebooks_updated_at
  BEFORE UPDATE ON public.leads_ebooks
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_afiliado_listas_categoria_updated_at
  BEFORE UPDATE ON public.afiliado_listas_categoria
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Função para atualizar contador de membros na lista
CREATE OR REPLACE FUNCTION public.atualizar_total_membros_lista()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    UPDATE public.afiliado_listas_categoria 
    SET total_membros = total_membros + 1 
    WHERE id = NEW.lista_id;
    RETURN NEW;
  ELSIF TG_OP = 'DELETE' THEN
    UPDATE public.afiliado_listas_categoria 
    SET total_membros = total_membros - 1 
    WHERE id = OLD.lista_id;
    RETURN OLD;
  END IF;
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

CREATE TRIGGER trigger_atualizar_total_membros
  AFTER INSERT OR DELETE ON public.afiliado_lista_membros
  FOR EACH ROW
  EXECUTE FUNCTION public.atualizar_total_membros_lista();