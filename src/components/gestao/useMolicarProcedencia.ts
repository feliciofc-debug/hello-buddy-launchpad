import { useCallback, useEffect, useMemo, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import {
  molicarDebtTotal,
  type MolicarProcedenciaRow,
  type MolicarProcedenciaServico,
  normalizeMolicarProcedenciaRows,
} from "@/lib/molicar-procedencia";
export type {
  MolicarProcedenciaRow,
  MolicarProcedenciaServico,
} from "@/lib/molicar-procedencia";

export function useMolicarProcedencia(input: {
  placa?: string | null;
  vin?: string | null;
  veiculoId?: string | null;
  trocaId?: string | null;
  enabled?: boolean;
}) {
  const [rows, setRows] = useState<MolicarProcedenciaRow[]>([]);
  const [loading, setLoading] = useState(false);
  const [consulting, setConsulting] = useState(false);
  const [initialized, setInitialized] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const body = useMemo(() => ({
    veiculo_id: input.veiculoId ?? null,
    troca_id: input.trocaId ?? null,
    placa: input.placa?.replace(/\W/g, "").toUpperCase() || null,
    vin: input.vin?.replace(/[^A-Z0-9]/gi, "").toUpperCase() || null,
  }), [input.placa, input.trocaId, input.veiculoId, input.vin]);

  const reload = useCallback(async () => {
    if (
      input.enabled === false ||
      (!body.veiculo_id && !body.troca_id && !body.placa && !body.vin)
    ) return [];
    setLoading(true);
    const { data, error: invokeError } = await supabase.functions.invoke(
      "molicar-procedencia",
      {
        body: { action: "listar", ...body },
      },
    );
    setLoading(false);
    setInitialized(true);
    if (invokeError || data?.error) {
      setError(
        String(
          data?.error ?? invokeError?.message ??
            "Falha ao carregar a procedência.",
        ),
      );
      return [];
    }
    const next = normalizeMolicarProcedenciaRows(data);
    setRows(next);
    setError(null);
    return next;
  }, [body, input.enabled]);

  const consultar = useCallback(async (
    servicos: MolicarProcedenciaServico[],
    automatic = false,
  ) => {
    setConsulting(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke(
      "molicar-procedencia",
      {
        body: { action: "consultar", ...body, servicos, automatic },
      },
    );
    setConsulting(false);
    if (invokeError || data?.error) {
      setError(
        String(
          data?.error ?? invokeError?.message ?? "Falha ao iniciar a consulta.",
        ),
      );
      return false;
    }
    setRows(normalizeMolicarProcedenciaRows(data));
    await reload();
    return true;
  }, [body, reload]);

  useEffect(() => {
    void reload();
  }, [reload]);
  const pending = rows.some((row) =>
    ["pending", "processing", "pendente", "processando"].includes(row.status)
  );
  useEffect(() => {
    if (!pending) return;
    const timer = window.setInterval(() => void reload(), 8_000);
    return () => window.clearInterval(timer);
  }, [pending, reload]);

  return {
    rows,
    loading,
    initialized,
    consulting,
    pending,
    error,
    reload,
    consultar,
    debtTotal: molicarDebtTotal(rows),
  };
}

export type MolicarProcedenciaController = ReturnType<
  typeof useMolicarProcedencia
>;
