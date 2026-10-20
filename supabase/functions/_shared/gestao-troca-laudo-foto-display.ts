import { gestaoTrocaIaFotoAnaliseRowsParaPdf } from "./gestao-troca-foto-slot.ts";
import type { GestaoTrocaIaFotoAnaliseRow } from "./gestao-troca-ia-foto-schema.ts";
import type { GestaoTrocaFotoEntry } from "./gestao-troca-fotos.ts";
import { gestaoTrocaIaDescricaoIcon } from "./gestao-troca-ia-descricao-schema.ts";
import type { GestaoTrocaConsolidacaoLaudo } from "./gestao-troca-ia-por-foto-types.ts";
import {
  GESTAO_TROCA_INDICIO_COLISAO_DISCLAIMER,
  type GestaoTrocaIndicioColisaoResult,
} from "./gestao-troca-indicio-colisao.ts";
import {
  classificarEspessuraMap,
  DEFAULT_GESTAO_TROCA_ESPESSURA_FAIXAS,
  gestaoTrocaEspessuraClassificacaoLabel,
  GESTAO_TROCA_ESPESSURA_PAINEIS,
  parseGestaoTrocaEspessuraJson,
  type GestaoTrocaEspessuraFaixas,
} from "./gestao-troca-espessura.ts";
import type { GestaoTrocaResultadoLaudoView } from "./gestao-troca-resultado-laudo.ts";

export function resumoAreaIcon(cond: string): string {
  if (cond === "sem_apontamento") return "✅";
  if (cond === "leve") return "🟡";
  if (cond === "atencao") return "🟠";
  if (cond === "grave") return "🔴";
  if (cond === "nao_fotografado") return "⚪";
  return "•";
}

function stripResumoAreaTextoEmoji(texto: string): string {
  return texto.replace(/^[\s✅🟡🟠🔴⚪]+/u, "").trim();
}

/** Uma linha de resumo por área; nao_fotografado exibe só ⚪ (sem ✅ duplicado no texto). */
export function formatGestaoTrocaResumoAreaLinha(r: {
  area: string;
  condicao: string;
  texto: string;
  fotos: number[];
}): string {
  const label = r.area.replace(/_/g, " ");
  if (r.condicao === "nao_fotografado") {
    const t = stripResumoAreaTextoEmoji(r.texto || "não fotografado — não avaliado");
    return `${resumoAreaIcon(r.condicao)} ${label}: ${t}`;
  }
  const fotos = r.fotos.length ? ` (${r.fotos.map((n) => `#${n}`).join(", ")})` : "";
  const t = r.texto || r.condicao.replace(/_/g, " ");
  return `${resumoAreaIcon(r.condicao)} ${label}: ${t}${fotos}`;
}

export function appendGestaoTrocaResultadoLaudoPdfLines(
  line: (t: string, bold?: boolean) => void,
  resultado: GestaoTrocaResultadoLaudoView | null | undefined,
): void {
  if (!resultado) return;
  line("Resultado do laudo (cautelar)", true);
  line(resultado.rotulo, true);
  for (const m of resultado.motivos) line(`• ${m}`);
}

export function appendGestaoTrocaResumoAreaPdfLines(
  line: (t: string, bold?: boolean) => void,
  estrutura: { resumo_por_area?: GestaoTrocaConsolidacaoLaudo["resumo_por_area"] } | null,
): void {
  const rows = estrutura?.resumo_por_area ?? [];
  if (!rows.length) return;
  line("Resumo por área (IA)", true);
  for (const r of rows) {
    line(formatGestaoTrocaResumoAreaLinha(r));
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
  const fx = faixas ?? DEFAULT_GESTAO_TROCA_ESPESSURA_FAIXAS;
  const cls = classificarEspessuraMap(vals, fx);
  const any = GESTAO_TROCA_ESPESSURA_PAINEIS.some((p) => cls[p.id] !== "nao_medido");
  if (!any) return;
  line("Espessura de pintura (µm)", true);
  line(
    `Faixas: Original ≤${fx.original_max} · Repintura provável ≤${fx.repintura_max} · Massa provável >${fx.repintura_max}`,
  );
  for (const p of GESTAO_TROCA_ESPESSURA_PAINEIS) {
    const v = vals[p.id];
    if (v == null) continue;
    const { rotulo } = gestaoTrocaEspessuraClassificacaoLabel(cls[p.id]);
    line(`• ${p.label}: ${v} µm — ${rotulo}`);
  }
}

export function appendGestaoTrocaFotoAFotoPdfLines(
  line: (t: string, bold?: boolean) => void,
  rows: GestaoTrocaIaFotoAnaliseRow[] | null | undefined,
  fotosNorm: GestaoTrocaFotoEntry[] = [],
): void {
  const safe = gestaoTrocaIaFotoAnaliseRowsParaPdf(rows, fotosNorm);
  if (!safe.length) return;
  line("Análise foto a foto (IA)", true);
  for (const r of safe) {
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
