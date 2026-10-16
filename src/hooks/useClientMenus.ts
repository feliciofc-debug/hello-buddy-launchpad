import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import {
  CLIENT_MENU_ROUTES,
  menusForBusinessSegment,
  usesVehicleInventoryMenu,
} from '@/lib/client-menu-routes';
import { resolveVitrineSidebarFlags } from '@/lib/vitrine-sidebar-menu';
import { VEHICLE_DEALER_TENANT_TYPE } from '@/lib/business-tenant';

interface MenuConfig {
  tipo_cliente: string;
  menus_permitidos: string[];
  empresa_nome: string;
}

export function useClientMenus(userTipo: string | null | undefined, userNomeFantasia?: string | null) {
  const [menuConfig, setMenuConfig] = useState<MenuConfig | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [vitrineVeiculosDemo, setVitrineVeiculosDemo] = useState(false);
  const [businessSegment, setBusinessSegment] = useState<string | null>(null);
  const [businessText, setBusinessText] = useState<string | null>(null);

  useEffect(() => {
    const fetchMenuConfig = async () => {
      if (!userTipo) {
        setIsLoading(false);
        return;
      }

      try {
        const configType = userTipo === VEHICLE_DEALER_TENANT_TYPE
          ? 'empresa'
          : userTipo;
        const [{ data, error }, { data: sessionData }] = await Promise.all([
          supabase
            .from('client_menu_config')
            .select('*')
            .eq('tipo_cliente', configType)
            .maybeSingle(),
          supabase.auth.getSession(),
        ]);

        if (error) {
          console.error('Erro ao buscar config de menus:', error);
        }

        let segment: string | null = null;
        let businessText: string | null = null;
        const userId = sessionData.session?.user.id;
        if (userId) {
          const { data: companyConfig, error: companyError } = await supabase
            .from('empresa_config')
            .select('segmento, sobre_negocio, vitrine_veiculos_demo')
            .eq('user_id', userId)
            .maybeSingle();
          if (companyError) {
            console.warn('Erro ao buscar segmento da empresa:', companyError);
          } else {
            segment = companyConfig?.segmento ?? null;
            businessText = companyConfig?.sobre_negocio ?? null;
            setVitrineVeiculosDemo(companyConfig?.vitrine_veiculos_demo === true);
            setBusinessSegment(segment);
            setBusinessText(businessText);
          }
        }

        const baseConfig: MenuConfig = data
          ? data as MenuConfig
          : {
            tipo_cliente: userTipo,
            menus_permitidos: [
              'dashboard', 'produtos', 'midias', 'ia-marketing', 'redes-sociais', 'whatsapp', 'integracoes', 'configuracoes'
            ],
            empresa_nome: 'AMZ Ofertas'
          };

        if (!data) {
          console.log(`Nenhuma config encontrada para tipo "${userTipo}", usando padrão`);
        }

        setMenuConfig({
          ...baseConfig,
          menus_permitidos: menusForBusinessSegment(
            baseConfig.menus_permitidos,
            userTipo,
            segment,
            businessText,
          ),
        });
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
    const menuId = CLIENT_MENU_ROUTES[route];
    if (!menuId) return true; // Rotas não mapeadas são permitidas
    return isMenuAllowed(menuId);
  };

  // Priorizar nome_fantasia do perfil do usuário sobre a config genérica
  const empresaNome = userNomeFantasia || menuConfig?.empresa_nome || 'AMZ Ofertas';

  const sidebarFlags = resolveVitrineSidebarFlags({
    clientType: userTipo,
    segment: businessSegment,
    businessText,
    vitrineVeiculosDemo,
  });

  const vitrineSidebarContext = {
    clientType: userTipo,
    segment: businessSegment,
    businessText,
    vitrineVeiculosDemo,
  };

  return {
    menuConfig,
    isLoading,
    isMenuAllowed,
    isRouteAllowed,
    empresaNome,
    showFinanciamentosMenu: sidebarFlags.showFinanciamentosMenu,
    showDemoVehicleStockAfterProdutos: sidebarFlags.showDemoVehicleStockAfterProdutos,
    usesVehicleInventoryMenu: usesVehicleInventoryMenu(
      userTipo,
      businessSegment,
      businessText,
    ),
    vitrineVeiculosDemo,
    vitrineSidebarContext,
  };
}
