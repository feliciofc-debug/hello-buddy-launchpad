import { useCallback, useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { toast } from "sonner";
import { pollProcedenciaConsulta, useProcedenciaConnection } from "@/components/procedencia/useProcedenciaConnection.ts";
import type { GestaoTrocaRow } from "@/lib/gestao-troca-types.ts";
import {
  buildGestaoTrocaProcedenciaLaudo,
  type GestaoTrocaProcedenciaLaudo,
} from "@/lib/gestao-troca-procedencia-display.ts";
import { GestaoTrocaProcedenciaResumo } from "@/components/gestao/trocas/GestaoTrocaProcedenciaResumo.tsx";

type Props = {
  troca: GestaoTrocaRow;
  busy: boolean;
  laudoLocked: boolean;
  onConsultaCompleta: (consultaId: string) => Promise<void>;
  onConsultaConcluida?: () => void;
};

export function GestaoTrocaProcedenciaCard({
  troca,
  busy,
  laudoLocked,
  onConsultaCompleta,
  onConsultaConcluida,
}: Props) {
  const proc = useProcedenciaConnection();
  const [procedencia, setProcedencia] = useState<GestaoTrocaProcedenciaLaudo | null>(null);
  const [processando, setProcessando] = useState(false);
  const [loading, setLoading] = useState(false);

  const loadConsulta = useCallback(async (consultaId: string) => {
    setLoading(true);
    const { data, error } = await supabase.functions.invoke("veiculo-procedencia", {
      body: { action: "status_consulta", consulta_id: consultaId },
    });
    setLoading(false);
    if (error || !data?.success || !data.consulta) {
      setProcedencia(
        buildGestaoTrocaProcedenciaLaudo({
          consultaId,
          consulta: null,
          ficha: { marca: troca.marca, modelo: troca.modelo },
        }),
      );
      return;
    }
    const c = data.consulta as Record<string, unknown>;
    setProcessando(String(c.status) === "processando");
    setProcedencia(
      buildGestaoTrocaProcedenciaLaudo({
        consultaId,
        consulta: {
          placa: c.placa != null ? String(c.placa) : null,
          status: c.status != null ? String(c.status) : null,
          resumo_json: c.resumo_json,
          erro_tipo: c.erro_tipo != null ? String(c.erro_tipo) : null,
          created_at: c.created_at != null ? String(c.created_at) : null,
          concluida_em: c.concluida_em != null ? String(c.concluida_em) : null,
        },
        ficha: { marca: troca.marca, modelo: troca.modelo },
      }),
    );
  }, [troca.marca, troca.modelo]);

  useEffect(() => {
    if (!troca.procedencia_consulta_id) {
      setProcedencia(null);
      setProcessando(false);
      return;
    }
    void loadConsulta(troca.procedencia_consulta_id);
  }, [troca.procedencia_consulta_id, loadConsulta]);

  const consultar = async () => {
    if (!troca.placa?.trim()) return;
    setProcessando(true);
    const { data, error } = await supabase.functions.invoke("veiculo-procedencia", {
      body: { action: "consultar", placa: troca.placa, confirmado: true },
    });
    if (error || !data?.success) {
      setProcessando(false);
      toast.error(data?.error ?? "Falha na procedência.");
      return;
    }
    const consultaId = String(data.consulta_id ?? "");
    await onConsultaCompleta(consultaId);
    const polled = await pollProcedenciaConsulta(consultaId);
    setProcessando(false);
    if (polled?.status === "concluida") {
      toast.success("Procedência concluída.");
      await loadConsulta(consultaId);
      onConsultaConcluida?.();
    } else if (polled?.status === "erro") {
      await loadConsulta(consultaId);
    }
  };

  return (
    <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
      <h2 className="font-semibold">Procedência</h2>
      {!proc.status?.ativo && (
        <p className="text-xs text-muted-foreground">
          Ative em Configurações → Integrações → Procedência veicular.
        </p>
      )}
      {loading ? (
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Loader2 className="h-4 w-4 animate-spin" /> Carregando consulta…
        </div>
      ) : (
        <GestaoTrocaProcedenciaResumo
          procedencia={troca.procedencia_consulta_id ? procedencia : null}
          processando={processando}
        />
      )}
      <Button
        size="sm"
        variant="outline"
        disabled={busy || laudoLocked || proc.busy || !proc.status?.ativo || !troca.placa?.trim()}
        onClick={() => void consultar()}
      >
        {proc.busy || processando ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Consultando…
          </>
        ) : (
          "Consultar procedência"
        )}
      </Button>
    </section>
  );
}
