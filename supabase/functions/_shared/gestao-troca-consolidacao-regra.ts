import type { GestaoTrocaFotoSlotId } from "./gestao-troca-roteiro.ts";
import { GESTAO_TROCA_ROTEIRO_SLOTS, gestaoTrocaRoteiroProgress } from "./gestao-troca-roteiro.ts";
import type { GestaoTrocaFotoEntry } from "./gestao-troca-fotos.ts";
import type { GestaoTrocaIaFotoAnaliseRow } from "./gestao-troca-ia-foto-schema.ts";
import type {
  GestaoTrocaResumoAreaCondicao,
  GestaoTrocaResumoAreaRow,
} from "./gestao-troca-ia-por-foto.ts";

const AREA_SLOTS: Record<GestaoTrocaResumoAreaRow["area"], GestaoTrocaFotoSlotId[]> = {
  externo: GESTAO_TROCA_ROTEIRO_SLOTS.filter((s) => s.grupo === "externo").map((s) => s.id),
  estrutura_cofre: GESTAO_TROCA_ROTEIRO_SLOTS.filter((s) => s.grupo === "estrutura").map((s) => s.id),
  pneus: GESTAO_TROCA_ROTEIRO_SLOTS.filter((s) => s.grupo === "pneus").map((s) => s.id),
  interno: GESTAO_TROCA_ROTEIRO_SLOTS.filter((s) => s.grupo === "interno").map((s) => s.id),
};

function severidadeToCondicao(
  sev: "leve" | "moderada" | "grave" | null,
): GestaoTrocaResumoAreaCondicao {
  if (!sev) return "sem_apontamento";
  if (sev === "grave") return "grave";
  if (sev === "moderada") return "atencao";
  return "leve";
}

function maxCondicao(
  a: GestaoTrocaResumoAreaCondicao,
  b: GestaoTrocaResumoAreaCondicao,
): GestaoTrocaResumoAreaCondicao {
  const order: GestaoTrocaResumoAreaCondicao[] = [
    "nao_fotografado",
    "sem_apontamento",
    "leve",
    "atencao",
    "grave",
  ];
  return order.indexOf(a) >= order.indexOf(b) ? a : b;
}

export function calcResumoPorAreaRegra(input: {
  fotoRows: GestaoTrocaIaFotoAnaliseRow[];
  fotosNorm: GestaoTrocaFotoEntry[];
}): GestaoTrocaResumoAreaRow[] {
  const prog = gestaoTrocaRoteiroProgress(input.fotosNorm);
  const areas: GestaoTrocaResumoAreaRow["area"][] = [
    "externo",
    "estrutura_cofre",
    "pneus",
    "interno",
  ];

  return areas.map((area) => {
    const slots = AREA_SLOTS[area];
    const obrig = slots.filter((id) =>
      GESTAO_TROCA_ROTEIRO_SLOTS.find((s) => s.id === id)?.obrigatorio
    );
    const faltandoObrig = obrig.filter((id) => prog.faltando.includes(id));
    if (faltandoObrig.length === obrig.length && obrig.length > 0) {
      return {
        area,
        condicao: "nao_fotografado",
        texto: "⚪ não fotografado — não avaliado",
        fotos: [],
      };
    }

    const rowsArea = input.fotoRows.filter((r) =>
      slots.includes(String(r.slot_informado) as GestaoTrocaFotoSlotId)
    );
    const fotos = rowsArea.map((r) => r.indice);
    let cond: GestaoTrocaResumoAreaCondicao = "sem_apontamento";
    for (const row of rowsArea) {
      for (const ach of row.achados) {
        cond = maxCondicao(cond, severidadeToCondicao(ach.severidade));
      }
    }
    return {
      area,
      condicao: cond,
      texto: "",
      fotos,
    };
  });
}

export function mergeResumoTextoIa(
  regra: GestaoTrocaResumoAreaRow[],
  textos: Partial<Record<GestaoTrocaResumoAreaRow["area"], string>>,
): GestaoTrocaResumoAreaRow[] {
  return regra.map((r) => ({
    ...r,
    texto: String(textos[r.area] ?? "").slice(0, 600) || r.texto,
  }));
}
