import type { GestaoTrocaFotoEntry } from "./gestao-troca-fotos.ts";
import { gestaoTrocaFotosListaParaIa } from "./gestao-troca-foto-slot.ts";

export type GestaoTrocaFotoSlotId =
  | "frente"
  | "traseira"
  | "lateral_esq"
  | "lateral_dir"
  | "diag_diant_esq"
  | "diag_diant_dir"
  | "diag_tras_esq"
  | "diag_tras_dir"
  | "teto"
  | "cofre_motor"
  | "cofre_longarina_esq"
  | "cofre_longarina_dir"
  | "porta_malas_aberto"
  | "estepe_macaco"
  | "vao_porta"
  | "pneu_de"
  | "pneu_dd"
  | "pneu_te"
  | "pneu_td"
  | "painel_ligado"
  | "bancos_dianteiros"
  | "bancos_traseiros"
  | "volante_cambio"
  | "forro_teto"
  | "manual_manutencao"
  | "opcionais_destaque";

export type GestaoTrocaRoteiroGrupo = "externo" | "estrutura" | "pneus" | "interno";

export type GestaoTrocaRoteiroSlotDef = {
  id: GestaoTrocaFotoSlotId;
  label: string;
  grupo: GestaoTrocaRoteiroGrupo;
  obrigatorio: boolean;
  dica: string;
  /** Etiqueta legada exibida na galeria / qualidade_json */
  etiquetaLegado: string;
};

export const GESTAO_TROCA_ROTEIRO_SLOTS: GestaoTrocaRoteiroSlotDef[] = [
  { id: "frente", label: "Frente", grupo: "externo", obrigatorio: true, dica: "Frente do veículo, luz natural, placa visível.", etiquetaLegado: "Frente" },
  { id: "traseira", label: "Traseira", grupo: "externo", obrigatorio: true, dica: "Traseira centralizada, lanternas visíveis.", etiquetaLegado: "Traseira" },
  { id: "lateral_esq", label: "Lateral esquerda", grupo: "externo", obrigatorio: true, dica: "Lateral esquerda completa, portas fechadas.", etiquetaLegado: "Lateral esquerda" },
  { id: "lateral_dir", label: "Lateral direita", grupo: "externo", obrigatorio: true, dica: "Lateral direita completa.", etiquetaLegado: "Lateral direita" },
  { id: "diag_diant_esq", label: "Diagonal dianteira esq.", grupo: "externo", obrigatorio: true, dica: "Três quartos dianteiro esquerdo.", etiquetaLegado: "Outra" },
  { id: "diag_diant_dir", label: "Diagonal dianteira dir.", grupo: "externo", obrigatorio: true, dica: "Três quartos dianteiro direito.", etiquetaLegado: "Outra" },
  { id: "diag_tras_esq", label: "Diagonal traseira esq.", grupo: "externo", obrigatorio: true, dica: "Três quartos traseiro esquerdo.", etiquetaLegado: "Outra" },
  { id: "diag_tras_dir", label: "Diagonal traseira dir.", grupo: "externo", obrigatorio: true, dica: "Três quartos traseiro direito.", etiquetaLegado: "Outra" },
  { id: "teto", label: "Teto", grupo: "externo", obrigatorio: false, dica: "Teto visto de lado ou degrau, sem reflexo forte.", etiquetaLegado: "Outra" },
  { id: "cofre_motor", label: "Cofre do motor", grupo: "estrutura", obrigatorio: true, dica: "Capô aberto, visão geral do cofre, luz adequada.", etiquetaLegado: "Motor" },
  { id: "cofre_longarina_esq", label: "Longarina esq. (cofre)", grupo: "estrutura", obrigatorio: true, dica: "Close parafusos/dobradiça paralama esquerdo no cofre.", etiquetaLegado: "Outra" },
  { id: "cofre_longarina_dir", label: "Longarina dir. (cofre)", grupo: "estrutura", obrigatorio: true, dica: "Close parafusos paralama direito no cofre.", etiquetaLegado: "Outra" },
  { id: "porta_malas_aberto", label: "Porta-malas aberto", grupo: "estrutura", obrigatorio: true, dica: "Porta-malas aberto, assoalho e painel traseiro visíveis.", etiquetaLegado: "Porta-malas" },
  { id: "estepe_macaco", label: "Estepe / macaco", grupo: "estrutura", obrigatorio: true, dica: "Estepe, macaco e chave de roda se existirem.", etiquetaLegado: "Estepe" },
  { id: "vao_porta", label: "Vão de porta", grupo: "estrutura", obrigatorio: false, dica: "Batente/porta aberta mostrando folga e borracha.", etiquetaLegado: "Outra" },
  { id: "pneu_de", label: "Pneu DE", grupo: "pneus", obrigatorio: true, dica: "Banda e lateral, DOT legível se possível.", etiquetaLegado: "Pneus / rodas" },
  { id: "pneu_dd", label: "Pneu DD", grupo: "pneus", obrigatorio: true, dica: "Banda e lateral dianteira direita.", etiquetaLegado: "Pneus / rodas" },
  { id: "pneu_te", label: "Pneu TE", grupo: "pneus", obrigatorio: true, dica: "Banda traseira esquerda.", etiquetaLegado: "Pneus / rodas" },
  { id: "pneu_td", label: "Pneu TD", grupo: "pneus", obrigatorio: true, dica: "Banda traseira direita.", etiquetaLegado: "Pneus / rodas" },
  { id: "painel_ligado", label: "Painel ligado", grupo: "interno", obrigatorio: true, dica: "Painel com motor ligado: km e luzes visíveis.", etiquetaLegado: "Painel ligado (km)" },
  { id: "bancos_dianteiros", label: "Bancos dianteiros", grupo: "interno", obrigatorio: true, dica: "Bancos dianteiros e cintos.", etiquetaLegado: "Interior dianteiro" },
  { id: "bancos_traseiros", label: "Bancos traseiros", grupo: "interno", obrigatorio: true, dica: "Bancos traseiros e acabamento.", etiquetaLegado: "Interior traseiro" },
  { id: "volante_cambio", label: "Volante / câmbio", grupo: "interno", obrigatorio: true, dica: "Volante, console central e alavanca.", etiquetaLegado: "Outra" },
  { id: "forro_teto", label: "Forro de teto", grupo: "interno", obrigatorio: false, dica: "Forro interno do teto.", etiquetaLegado: "Outra" },
  { id: "manual_manutencao", label: "Manual / revisões", grupo: "interno", obrigatorio: false, dica: "Páginas de revisão visíveis, sem dados pessoais.", etiquetaLegado: "Outra" },
  { id: "opcionais_destaque", label: "Opcionais destaque", grupo: "interno", obrigatorio: false, dica: "Teto solar, multimídia, etc.", etiquetaLegado: "Outra" },
];

