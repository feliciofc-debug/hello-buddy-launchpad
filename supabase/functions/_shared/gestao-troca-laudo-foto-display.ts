import type { GestaoTrocaIaFotoAnaliseRow } from "./gestao-troca-ia-foto-schema.ts";
import { gestaoTrocaIaDescricaoIcon } from "./gestao-troca-ia-descricao-schema.ts";
import type { GestaoTrocaConsolidacaoLaudo } from "./gestao-troca-ia-por-foto.ts";
import {
  GESTAO_TROCA_INDICIO_COLISAO_DISCLAIMER,
  type GestaoTrocaIndicioColisaoResult,
} from "./gestao-troca-indicio-colisao.ts";
import {
  classificarEspessuraMap,
  GESTAO_TROCA_ESPESSURA_PAINEIS,
  parseGestaoTrocaEspessuraJson,
  type GestaoTrocaEspessuraFaixas,
} from "./gestao-troca-espessura.ts";

export function resumoAreaIcon(cond: string): string {
  if (cond === "sem_apontamento") return "✅";
  if (cond === "leve") return "🟡";
  if (cond === "atencao") return "🟠";
  if (cond === "grave") return "🔴";
  if (cond === "nao_fotografado") return "⚪";
  return "•";
}

export function appendGestaoTrocaResumoAreaPdfLines(
  line: (t: string, bold?: boolean) => void,
  estrutura: { resumo_por_area?: GestaoTrocaConsolidacaoLaudo["resumo_por_area"] } | null,
): void {
  const rows = estrutura?.resumo_por_area ?? [];
  if (!rows.length) return;
  line("Resumo por área (IA)", true);
  for (const r of rows) {
    const fotos = r.fotos.length ? ` (${r.fotos.map((n) => `#${n}`).join(", ")})` : "";
    line(`${resumoAreaIcon(r.condicao)} ${r.area.replace(/_/g, " ")}: ${r.texto}${fotos}`);
  }
}

export function appendGestaoTrocaIndicioColisaoPdfLines(
  line: (t: string, bold?: boolean) => void,
  indicio: GestaoTrocaIndicioColisaoResult | null | undefined,
): void {
  if (!indicio) return;
  line("Indício de colisão (visual)", true);
  line(GESTAO_TROCA_INDICIO_COLISAO_DISCLAIMER);
  for (const [reg, data] of Object.entries(indicio)) {
    if (data.nivel === "nenhum") continue;
    line(`${reg.replace(/_/g, " ")}: ${data.nivel}`);
    for (const ev of data.evidencias.slice(0, 4)) {
      const foto = ev.foto != null ? ` foto #${ev.foto}` : "";
      line(`• ${ev.texto}${foto}`);
    }
  }
}

export function appendGestaoTrocaEspessuraPdfLines(
  line: (t: string, bold?: boolean) => void,
  espessuraRaw: unknown,
  faixas?: GestaoTrocaEspessuraFaixas,
): void {
  const vals = parseGestaoTrocaEspessuraJson(espessuraRaw);
  const cls = classificarEspessuraMap(vals, faixas);
  const any = GESTAO_TROCA_ESPESSURA_PAINEIS.some((p) => cls[p.id] !== "nao_medido");
  if (!any) return;
  line("Espessura de pintura (µm)", true);
  for (const p of GESTAO_TROCA_ESPESSURA_PAINEIS) {
    const v = vals[p.id];
    if (v == null) continue;
    line(`• ${p.label}: ${v} µm (${cls[p.id]})`);
  }
}

export function appendGestaoTrocaFotoAFotoPdfLines(
  line: (t: string, bold?: boolean) => void,
  rows: GestaoTrocaIaFotoAnaliseRow[] | null | undefined,
): void {
  if (!rows?.length) return;
  line("Análise foto a foto (IA)", true);
  for (const r of rows) {
    line(`Foto #${r.indice} · ${String(r.slot_informado).replace(/_/g, " ")}`, true);
    line(r.descricao);
    for (const a of r.achados.slice(0, 6)) {
      const icon = gestaoTrocaIaDescricaoIcon(
        a.severidade === "grave"
          ? "alteracao_grave"
          : a.severidade === "moderada"
          ? "alteracao_moderada"
          : "alteracao_leve",
      );
      line(`${icon} ${a.tipo.replace(/_/g, " ")} (${a.local}): ${a.evidencia}`);
    }
  }
}
