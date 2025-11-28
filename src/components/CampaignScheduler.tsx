import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useScheduledCampaigns } from '@/hooks/useScheduledCampaigns';

/**
 * Componente global que executa campanhas agendadas
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

  // Hook que verifica e executa campanhas a cada minuto
  useScheduledCampaigns(userId);

  // Componente invisível - apenas executa a lógica
  return null;
}
