import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useScheduledCampaigns } from '@/hooks/useScheduledCampaigns';
import { useAfiliadoScheduledCampaigns } from '@/hooks/useAfiliadoScheduledCampaigns';

/**
 * Componente global que executa campanhas agendadas
 * Suporta tanto campanhas PJ (campanhas_recorrentes) quanto Afiliado (afiliado_campanhas)
 * Deve ser incluído no App.tsx para funcionar em qualquer página
 */
export function CampaignScheduler() {
  const [userId, setUserId] = useState<string>();

  useEffect(() => {
    const getUser = async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
        console.log('🎯 CampaignScheduler ativo para usuário:', user.id);
      }
    };

    getUser();

    // Escutar mudanças de auth
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setUserId(session?.user?.id);
    });

    return () => subscription.unsubscribe();
  }, []);

  // Hook para campanhas PJ (campanhas_recorrentes)
  useScheduledCampaigns(userId);

  // Hook para campanhas AFILIADO (afiliado_campanhas)
  useAfiliadoScheduledCampaigns(userId);

  // Componente invisível - apenas executa a lógica
  return null;
}
