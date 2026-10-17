import { useCallback, useEffect, useMemo, useState } from "react";
import { loadGestaoLucroBundle } from "@/lib/gestao-lucro-data.ts";
import { loadGestaoContas } from "@/lib/gestao-financeiro-load.ts";
import { loadGestaoNfeList } from "@/lib/gestao-nfe-load.ts";
import {
  computeGestaoResultadoMes,
  shiftCompetencia,
  type GestaoResultadoMesMetrics,
} from "@/lib/gestao-resultado-mes.ts";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";

export function useGestaoResultadoStrip(
  userId: string | null,
  competencia: string,
  loadNfes: boolean,
) {
  const [veiculos, setVeiculos] = useState<GestaoVeiculoEnriched[]>([]);
  const [despesasFlat, setDespesasFlat] = useState<
    Awaited<ReturnType<typeof loadGestaoLucroBundle>>["despesasFlat"]
  >([]);
  const [contasCache, setContasCache] = useState<Awaited<ReturnType<typeof loadGestaoContas>>>([]);
  const [nfesCache, setNfesCache] = useState<Awaited<ReturnType<typeof loadGestaoNfeList>>>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!userId) return;
    setLoading(true);
    const [bundle, contas, nfes] = await Promise.all([
      loadGestaoLucroBundle(userId),
      loadGestaoContas(userId),
      loadNfes ? loadGestaoNfeList(userId) : Promise.resolve([]),
    ]);
    setVeiculos(bundle.veiculos);
    setDespesasFlat(bundle.despesasFlat);
    setContasCache(contas);
    setNfesCache(nfes);
    setLoading(false);
  }, [userId, loadNfes]);

  useEffect(() => {
    void reload();
  }, [reload]);

  const metrics: GestaoResultadoMesMetrics = useMemo(
    () => computeGestaoResultadoMes(competencia, veiculos, contasCache, nfesCache),
    [competencia, veiculos, contasCache, nfesCache],
  );

  const prevMetrics: GestaoResultadoMesMetrics = useMemo(
    () => computeGestaoResultadoMes(
      shiftCompetencia(competencia, -1),
      veiculos,
      contasCache,
      nfesCache,
    ),
    [competencia, veiculos, contasCache, nfesCache],
  );

  const notasPendentes = useMemo(
    () => nfesCache.filter((n) => n.status === "processando" || n.status === "rejeitada").length,
    [nfesCache],
  );

  return { veiculos, despesasFlat, nfes: nfesCache, notasPendentes, metrics, prevMetrics, loading, reload };
}
