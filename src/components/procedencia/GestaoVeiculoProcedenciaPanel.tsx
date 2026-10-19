import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { useProcedenciaConnection } from "@/components/procedencia/useProcedenciaConnection";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  userId: string;
  veiculoId: string;
  placa: string | null;
};

export function GestaoVeiculoProcedenciaPanel({ userId, veiculoId, placa }: Props) {
  const proc = useProcedenciaConnection();
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [ultima, setUltima] = useState<Record<string, unknown> | null>(null);

  useEffect(() => {
    if (!userId || !veiculoId) return;
    void supabase.functions.invoke("veiculo-procedencia", {
      body: { action: "ultima_veiculo", veiculo_id: veiculoId },
    }).then(({ data }) => {
      if (data?.success && data.consulta) setUltima(data.consulta as Record<string, unknown>);
    });
  }, [userId, veiculoId]);

  const placaNorm = (placa ?? "").toUpperCase().replace(/[^A-Z0-9]/g, "");
  const canConsult = placaNorm.length >= 7 && proc.status?.ativo;

  return (
    <section className="space-y-2 rounded-lg border p-3">
      <p className="text-sm font-medium">Procedência veicular</p>
      {!proc.status?.ativo && (
        <p className="text-xs text-muted-foreground">
          Ative em Configurações → Integrações → Procedência veicular.
        </p>
      )}
      {ultima?.resumo_json && (
        <pre className="max-h-32 overflow-auto whitespace-pre-wrap rounded bg-muted/50 p-2 text-xs">
          {JSON.stringify(ultima.resumo_json, null, 2)}
        </pre>
      )}
      <Button
        type="button"
        variant="outline"
        size="sm"
        disabled={!canConsult || proc.busy}
        onClick={() => setConfirmOpen(true)}
      >
        {proc.busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Consultar procedência"}
      </Button>
      {!placaNorm && (
        <p className="text-xs text-muted-foreground">Cadastre a placa do veículo para consultar.</p>
      )}
      <AlertDialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar consulta</AlertDialogTitle>
            <AlertDialogDescription>
              Placa {placaNorm} — custo estimado{" "}
              {formatGestaoMoney(proc.status?.custo_estimado ?? 38.8)} dos créditos da loja.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={() =>
                void proc.consultarPlaca(placaNorm, veiculoId).then((resumo) => {
                  if (resumo) setUltima({ resumo_json: resumo, placa: placaNorm });
                  setConfirmOpen(false);
                })
              }
            >
              Consultar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </section>
  );
}
