import type { GestaoTrocaFotoSlotId } from "./gestao-troca-roteiro.ts";
import {
  GESTAO_TROCA_IA_ACHADO_CONFIANCAS,
  GESTAO_TROCA_IA_ACHADO_SEVERIDADES,
  GESTAO_TROCA_IA_ACHADO_TIPOS,
  GESTAO_TROCA_IA_FOTO_QUALIDADES,
} from "./gestao-troca-ia-foto-schema.ts";

const CHECKLIST: Partial<Record<GestaoTrocaFotoSlotId | string, string[]>> = {
  frente: [
    "Frestas capô/paralama/portas, tonalidade entre painéis, overspray em borrachas/frisos.",
    "Faróis/lanternas (par novo vs amarelado), amassados/riscos visíveis.",
  ],
  traseira: ["Lanternas, para-choque, tampa, frestas e tonalidade."],
  lateral_esq: ["Portas, frisos, reflexo reto por painel, riscos/amassados."],
  lateral_dir: ["Idem lateral oposta."],
  diag_diant_esq: ["Três quartos dianteiro esq.: capô, paralama, porta, farol."],
  diag_diant_dir: ["Três quartos dianteiro dir."],
  diag_tras_esq: ["Três quartos traseiro esq."],
  diag_tras_dir: ["Três quartos traseiro dir."],
  cofre_motor: [
    "Vazamentos, peças visivelmente mais novas (suporte radiador/farol), etiquetas fábrica, selante, limpeza excessiva suspeita.",
  ],
  cofre_longarina_esq: ["Parafusos paralama (tinta quebrada/ferramenta), solda, enrugamento, selante."],
  cofre_longarina_dir: ["Parafusos paralama direito, solda, selante."],
  porta_malas_aberto: ["Assoalho, painel traseiro (solda/enrugamento), umidade/ferrugem."],
  estepe_macaco: ["Estepe, macaco, chave; estado do estepe."],
  pneu_de: ["Marca, DOT se legível, desgaste irregular, sulco por faixa (sem mm)."],
  pneu_dd: ["Marca, DOT, desgaste, sulco aparente."],
  pneu_te: ["Marca, DOT, desgaste, sulco aparente."],
  pneu_td: ["Marca, DOT, desgaste, sulco aparente."],
  painel_ligado: [
    "Odômetro legível → km_painel (inteiro). Luzes de FALHA apenas em luzes_alerta (array).",
    "Não reportar cinto ou freio de estacionamento como falha.",
  ],
  bancos_dianteiros: ["Desgaste couro/tecido, rasgos, manchas."],
  bancos_traseiros: ["Desgaste, manchas, encosto."],
  volante_cambio: ["Desgaste volante, manopla, console."],
  forro_teto: ["Manchas, descolamento, acabamento."],
  manual_manutencao: ["Listar só revisões visíveis com data/km; sem nome/CPF/endereço."],
};

export function buildGestaoTrocaIaFotoPrompt(
  indice: number,
  slot: string,
  slotLabel: string,
): string {
  const checklist = CHECKLIST[slot]?.join(" ") ?? "Descrever o que se vê com objetividade.";
  const painelExtra = slot === "painel_ligado"
    ? '"km_painel": number|null, "luzes_alerta": string[],'
    : "";
  return [
    "Você é perito de avaliação de veículos usados no Brasil.",
    `Foto índice ${indice}, slot informado: ${slot} (${slotLabel}).`,
    `Checklist deste slot: ${checklist}`,
    "Se a imagem não corresponde ao slot, preencha slot_identificado diferente.",
    "Regras: subnotificar; chuva/reflexo/sujeira não são avaria; massa_suspeita nunca confiança alta só pela foto;",
    "foto escura/borrada → qualidade insuficiente, achados=[].",
    `qualidade_imagem: ${GESTAO_TROCA_IA_FOTO_QUALIDADES.join("|")}`,
    `tipo: ${GESTAO_TROCA_IA_ACHADO_TIPOS.join("|")}`,
    `severidade: ${GESTAO_TROCA_IA_ACHADO_SEVERIDADES.join("|")}`,
    `confianca: ${GESTAO_TROCA_IA_ACHADO_CONFIANCAS.join("|")}`,
    "JSON only:",
    `{ "indice": ${indice}, "slot_informado": "${slot}", "slot_identificado": string|null,`,
    `"qualidade_imagem": string, "motivo_qualidade": string, "descricao": string,`,
    painelExtra,
    `"achados": [{ "tipo", "local", "severidade", "confianca", "evidencia" }],`,
    `"nao_da_para_afirmar": string[] }`,
  ].join("\n");
}
