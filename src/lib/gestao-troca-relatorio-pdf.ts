import { jsPDF } from "jspdf";
import type {
  GestaoMolicarSnapshot,
  GestaoTrocaRow,
} from "@/lib/gestao-troca-types.ts";
import { normalizeGestaoTrocaFotos } from "@/lib/gestao-troca-fotos.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import {
  GESTAO_TROCA_CHECKLIST_ITENS,
  normalizeGestaoTrocaChecklist,
} from "@/lib/gestao-troca-checklist.ts";
import type {
  GestaoTrocaLaudoPdfFinalizacao,
  GestaoTrocaLaudoPdfSection,
} from "@/lib/gestao-troca-laudo-pdf-section.ts";
import {
  appendGestaoTrocaLaudoDescricaoPdfLines,
  type GestaoTrocaLaudoDescricaoPdf,
} from "@/lib/gestao-troca-ia-descricao-display.ts";
import {
  appendGestaoTrocaProcedenciaPdfLines,
  type GestaoTrocaProcedenciaLaudo,
} from "@/lib/gestao-troca-procedencia-display.ts";
import {
  appendGestaoTrocaEspessuraPdfLines,
  appendGestaoTrocaFotoAFotoPdfLines,
  appendGestaoTrocaIndicioColisaoPdfLines,
  appendGestaoTrocaResumoAreaPdfLines,
  appendGestaoTrocaResultadoLaudoPdfLines,
} from "@/lib/gestao-troca-laudo-foto-display.ts";
import type { GestaoTrocaIndicioColisaoResult } from "../../supabase/functions/_shared/gestao-troca-indicio-colisao.ts";
import type { GestaoTrocaIaFotoAnaliseRow } from "../../supabase/functions/_shared/gestao-troca-ia-foto-schema.ts";
import type { GestaoTrocaLaudo19Computed } from "@/lib/gestao-troca-laudo-19.ts";
import type { GestaoTrocaEspessuraFaixas } from "@/lib/gestao-troca-espessura.ts";

export type { GestaoTrocaLaudoPdfSection, GestaoTrocaLaudoPdfFinalizacao };

const FOOTER = "Referências: KBB (informada pelo avaliador) e FIPE.";

async function loadImageDataUrl(url: string): Promise<{ dataUrl: string; w: number; h: number } | null> {
  try {
    const res = await fetch(url);
    const blob = await res.blob();
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(String(reader.result));
      reader.onerror = reject;
      reader.readAsDataURL(blob);
    });
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = reject;
      el.src = dataUrl;
    });
    return { dataUrl, w: img.width, h: img.height };
  } catch {
    return null;
  }
}

function formatLaudoDateTime(iso: string | null): string {
  if (!iso) return "—";
  try {
    return new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo" });
  } catch {
    return iso.slice(0, 16).replace("T", " ");
  }
}

export function appendGestaoTrocaLaudoPdfLines(
  line: (t: string, bold?: boolean) => void,
  laudo: GestaoTrocaLaudoPdfSection,
): void {
  line("Pré-análise visual por IA", true);
  line(laudo.disclaimer);
  const kmPainel = laudo.kmPainel != null
    ? `${laudo.kmPainel.toLocaleString("pt-BR")} km`
    : "—";
  const kmInfo = laudo.kmInformado != null
    ? `${laudo.kmInformado.toLocaleString("pt-BR")} km`
    : "—";
  line(`Odômetro painel: ${kmPainel} · Informado na ficha: ${kmInfo}`);
  if (laudo.alertaKm) {
    line(
      laudo.kmPainelConferido
        ? "Alerta: divergência de KM — conferência registrada pelo avaliador."
        : "Alerta: divergência de KM — aguardando conferência do avaliador.",
    );
  }
  if (laudo.luzesPainel === true) {
    line("Luzes de alerta no painel: sim (verificar diagnóstico)");
  } else if (laudo.luzesPainel === false) {
    line("Luzes de alerta no painel: não identificadas");
  } else {
    line("Luzes de alerta no painel: sem foto de painel legível");
  }
  if (laudo.angulosFaltando.length) {
    line(`Ângulos faltando: ${laudo.angulosFaltando.join(" · ")}`);
  } else {
    line("Ângulos: cobertura padrão completa");
  }
  if (laudo.qualidadeProblemas.length === 0) {
    line("Qualidade das fotos: todas usadas na análise.");
  } else {
    line("Qualidade das fotos:", true);
    for (const q of laudo.qualidadeProblemas.slice(0, 8)) {
      const skip = q.motivo_skip ? ` (${q.motivo_skip.replace(/_/g, " ")})` : "";
      line(`• ${q.etiqueta}${skip}`);
    }
  }
  if (laudo.resumo) {
    line(`Resumo IA: ${laudo.resumo}`);
  }
  line("Itens confirmados pelo avaliador:", true);
  if (laudo.itensConfirmados.length === 0) {
    line("Nenhuma avaria relevante identificada.");
  } else {
    for (const item of laudo.itensConfirmados) {
      const loc = `${item.area.replace(/_/g, " ")} · ${item.tipo.replace(/_/g, " ")}`;
      const val = item.valor != null ? formatGestaoMoney(item.valor) : "—";
      line(`• ${loc}: ${item.descricao} (${val})`);
    }
  }
  const modelo = laudo.modeloIa ?? "—";
  line(`Modelo IA: ${modelo} · ${formatLaudoDateTime(laudo.analiseConcluidaEm)}`);
}

