import type { GestaoTrocaIaArea, GestaoTrocaIaTipo, GestaoTrocaIaVisionItem } from "./gestao-troca-ia-schema.ts";
import type { GestaoTrocaIaAchadoTipo, GestaoTrocaIaFotoAchado } from "./gestao-troca-ia-foto-schema.ts";
import { GESTAO_TROCA_IA_ACHADOS_SEM_CUSTO } from "./gestao-troca-ia-foto-schema.ts";

const TIPO_TO_IA: Record<GestaoTrocaIaAchadoTipo, GestaoTrocaIaTipo> = {
  risco: "risco",
  amassado: "amassado",
  diferenca_tonalidade: "pintura_divergente",
  sinal_repintura: "pintura_divergente",
  fresta_desalinhada: "desalinhamento",
  solda_aparente: "outro",
  massa_suspeita: "pintura_divergente",
  parafuso_mexido: "desalinhamento",
  selante_fora_padrao: "outro",
  corrosao: "ferrugem",
  vazamento_fluido: "outro",
  farol_lanterna_divergente: "outro",
  vidro_trincado: "trinca",
  vidro_gravacao_divergente: "outro",
  pneu_desgaste_irregular: "desgaste",
  pneu_sulco_baixo: "desgaste",
  pneus_marcas_diferentes: "outro",
  desgaste_interno: "desgaste",
  mancha_interna: "mancha",
  luz_alerta: "luz_alerta",
  outro: "outro",
};

function areaFromLocal(local: string, slot: string): GestaoTrocaIaArea {
  const t = `${local} ${slot}`.toLowerCase();
  if (/painel|odometro|odômetro|km/.test(t)) return "painel";
  if (/pneu|roda|banda|dot/.test(t)) return "pneu";
  if (/cap[oô]|cofre|motor|radiador/.test(t)) return "motor";
  if (/porta.malas|assoalho/.test(t)) return "tampa_porta_malas";
  if (/banco|interior/.test(t)) return "banco";
  if (/volante|cambio|câmbio|console/.test(t)) return "volante";
  if (/farol/.test(t) && /esq|esquerdo|de\b/.test(t)) return "farol_esq";
  if (/farol/.test(t)) return "farol_dir";
  if (/lanterna/.test(t) && /esq/.test(t)) return "lanterna_esq";
  if (/lanterna/.test(t)) return "lanterna_dir";
  if (/para.choque/.test(t) && /traseir/.test(t)) return "para_choque_traseiro";
  if (/para.choque/.test(t)) return "para_choque_dianteiro";
  if (/porta/.test(t) && /traseir/.test(t) && /esq/.test(t)) return "porta_traseira_esq";
  if (/porta/.test(t) && /traseir/.test(t)) return "porta_traseira_dir";
  if (/porta/.test(t) && /esq/.test(t)) return "porta_dianteira_esq";
  if (/porta/.test(t)) return "porta_dianteira_dir";
  if (/teto/.test(t)) return "teto";
  if (/vidro/.test(t)) return "vidro_lateral";
  return "outro";
}

export function gestaoTrocaIaAchadoToVisionItem(input: {
  achado: GestaoTrocaIaFotoAchado;
  fotoIndice: number;
  slot: string;
}): GestaoTrocaIaVisionItem {
  const tipo = TIPO_TO_IA[input.achado.tipo] ?? "outro";
  const gravidade = input.achado.severidade;
  const confianca = input.achado.confianca === "media" ? "media" : input.achado.confianca;
  const descricao = [
    input.achado.evidencia,
    input.achado.local ? `Local: ${input.achado.local}.` : "",
    GESTAO_TROCA_IA_ACHADOS_SEM_CUSTO.has(input.achado.tipo) ? "(Indício visual.)" : "",
  ].filter(Boolean).join(" ").slice(0, 400);
  return {
    area: areaFromLocal(input.achado.local, input.slot),
    tipo,
    gravidade,
    confianca: confianca as GestaoTrocaIaVisionItem["confianca"],
    descricao,
    foto_indice: input.fotoIndice,
  };
}

export function gestaoTrocaIaAchadoSemCustoAutomatico(tipo: GestaoTrocaIaAchadoTipo): boolean {
  return GESTAO_TROCA_IA_ACHADOS_SEM_CUSTO.has(tipo);
}
