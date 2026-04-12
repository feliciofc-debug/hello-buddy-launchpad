import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';

export function useFeatureFlag(flagKey: string): boolean {
  const [hasAccess, setHasAccess] = useState(false);

  useEffect(() => {
    const checkFlag = async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user?.email) {
          setHasAccess(false);
          return;
        }

        const { data: flag } = await supabase
          .from('feature_flags')
          .select('*')
          .eq('flag_key', flagKey)
          .maybeSingle();

        if (!flag) {
          setHasAccess(false);
          return;
        }

        // Flag enabled globally OR user email is in allowed list
        const isAllowed = (flag as any).is_enabled || ((flag as any).allowed_emails || []).includes(user.email);
        setHasAccess(isAllowed);
      } catch (error) {
        console.error('Erro ao verificar feature flag:', error);
        setHasAccess(false);
      }
    };

    checkFlag();
  }, [flagKey]);

  return hasAccess;
}
