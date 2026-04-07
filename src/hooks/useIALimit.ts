import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";

interface IALimitState {
  limite: number;
  usado: number;
  mesReferencia: string;
  loaded: boolean;
}

/**
 * Hook para controlar limite de geração de imagens IA por mês
 * para TODOS os clientes PJ (não apenas trial).
 * Limite padrão: 50 imagens/mês.
 */
export function useIALimit() {
  const [state, setState] = useState<IALimitState>({
    limite: 50,
    usado: 0,
    mesReferencia: "",
    loaded: false,
  });
  const [userId, setUserId] = useState<string | null>(null);

  const mesAtual = new Date().toISOString().slice(0, 7); // "YYYY-MM"

  const load = useCallback(async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      const { data, error } = await supabase
        .from("pj_clientes_config")
        .select("limite_imagens_ia_mes, imagens_ia_mes_atual, mes_referencia_ia")
        .eq("user_id", user.id)
        .single();

      if (!data || error) {
        // Sem config PJ = sem limite (VIP/bypass)
        setState({ limite: 9999, usado: 0, mesReferencia: mesAtual, loaded: true });
        return;
      }

      let usado = data.imagens_ia_mes_atual ?? 0;

      // Reset mensal automático
      if (data.mes_referencia_ia !== mesAtual) {
        usado = 0;
        await supabase
          .from("pj_clientes_config")
          .update({
            imagens_ia_mes_atual: 0,
            mes_referencia_ia: mesAtual,
          } as any)
          .eq("user_id", user.id);
      }

      setState({
        limite: data.limite_imagens_ia_mes ?? 50,
        usado,
        mesReferencia: mesAtual,
        loaded: true,
      });
    } catch (err) {
      console.error("Erro ao carregar limite IA:", err);
      setState((s) => ({ ...s, loaded: true }));
    }
  }, [mesAtual]);

  useEffect(() => { load(); }, [load]);

  const canGenerate = (): boolean => {
    if (!state.loaded) return false;
    return state.usado < state.limite;
  };

  const remaining = (): number => {
    return Math.max(0, state.limite - state.usado);
  };

  const incrementUsage = async () => {
    if (!userId) return;
    const newCount = state.usado + 1;

    await supabase
      .from("pj_clientes_config")
      .update({
        imagens_ia_mes_atual: newCount,
        mes_referencia_ia: mesAtual,
      } as any)
      .eq("user_id", userId);

    setState((s) => ({ ...s, usado: newCount }));
  };

  return {
    iaLimite: state.limite,
    iaUsado: state.usado,
    iaLoaded: state.loaded,
    canGenerate,
    remaining,
    incrementUsage,
    reloadIALimit: load,
  };
}
