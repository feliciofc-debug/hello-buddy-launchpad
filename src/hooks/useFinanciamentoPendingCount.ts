import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import {
  FINANCIAMENTO_FICHA_CHANGED_EVENT,
  formatFinanciamentoPendingBadge,
} from "@/lib/financiamento-fichas-menu";

const POLL_MS = 60_000;

async function fetchPendingCount(): Promise<number> {
  const { count, error } = await supabase
    .from("financiamento_fichas" as "veiculos_estoque")
    .select("id", { count: "exact", head: true })
    .eq("status", "pendente");
  if (error) {
    console.warn("[financiamento] contagem pendentes:", error.message);
    return 0;
  }
  return count ?? 0;
}

export function useFinanciamentoPendingCount(enabled: boolean) {
  const [pendingCount, setPendingCount] = useState(0);
  const knownIdsRef = useRef<Set<string>>(new Set());
  const bootstrappedRef = useRef(false);

  const refresh = useCallback(async () => {
    if (!enabled) {
      setPendingCount(0);
      return;
    }
    const count = await fetchPendingCount();
    setPendingCount(count);
  }, [enabled]);

  useEffect(() => {
    if (!enabled) return;

    let cancelled = false;

    const bootstrapRecent = async () => {
      const { data } = await supabase
        .from("financiamento_fichas" as "veiculos_estoque")
        .select("id")
        .eq("status", "pendente")
        .order("created_at", { ascending: false })
        .limit(50);
      for (const row of data ?? []) {
        knownIdsRef.current.add(String(row.id));
      }
      bootstrappedRef.current = true;
    };

    const run = async () => {
      await bootstrapRecent();
      if (!cancelled) await refresh();
    };
    void run();

    const onChanged = () => {
      void refresh();
    };
    window.addEventListener(FINANCIAMENTO_FICHA_CHANGED_EVENT, onChanged);

    const interval = window.setInterval(() => {
      void refresh();
    }, POLL_MS);

    const setupRealtime = async () => {
      const { data: sessionData } = await supabase.auth.getSession();
      const userId = sessionData.session?.user.id;
      if (!userId || cancelled) return;

      const channel = supabase
        .channel(`financiamento-fichas-${userId}`)
        .on(
          "postgres_changes",
          {
            event: "INSERT",
            schema: "public",
            table: "financiamento_fichas",
            filter: `user_id=eq.${userId}`,
          },
          (payload) => {
            const row = payload.new as {
              id?: string;
              status?: string;
              nome_completo?: string | null;
            };
            if (row.status !== "pendente" || !row.id) return;
            if (!bootstrappedRef.current) {
              knownIdsRef.current.add(row.id);
              return;
            }
            if (knownIdsRef.current.has(row.id)) return;
            knownIdsRef.current.add(row.id);
            void refresh();
            const nome = String(row.nome_completo || "").trim() || "Cliente";
            toast("📄 Nova ficha de financiamento", {
              description: nome,
              action: {
                label: "Abrir",
                onClick: () => {
                  window.location.href = `/veiculos/financiamento/${row.id}`;
                },
              },
              duration: 8000,
            });
          },
        )
        .subscribe();

      return channel;
    };

    let channel: ReturnType<typeof supabase.channel> | undefined;
    void setupRealtime().then((ch) => {
      channel = ch;
    });

    return () => {
      cancelled = true;
      window.removeEventListener(FINANCIAMENTO_FICHA_CHANGED_EVENT, onChanged);
      window.clearInterval(interval);
      if (channel) supabase.removeChannel(channel);
    };
  }, [enabled, refresh]);

  const badgeLabel = formatFinanciamentoPendingBadge(pendingCount);

  return { pendingCount, badgeLabel, refresh };
}
