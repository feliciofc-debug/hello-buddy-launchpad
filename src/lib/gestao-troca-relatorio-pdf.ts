import { jsPDF } from "jspdf";
import type { GestaoTrocaRow } from "@/lib/gestao-troca-types.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";

const FOOTER = "Referências: KBB (informada pelo avaliador) e FIPE.";

export function downloadGestaoTrocaRelatorioPdf(troca: GestaoTrocaRow, eventos: { descricao: string; created_at: string }[]) {
  const doc = new jsPDF();
  let y = 14;
  const line = (t: string, bold = false) => {
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.text(t, 14, y, { maxWidth: 180 });
    y += 6;
  };
  line("Relatório de avaliação — Troca", true);
  line(`${troca.marca} ${troca.modelo} ${troca.ano_modelo ?? ""} · ${troca.placa ?? "—"}`);
  line(`Status: ${troca.status} · Semáforo: ${troca.semaforo ?? "—"}`);
  y += 4;
  line("Preço sugerido", true);
  line(`Faixa verde: ${formatGestaoMoney(troca.faixa_verde_min ?? 0)} – ${formatGestaoMoney(troca.faixa_verde_max ?? 0)}`);
  line(`Sugerido: ${formatGestaoMoney(troca.valor_sugerido ?? 0)} · Teto: ${formatGestaoMoney(troca.teto ?? 0)}`);
  line(`Proposto: ${formatGestaoMoney(troca.valor_proposto ?? 0)} · Fechado: ${formatGestaoMoney(troca.valor_fechado ?? 0)}`);
  y += 4;
  line("Justificativas", true);
  for (const j of troca.justificativas_json ?? []) line(`• ${j}`);
  y += 4;
  line("Linha do tempo", true);
  for (const e of eventos.slice(0, 15)) {
    line(`${e.created_at.slice(0, 10)} — ${e.descricao}`);
  }
  doc.setFontSize(8);
  doc.text(FOOTER, 14, 285);
  doc.save(`troca-${troca.placa ?? troca.id.slice(0, 8)}.pdf`);
}
