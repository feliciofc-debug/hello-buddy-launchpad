import { useEffect, useMemo, useRef, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useScheduledCampaigns } from '@/hooks/useScheduledCampaigns';
import { useAfiliadoScheduledCampaigns } from '@/hooks/useAfiliadoScheduledCampaigns';

/**
 * Componente global que executa campanhas agendadas
 * Suporta tanto campanhas PJ (campanhas_recorrentes) quanto Afiliado (afiliado_campanhas)
 * Também dispara o envio programado de afiliados (programacao_envio_afiliado)
 * Deve ser incluído no App.tsx para funcionar em qualquer página
 */
export function CampaignScheduler() {
  const [userId, setUserId] = useState<string>();
  const [isLeader, setIsLeader] = useState(false);
  const tabIdRef = useRef<string>('');
  const lastEnvioProgramadoRef = useRef<number>(0);

  useEffect(() => {
    tabIdRef.current =
      (globalThis.crypto as any)?.randomUUID?.() ||
      `${Date.now()}_${Math.random().toString(16).slice(2)}`;
  }, []);

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

  // ✅ Evita triplicação quando o usuário abre 2-3 abas/janelas: só 1 aba vira "líder" e executa o scheduler.
  useEffect(() => {
    const KEY = 'campaign_scheduler_leader_v1';
    const TTL_MS = 15_000; // líder expira se ficar 15s sem heartbeat

    const tick = () => {
      try {
        const raw = localStorage.getItem(KEY);
        const now = Date.now();
        const current = raw ? (JSON.parse(raw) as { id: string; ts: number }) : null;

        const expired = !current || !current.ts || now - current.ts > TTL_MS;
        const iAmLeader = current?.id === tabIdRef.current;

        if (expired || iAmLeader) {
          localStorage.setItem(KEY, JSON.stringify({ id: tabIdRef.current, ts: now }));
          if (!isLeader) console.log('👑 CampaignScheduler: esta aba virou líder');
          setIsLeader(true);
        } else {
          setIsLeader(false);
        }
      } catch {
        // Se localStorage falhar por qualquer motivo, mantém o comportamento atual
        setIsLeader(true);
      }
    };

    tick();
    const interval = setInterval(tick, 5_000);
    return () => clearInterval(interval);
  }, [isLeader]);

  const effectiveUserId = useMemo(() => (isLeader ? userId : undefined), [isLeader, userId]);

  // Hook para campanhas PJ (campanhas_recorrentes)
  useScheduledCampaigns(effectiveUserId);

  // Hook para campanhas AFILIADO (afiliado_campanhas)
  useAfiliadoScheduledCampaigns(effectiveUserId);

  // ✅ Dispara executar-envio-programado a cada 60s (apenas aba líder)
  const triggerEnvioProgramado = useCallback(async () => {
    if (!isLeader || !userId) return;
    
    const now = Date.now();
    // Evita chamadas mais frequentes que 55s
    if (now - lastEnvioProgramadoRef.current < 55_000) return;
    lastEnvioProgramadoRef.current = now;

    try {
      console.log('📤 [ENVIO PROGRAMADO] Disparando verificação...');
      const response = await supabase.functions.invoke('executar-envio-programado', {
        body: { userId }
      });
      
      if (response.error) {
        console.error('❌ [ENVIO PROGRAMADO] Erro:', response.error);
      } else {
        const data = response.data;
        if (data?.enviados > 0) {
          console.log(`✅ [ENVIO PROGRAMADO] ${data.enviados} mensagem(ns) enviada(s)`);
        } else {
          console.log('⏳ [ENVIO PROGRAMADO] Nenhum envio pendente');
        }
      }
    } catch (err) {
      console.error('❌ [ENVIO PROGRAMADO] Erro na chamada:', err);
    }
  }, [isLeader, userId]);

  useEffect(() => {
    if (!isLeader || !userId) return;

    // Primeira execução após 5s
    const initialTimeout = setTimeout(triggerEnvioProgramado, 5_000);
    
    // Depois a cada 60s
    const interval = setInterval(triggerEnvioProgramado, 60_000);

    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [isLeader, userId, triggerEnvioProgramado]);

  // Componente invisível - apenas executa a lógica
  return null;
}

