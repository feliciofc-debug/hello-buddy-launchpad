import { useCallback, useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";

export type ProcedenciaStatus = {
  ativo: boolean;
  email_masked: string | null;
  api_key_hint: string | null;
  limite_mensal: number;
  consultas_mes: number;
  custo_estimado: number;
};

export function useProcedenciaConnection() {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [status, setStatus] = useState<ProcedenciaStatus | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("veiculo-procedencia", {
      body: { action: "status" },
    });
    if (error) {
      toast.error("Não foi possível carregar procedência veicular.");
      setLoading(false);
      return;
    }
    if (data?.success) {
      setStatus({
        ativo: !!data.ativo,
        email_masked: data.email_masked ?? null,
        api_key_hint: data.api_key_hint ?? null,
        limite_mensal: Number(data.limite_mensal ?? 30),
        consultas_mes: Number(data.consultas_mes ?? 0),
        custo_estimado: Number(data.custo_estimado ?? 38.8),
      });
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const saveCredential = async (input: {
    email: string;
    api_key: string;
    limite_mensal?: number;
  }) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("veiculo-procedencia", {
      body: { action: "salvar_credencial", ...input },
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Falha ao salvar credenciais.");
      return false;
    }
    toast.success(data.message ?? "Credenciais salvas.");
    void refresh();
    return true;
  };

  const testConnection = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("veiculo-procedencia", {
      body: { action: "testar" },
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Falha no teste.");
      return false;
    }
    toast.success(
      data.message ??
        (data.saldo != null ? `Conexão OK. Saldo: R$ ${data.saldo}` : "Conexão OK."),
    );
    void refresh();
    return true;
  };

  const listConsultas = async (competencia?: string) => {
    const { data, error } = await supabase.functions.invoke("veiculo-procedencia", {
      body: { action: "listar_consultas", competencia },
    });
    if (error || !data?.success) return [];
    return (data.lista ?? []) as Record<string, unknown>[];
  };

  const consultarPlaca = async (placa: string, veiculoId?: string | null) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("veiculo-procedencia", {
      body: {
        action: "consultar",
        placa,
        veiculo_id: veiculoId ?? undefined,
        confirmado: true,
      },
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Falha na consulta.");
      return null;
    }
    return data.resumo as Record<string, unknown>;
  };

  return {
    loading,
    busy,
    status,
    refresh,
    saveCredential,
    testConnection,
    listConsultas,
    consultarPlaca,
  };
}
