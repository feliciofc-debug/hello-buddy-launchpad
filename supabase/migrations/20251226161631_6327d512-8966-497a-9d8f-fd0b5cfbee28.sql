-- Tabela de configuração de menus por tipo de cliente
CREATE TABLE public.client_menu_config (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  tipo_cliente TEXT NOT NULL UNIQUE,
  menus_permitidos TEXT[] NOT NULL,
  empresa_nome TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- RLS
ALTER TABLE public.client_menu_config ENABLE ROW LEVEL SECURITY;

-- Política: todos autenticados podem ler
CREATE POLICY "Authenticated users can read menu config"
ON public.client_menu_config FOR SELECT
TO authenticated
USING (true);

-- Inserir config B2B (MCassab)
INSERT INTO public.client_menu_config (tipo_cliente, menus_permitidos, empresa_nome) VALUES 
('b2b', ARRAY[
  'produtos', 'whatsapp', 'conectar-whatsapp', 'ia-conversas', 
  'ia-marketing', 'campanhas-prospeccao', 'buscar-cnpj', 
  'leads-funil', 'configurar-icp', 'vendedores', 'biblioteca', 'analytics'
], 'MCassab Consumo');

-- Config padrão (sua plataforma matriz - TODOS os menus)
INSERT INTO public.client_menu_config (tipo_cliente, menus_permitidos, empresa_nome) VALUES 
('afiliado', ARRAY[
  'produtos', 'whatsapp', 'conectar-whatsapp', 'ia-conversas', 
  'ia-marketing', 'campanhas-prospeccao', 'buscar-cnpj', 
  'leads-funil', 'configurar-icp', 'vendedores', 'biblioteca', 'analytics',
  'google-ads', 'shopee', 'marketplace', 'lomadee', 'redes-sociais'
], 'AMZ Ofertas');