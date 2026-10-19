import { supabase } from "@/integrations/supabase/client";
import {
  buildGestaoTrocaProcedenciaLaudo,
  type GestaoTrocaProcedenciaLaudo,
} from "@/lib/gestao-troca-procedencia-display.ts";

export async function fetchGestaoTrocaProcedenciaLaudo(
  consultaId: string | null | undefined,
  ficha: { marca: string; modelo: string },
): Promise<GestaoTrocaProcedenciaLaudo | null> {
  if (!consultaId) return null;
  const { data, error } = await supabase.functions.invoke("veiculo-procedencia", {
    body: { action: "status_consulta", consulta_id: consultaId },
  });
  if (error || !data?.success || !data.consulta) {
    return buildGestaoTrocaProcedenciaLaudo({
      consultaId,
      consulta: null,
      ficha,
    });
  }
  const c = data.consulta as Record<string, unknown>;
  return buildGestaoTrocaProcedenciaLaudo({
    consultaId,
    consulta: {
      placa: c.placa != null ? String(c.placa) : null,
      status: c.status != null ? String(c.status) : null,
      resumo_json: c.resumo_json,
      erro_tipo: c.erro_tipo != null ? String(c.erro_tipo) : null,
      created_at: c.created_at != null ? String(c.created_at) : null,
      concluida_em: c.concluida_em != null ? String(c.concluida_em) : null,
    },
    ficha,
  });
}
