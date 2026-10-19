import type { GestaoTrocaIaAchadoTipo } from "./gestao-troca-ia-foto-schema.ts";
import type { GestaoTrocaIaTipo } from "./gestao-troca-ia-schema.ts";

export const GESTAO_TROCA_SERVICOS = [
  "nenhum",
  "funilaria",
  "pintura",
  "substituicao",
  "martelinho",
  "higienizacao",
  "mecanica",
] as const;

export type GestaoTrocaServicoSugerido = typeof GESTAO_TROCA_SERVICOS[number];

export function servicoSugeridoFromAchadoTipo(tipo: GestaoTrocaIaAchadoTipo): GestaoTrocaServicoSugerido {
  switch (tipo) {
    case "risco":
    case "amassado":
    case "fresta_desalinhada":
      return "funilaria";
    case "diferenca_tonalidade":
    case "sinal_repintura":
      return "pintura";
    case "farol_lanterna_divergente":
    case "vidro_trincado":
    case "vidro_gravacao_divergente":
      return "substituicao";
    case "desgaste_interno":
    case "mancha_interna":
      return "higienizacao";
    case "vazamento_fluido":
    case "luz_alerta":
      return "mecanica";
    case "pneu_desgaste_irregular":
    case "pneu_sulco_baixo":
    case "pneus_marcas_diferentes":
      return "substituicao";
    default:
      return "nenhum";
  }
}

export function servicoSugeridoFromIaTipo(tipo: GestaoTrocaIaTipo): GestaoTrocaServicoSugerido {
  if (tipo === "risco" || tipo === "amassado" || tipo === "desalinhamento") return "funilaria";
  if (tipo === "pintura_divergente" || tipo === "ferrugem") return "pintura";
  if (tipo === "trinca" || tipo === "quebra" || tipo === "peca_faltando") return "substituicao";
  if (tipo === "mancha" || tipo === "desgaste") return "higienizacao";
  if (tipo === "luz_alerta") return "mecanica";
  return "nenhum";
}
