export type ChecklistCondicao = "bom" | "regular" | "ruim";

export type ChecklistReparoTipo = "funilaria" | "pintura" | "troca" | "reparo";

export type GestaoTrocaChecklistItemState = {
  condicao: ChecklistCondicao;
  reparo?: ChecklistReparoTipo | null;
  valor_estimado?: number | null;
};

export type GestaoTrocaChecklistJson = Record<string, GestaoTrocaChecklistItemState>;

export const GESTAO_TROCA_CHECKLIST_ITENS: { id: string; label: string }[] = [
  { id: "lataria", label: "Lataria" },
  { id: "pintura", label: "Pintura" },
  { id: "para_choques", label: "Para-choques" },
  { id: "farois_lanternas", label: "Faróis / lanternas" },
  { id: "vidros", label: "Vidros" },
  { id: "pneus", label: "Pneus" },
  { id: "rodas", label: "Rodas" },
  { id: "interior", label: "Interior" },
  { id: "bancos", label: "Bancos" },
  { id: "painel_eletronica", label: "Painel / eletrônica" },
  { id: "motor", label: "Motor" },
  { id: "cambio", label: "Câmbio" },
  { id: "suspensao", label: "Suspensão" },
  { id: "freios", label: "Freios" },
  { id: "ar_condicionado", label: "Ar-condicionado" },
  { id: "documentacao", label: "Documentação" },
  { id: "manual_chave_reserva", label: "Manual / chave reserva" },
];

export { GESTAO_TROCA_FOTO_ETIQUETAS as GESTAO_TROCA_FOTO_SUGESTOES } from "./gestao-troca-fotos.ts";

export function somaPreparacaoChecklist(checklist: GestaoTrocaChecklistJson): number {
  let total = 0;
  for (const { id } of GESTAO_TROCA_CHECKLIST_ITENS) {
    const item = checklist[id];
    if (!item) continue;
    if (item.condicao === "bom") continue;
    const v = Number(item.valor_estimado ?? 0);
    if (Number.isFinite(v) && v > 0) total += v;
  }
  return Math.round(total * 100) / 100;
}

export function emptyGestaoTrocaChecklist(): GestaoTrocaChecklistJson {
  const out: GestaoTrocaChecklistJson = {};
  for (const { id } of GESTAO_TROCA_CHECKLIST_ITENS) {
    out[id] = { condicao: "bom", reparo: null, valor_estimado: null };
  }
  return out;
}

export function normalizeGestaoTrocaChecklist(raw: unknown): GestaoTrocaChecklistJson {
  const base = emptyGestaoTrocaChecklist();
  if (!raw || typeof raw !== "object") return base;
  const obj = raw as Record<string, unknown>;
  for (const { id } of GESTAO_TROCA_CHECKLIST_ITENS) {
    const row = obj[id];
    if (!row || typeof row !== "object") continue;
    const r = row as Record<string, unknown>;
    const cond = String(r.condicao ?? "bom") as ChecklistCondicao;
    base[id] = {
      condicao: cond === "regular" || cond === "ruim" ? cond : "bom",
      reparo: r.reparo ? String(r.reparo) as ChecklistReparoTipo : null,
      valor_estimado: r.valor_estimado != null ? Number(r.valor_estimado) : null,
    };
  }
  return base;
}
