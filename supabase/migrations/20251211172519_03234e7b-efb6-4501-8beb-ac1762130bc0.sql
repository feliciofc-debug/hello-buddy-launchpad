-- Criar tabela opt_ins para formulário de newsletter WhatsApp
CREATE TABLE public.opt_ins (
  id uuid NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  nome text NOT NULL,
  whatsapp text NOT NULL,
  email text,
  opt_in_aceito boolean DEFAULT true,
  data_cadastro timestamp with time zone DEFAULT now(),
  ip_address text,
  user_agent text,
  origem text DEFAULT 'site_footer',
  termo_aceite text DEFAULT 'Autorizo a AMZ Ofertas a me enviar informações, ofertas e conteúdos via WhatsApp. Posso cancelar enviando SAIR.',
  status text DEFAULT 'ativo',
  created_at timestamp with time zone DEFAULT now(),
  updated_at timestamp with time zone DEFAULT now()
);

-- Índice único para evitar duplicados de WhatsApp
CREATE UNIQUE INDEX idx_opt_ins_whatsapp ON public.opt_ins(whatsapp);

-- Enable RLS
ALTER TABLE public.opt_ins ENABLE ROW LEVEL SECURITY;

-- Policy para permitir INSERT público (qualquer pessoa pode se cadastrar)
CREATE POLICY "Anyone can insert opt_ins" 
ON public.opt_ins 
FOR INSERT 
WITH CHECK (true);

-- Policy para usuários autenticados visualizarem
CREATE POLICY "Authenticated users can view opt_ins" 
ON public.opt_ins 
FOR SELECT 
USING (auth.uid() IS NOT NULL);

-- Trigger para atualizar updated_at
CREATE TRIGGER update_opt_ins_updated_at
BEFORE UPDATE ON public.opt_ins
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();