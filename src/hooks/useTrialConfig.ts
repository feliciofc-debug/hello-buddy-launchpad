import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";

interface TrialConfig {
  id: string;
  user_id: string;
  email: string;
  limite_imagens_ia: number;
  imagens_ia_usadas: number;
  ia_marketing_bloqueada: boolean;
  limite_posts_dia: number;
  posts_hoje: number;
  data_ultimo_post: string | null;
  data_inicio: string;
  data_fim: string;
  status: string;
}

export function useTrialConfig() {
  const [trial, setTrial] = useState<TrialConfig | null>(null);
  const [isTrial, setIsTrial] = useState(false);
  const [loading, setLoading] = useState(true);

  const loadTrial = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { setLoading(false); return; }

      const { data, error } = await supabase
        .from("trial_configs" as any)
        .select("*")
        .eq("user_id", user.id)
        .single();

      if (data && !error) {
        const config = data as any as TrialConfig;
        
        // Check if trial expired
        if (new Date(config.data_fim) < new Date() && config.status === 'ativo') {
          config.status = 'expirado';
          await supabase.from("trial_configs" as any).update({ status: 'expirado' } as any).eq("id", config.id);
        }

        // Reset daily post count if new day
        const hoje = new Date().toISOString().split('T')[0];
        if (config.data_ultimo_post !== hoje) {
          config.posts_hoje = 0;
          await supabase.from("trial_configs" as any).update({ posts_hoje: 0, data_ultimo_post: hoje } as any).eq("id", config.id);
        }

        // Auto-block IA if limit reached
        if (config.imagens_ia_usadas >= config.limite_imagens_ia && !config.ia_marketing_bloqueada) {
          config.ia_marketing_bloqueada = true;
          await supabase.from("trial_configs" as any).update({ ia_marketing_bloqueada: true } as any).eq("id", config.id);
        }

        setTrial(config);
        setIsTrial(true);
      } else {
        setIsTrial(false);
      }
    } catch (err) {
      console.error("Erro ao carregar trial:", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadTrial(); }, []);

  const canUseIAMarketing = (): boolean => {
    if (!isTrial || !trial) return true;
    if (trial.status !== 'ativo') return false;
    if (trial.ia_marketing_bloqueada) return false;
    if (trial.imagens_ia_usadas >= trial.limite_imagens_ia) return false;
    return true;
  };

  const canPostToday = (): boolean => {
    if (!isTrial || !trial) return true;
    if (trial.status !== 'ativo') return false;
    if (trial.posts_hoje >= trial.limite_posts_dia) return false;
    return true;
  };

  const isTrialExpired = (): boolean => {
    if (!isTrial || !trial) return false;
    return trial.status === 'expirado' || trial.status === 'bloqueado';
  };

  const incrementImageUsage = async () => {
    if (!trial) return;
    const newCount = trial.imagens_ia_usadas + 1;
    const blocked = newCount >= trial.limite_imagens_ia;
    await supabase.from("trial_configs" as any).update({ 
      imagens_ia_usadas: newCount, 
      ia_marketing_bloqueada: blocked 
    } as any).eq("id", trial.id);
    setTrial({ ...trial, imagens_ia_usadas: newCount, ia_marketing_bloqueada: blocked });
  };

  const incrementPostUsage = async () => {
    if (!trial) return;
    const hoje = new Date().toISOString().split('T')[0];
    const newCount = trial.posts_hoje + 1;
    await supabase.from("trial_configs" as any).update({ 
      posts_hoje: newCount, 
      data_ultimo_post: hoje 
    } as any).eq("id", trial.id);
    setTrial({ ...trial, posts_hoje: newCount, data_ultimo_post: hoje });
  };

  const trialDaysRemaining = (): number => {
    if (!trial) return 0;
    const end = new Date(trial.data_fim);
    const now = new Date();
    return Math.max(0, Math.ceil((end.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  };

  return {
    trial,
    isTrial,
    loading,
    canUseIAMarketing,
    canPostToday,
    isTrialExpired,
    incrementImageUsage,
    incrementPostUsage,
    trialDaysRemaining,
    reload: loadTrial
  };
}