export const GESTAO_TROCA_ROTEIRO_OBRIGATORIOS_TOTAL = GESTAO_TROCA_ROTEIRO_SLOTS.filter((s) =>
  s.obrigatorio
).length;

const SLOT_SET = new Set<string>(GESTAO_TROCA_ROTEIRO_SLOTS.map((s) => s.id));

export function isGestaoTrocaFotoSlotId(v: string): v is GestaoTrocaFotoSlotId {
  return SLOT_SET.has(v);
}

export function gestaoTrocaSlotDef(id: GestaoTrocaFotoSlotId): GestaoTrocaRoteiroSlotDef {
  return GESTAO_TROCA_ROTEIRO_SLOTS.find((s) => s.id === id)!;
}

/** Slot atribuído no registro (usuário ou IA). Não infere por etiqueta. */
export function gestaoTrocaResolveFotoSlot(entry: GestaoTrocaFotoEntry & { slot?: string }): GestaoTrocaFotoSlotId | null {
  const rawSlot = String(entry.slot ?? "").trim();
  if (rawSlot && isGestaoTrocaFotoSlotId(rawSlot)) return rawSlot;
  return null;
}

export function gestaoTrocaRoteiroProgress(fotos: GestaoTrocaFotoEntry[]): {
  preenchidos: number;
  obrigatorios: number;
  faltando: GestaoTrocaFotoSlotId[];
} {
  const bySlot = new Map<GestaoTrocaFotoSlotId, GestaoTrocaFotoEntry>();
  for (const f of fotos) {
    const slot = gestaoTrocaResolveFotoSlot(f);
    if (slot && !bySlot.has(slot)) bySlot.set(slot, f);
  }
  const obrig = GESTAO_TROCA_ROTEIRO_SLOTS.filter((s) => s.obrigatorio);
  const faltando = obrig.filter((s) => !bySlot.has(s.id)).map((s) => s.id);
  return {
    preenchidos: obrig.length - faltando.length,
    obrigatorios: obrig.length,
    faltando,
  };
}

/** @deprecated Use gestaoTrocaFotosListaParaIa em gestao-troca-foto-slot.ts */
export function gestaoTrocaFotosOrdenadasParaIa(
  fotos: GestaoTrocaFotoEntry[],
  max = 32,
): (GestaoTrocaFotoEntry & { slot?: GestaoTrocaFotoSlotId | string })[] {
  return gestaoTrocaFotosListaParaIa(fotos, max);
}