export function appendGestaoTrocaMolicarPdfLines(
  line: (t: string, bold?: boolean) => void,
  molicar: GestaoMolicarSnapshot,
): void {
  const value = (n: number | null) => n == null ? "—" : formatGestaoMoney(n);
  line("Referências Molicar", true);
  line(
    `Referência: ${value(molicar.referencia)} · B2C: ${value(molicar.b2c)} · B2B: ${
      value(molicar.b2b)
    }`,
  );
  line(
    `C2C: ${value(molicar.c2c)} · C2B: ${value(molicar.c2b)} · Novo: ${
      value(molicar.novo)
    }`,
  );
  line(
    `Data: ${molicar.dataReferencia ?? "—"} · Atualização: ${
      molicar.atualizadoEm ?? molicar.consultadoEm ?? "—"
    }`,
  );
  line(`Fonte: ${molicar.proveniencia}`);
  if (!molicar.procedencia) {
    line("Procedência: serviço não contratado.");
  } else if (molicar.alertasProcedencia.length) {
    line(`ALERTA DE PROCEDÊNCIA: ${molicar.alertasProcedencia.join(" · ")}`, true);
  } else {
    line("Procedência consultada: nenhum alerta retornado.");
  }
}

export async function downloadGestaoTrocaRelatorioPdf(
  troca: GestaoTrocaRow,
  eventos: { descricao: string; created_at: string }[],
  thumbUrls: string[] = [],
  laudo?: GestaoTrocaLaudoPdfSection | null,
  finalizacao?: GestaoTrocaLaudoPdfFinalizacao | null,
  procedencia?: GestaoTrocaProcedenciaLaudo | null,
  descricao?: GestaoTrocaLaudoDescricaoPdf | null,
  parecer?: Record<string, unknown> | null,
  laudoAnalise?: {
    estrutura_json?: Record<string, unknown> | null;
    fotos_json?: GestaoTrocaIaFotoAnaliseRow[] | null;
  } | null,
  laudo19?: GestaoTrocaLaudo19Computed | null,
  espessuraFaixas?: GestaoTrocaEspessuraFaixas,
  molicar?: GestaoMolicarSnapshot | null,
) {
  const doc = new jsPDF();
  let y = 14;
  const line = (t: string, bold = false) => {
    if (y > 270) {
      doc.addPage();
      y = 14;
    }
    doc.setFont("helvetica", bold ? "bold" : "normal");
    doc.setFontSize(10);
    doc.text(t, 14, y, { maxWidth: 180 });
    y += 6;
  };
  line("Relatório de avaliação — Troca", true);
  if (finalizacao) {
    line(
      `Laudo nº ${finalizacao.numero} · versão ${finalizacao.versao} · finalizado por ${finalizacao.finalizadoPor} em ${formatLaudoDateTime(finalizacao.finalizadoEm)}`,
    );
  }
  line(`${troca.marca} ${troca.modelo} ${troca.ano_modelo ?? ""} · ${troca.placa ?? "—"}`);
  line(`Status: ${troca.status} · Semáforo: ${troca.semaforo ?? "—"}`);
  y += 4;
  line("Preço sugerido", true);
  line(`Faixa verde: ${formatGestaoMoney(troca.faixa_verde_min ?? 0)} – ${formatGestaoMoney(troca.faixa_verde_max ?? 0)}`);
  line(`Sugerido: ${formatGestaoMoney(troca.valor_sugerido ?? 0)} · Teto: ${formatGestaoMoney(troca.teto ?? 0)}`);
  line(`Proposto: ${formatGestaoMoney(troca.valor_proposto ?? 0)} · Fechado: ${formatGestaoMoney(troca.valor_fechado ?? 0)}`);
  line(`Preparação estimada: ${formatGestaoMoney(troca.preparacao_estimada ?? 0)}`);
  if (molicar) {
    y += 4;
    appendGestaoTrocaMolicarPdfLines(line, molicar);
  }
  y += 4;
  appendGestaoTrocaProcedenciaPdfLines(line, procedencia ?? null);

  const estrutura = laudoAnalise?.estrutura_json ?? null;
  y += 4;
  appendGestaoTrocaResultadoLaudoPdfLines(line, laudo19?.resultado ?? null);
  y += 4;
  appendGestaoTrocaResumoAreaPdfLines(
    line,
    laudo19 ? { resumo_por_area: laudo19.resumo_por_area } : estrutura,
  );
  y += 4;
  appendGestaoTrocaIndicioColisaoPdfLines(
    line,
    laudo19?.indicio_colisao ??
      estrutura?.indicio_colisao as GestaoTrocaIndicioColisaoResult | undefined,
  );
  y += 4;
  appendGestaoTrocaEspessuraPdfLines(line, troca.espessura_json, espessuraFaixas);
  y += 4;
  appendGestaoTrocaFotoAFotoPdfLines(
    line,
    Array.isArray(laudoAnalise?.fotos_json) ? laudoAnalise!.fotos_json as GestaoTrocaIaFotoAnaliseRow[] : null,
    normalizeGestaoTrocaFotos(troca.fotos_json),
  );

  if (descricao && (descricao.externo.length || descricao.interno.length)) {
    y += 4;
    appendGestaoTrocaLaudoDescricaoPdfLines(line, descricao);
  }

  y += 4;
  line("Checklist", true);
  const checklist = normalizeGestaoTrocaChecklist(troca.checklist_json);
  for (const { id, label } of GESTAO_TROCA_CHECKLIST_ITENS) {
    const item = checklist[id];
    if (item.condicao === "bom") continue;
    const extra = [
      item.reparo ?? "",
      item.valor_estimado ? formatGestaoMoney(item.valor_estimado) : "",
    ].filter(Boolean).join(" · ");
    line(`• ${label}: ${item.condicao}${extra ? ` (${extra})` : ""}`);
  }

  if (laudo) {
    y += 4;
    appendGestaoTrocaLaudoPdfLines(line, laudo);
  }

  if (parecer && typeof parecer.recomendacao === "object" && parecer.recomendacao) {
    y += 4;
    line("Parecer da avaliação", true);
    const rec = parecer.recomendacao as Record<string, unknown>;
    line(String(rec.rotulo ?? ""));
    const motivos = rec.motivos;
    if (Array.isArray(motivos)) {
      for (const m of motivos) line(`• ${String(m)}`);
    }
    const pendencias = rec.pendencias;
    if (Array.isArray(pendencias) && pendencias.length) {
      line("Pendências antes de aprovar:", true);
      for (const p of pendencias) line(`• ${String(p)}`);
    }
    if (parecer.paragrafo_ia) line(String(parecer.paragrafo_ia));
  }

  y += 4;
  line("Linha do tempo", true);
  for (const e of eventos.slice(0, 12)) {
    line(`${e.created_at.slice(0, 10)} — ${e.descricao}`);
  }

  const thumbs = thumbUrls.slice(0, 6);
  if (thumbs.length) {
    y += 4;
    line("Fotos (amostra)", true);
    let x = 14;
    let rowY = y;
    for (let i = 0; i < thumbs.length; i++) {
      const loaded = await loadImageDataUrl(thumbs[i]);
      if (!loaded) continue;
      const maxW = 28;
      const ratio = loaded.h / loaded.w;
      const w = maxW;
      const h = maxW * ratio;
      if (x + w > 200) {
        x = 14;
        rowY += 32;
      }
      if (rowY > 250) {
        doc.addPage();
        rowY = 20;
        x = 14;
      }
      doc.addImage(loaded.dataUrl, "JPEG", x, rowY, w, Math.min(h, 28));
      x += w + 4;
    }
    y = rowY + 34;
  }

  doc.setFontSize(8);
  doc.text(FOOTER, 14, 285);
  const suffix = troca.laudo_numero ?? troca.placa ?? troca.id.slice(0, 8);
  doc.save(`troca-${suffix}.pdf`);
}
