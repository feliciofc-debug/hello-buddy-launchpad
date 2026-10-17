import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { GestaoResultadoMesStrip } from "@/components/gestao/lucro/GestaoResultadoMesStrip.tsx";
import { useGestaoFocusnfeConnection } from "@/components/integracoes/useGestaoFocusnfeConnection";
import { useGestaoResultadoStrip } from "@/hooks/useGestaoResultadoStrip";
import { competenciaFromDate } from "../../../supabase/functions/_shared/gestao-meta-calc.ts";

export function GestaoDashboardResultadoWidget() {
  const [userId, setUserId] = useState<string | null>(null);
  const focusnfe = useGestaoFocusnfeConnection();
  const competencia = competenciaFromDate();

  useEffect(() => {
    void supabase.auth.getUser().then(({ data }) => {
      setUserId(data.user?.id ?? null);
    });
  }, []);

  const { metrics, prevMetrics, loading } = useGestaoResultadoStrip(
    userId,
    competencia,
    !!focusnfe.status?.connected,
  );

  if (!userId) return null;

  return (
    <GestaoResultadoMesStrip
      variant="dashboard"
      competencia={competencia}
      onCompetenciaChange={() => {}}
      metrics={metrics}
      prevMetrics={prevMetrics}
      focusConnected={focusnfe.loading ? null : !!focusnfe.status?.connected}
      loading={loading}
    />
  );
}
