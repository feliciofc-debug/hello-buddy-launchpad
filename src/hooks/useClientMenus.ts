import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

interface MenuConfig {
  tipo_cliente: string;
  menus_permitidos: string[];
  empresa_nome: string;
}

// Mapeamento de rotas para IDs de menu
const routeToMenuId: Record<string, string> = {
  '/dashboard': 'dashboard',
  '/meus-produtos': 'produtos',
  '/whatsapp': 'whatsapp',
  '/configuracoes-whatsapp': 'conectar-whatsapp',
  '/ia-conversas': 'ia-conversas',
  '/ia-marketing': 'ia-marketing',
  '/campanhas-prospeccao': 'campanhas-prospeccao',
  '/prospects': 'buscar-cnpj',
  '/leads-funil': 'leads-funil',
  '/configuracoes-icp': 'configurar-icp',
  '/vendedores': 'vendedores',
  '/biblioteca': 'biblioteca',
  '/analytics': 'analytics',
  '/google-ads': 'google-ads',
  '/lomadee': 'lomadee',
  '/marketplace': 'marketplace',
  '/configuracoes/redes-sociais': 'redes-sociais',
  '/produtos': 'shopee',
};

export function useClientMenus(userTipo: string | null | undefined) {
  const [menuConfig, setMenuConfig] = useState<MenuConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const fetchMenuConfig = async () => {
      if (!userTipo) {
        setIsLoading(false);
        return;
      }

      try {
        // Buscar configuração de menus para o tipo de cliente
        const { data, error } = await supabase
          .from('client_menu_config')
          .select('*')
          .eq('tipo_cliente', userTipo)
          .maybeSingle();

        if (error) {
          console.error('Erro ao buscar config de menus:', error);
        }

        if (data) {
          setMenuConfig(data as MenuConfig);
        } else {
          // Se não encontrou config específica, usar config padrão (afiliado = todos menus)
          console.log(`Nenhuma config encontrada para tipo "${userTipo}", usando padrão`);
          setMenuConfig({
            tipo_cliente: userTipo,
            menus_permitidos: [
              'dashboard', 'produtos', 'whatsapp', 'conectar-whatsapp', 'ia-conversas',
              'ia-marketing', 'campanhas-prospeccao', 'buscar-cnpj', 'leads-funil',
              'configurar-icp', 'vendedores', 'biblioteca', 'analytics',
              'google-ads', 'shopee', 'marketplace', 'lomadee', 'redes-sociais'
            ],
            empresa_nome: 'AMZ Ofertas'
          });
        }
      } catch (err) {
        console.error('Erro:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchMenuConfig();
  }, [userTipo]);

  // Função para verificar se um menu está permitido
  const isMenuAllowed = (menuId: string): boolean => {
    if (!menuConfig) return true; // Se não carregou config, mostrar tudo
    return menuConfig.menus_permitidos.includes(menuId);
  };

  // Função para verificar se uma rota está permitida
  const isRouteAllowed = (route: string): boolean => {
    const menuId = routeToMenuId[route];
    if (!menuId) return true; // Rotas não mapeadas são permitidas
    return isMenuAllowed(menuId);
  };

  return {
    menuConfig,
    isLoading,
    isMenuAllowed,
    isRouteAllowed,
    empresaNome: menuConfig?.empresa_nome || 'AMZ Ofertas'
  };
}
