import { GESTAO_TROCA_FOTO_ETIQUETAS } from "./gestao-troca-fotos.ts";

export const GESTAO_TROCA_IA_DISCLAIMER_PDF =
  "Pré-análise por IA. Não substitui vistoria. Itens só valem após confirmação do avaliador.";

export type GestaoTrocaLaudoPdfItem = {
  area: string;
  tipo: string;
  descricao: string;
  valor: number | null;
};

export type GestaoTrocaLaudoPdfQualidade = {
  etiqueta: string;
  usada: boolean;
  motivo_skip?: string;
};

export type GestaoTrocaLaudoPdfSection = {
  kmPainel: number | null;
  kmInformado: number | null;
  alertaKm: boolean;
  kmPainelConferido: boolean;
  luzesPainel: boolean | null;
  angulosFaltando: string[];
  qualidadeProblemas: GestaoTrocaLaudoPdfQualidade[];
  resumo: string | null;
  itensConfirmados: GestaoTrocaLaudoPdfItem[];
  modeloIa: string | null;
  analiseConcluidaEm: string | null;
  disclaimer: string;
};

export type GestaoTrocaLaudoPdfFinalizacao = {
  numero: string;
  versao: number;
  finalizadoPor: string;
  finalizadoEm: string;
};

const ANGULOS_PADRAO = GESTAO_TROCA_FOTO_ETIQUETAS.filter(
  (e) => e !== "Documento (CRLV)" && e !== "Outra",
);

type QualidadeInput = {
  etiqueta: string;
  usada: boolean;
  motivo_skip?: string;
};

export function gestaoTrocaAngulosFaltando(input: {
  qualidade_json: QualidadeInput[];
  aviso_carroceria: boolean;
}): string[] {
  const present = new Set(
    input.qualidade_json.filter((q) => q.usada).map((q) => q.etiqueta),
  );
  const missing = ANGULOS_PADRAO.filter((a) => !present.has(a));
  if (input.aviso_carroceria && missing.length === 0) {
    return ["Cobertura externa insuficiente (frente, traseira ou laterais)"];
  }
  return missing;
}

export function gestaoTrocaQualidadeProblemas(
  qualidade: QualidadeInput[],
): GestaoTrocaLaudoPdfQualidade[] {
  return qualidade
    .filter((q) => !q.usada || q.motivo_skip)
    .map((q) => ({
      etiqueta: q.etiqueta,
      usada: q.usada,
      motivo_skip: q.motivo_skip,
    }));
}

export function buildGestaoTrocaLaudoPdfSection(input: {
  analiseStatus: string;
  km_painel_lido: number | null;
  km_ficha: number | null;
  km_informado?: number | null;
  alerta_km: boolean;
  km_painel_conferido: boolean;
  luzes_painel: boolean | null;
  aviso_carroceria: boolean;
  qualidade_json: QualidadeInput[];
  resumo: string | null;
  modelo_ia: string | null;
  concluida_em: string | null;
  itensConfirmados: GestaoTrocaLaudoPdfItem[];
}): GestaoTrocaLaudoPdfSection | null {
  if (input.analiseStatus !== "concluida") return null;
  const kmInformado = input.km_informado ?? input.km_ficha;
  return {
    kmPainel: input.km_painel_lido,
    kmInformado,
    alertaKm: input.alerta_km === true,
    kmPainelConferido: input.km_painel_conferido === true,
    luzesPainel: input.luzes_painel,
    angulosFaltando: gestaoTrocaAngulosFaltando({
      qualidade_json: input.qualidade_json,
      aviso_carroceria: input.aviso_carroceria,
    }),
    qualidadeProblemas: gestaoTrocaQualidadeProblemas(input.qualidade_json),
    resumo: input.resumo,
    itensConfirmados: input.itensConfirmados,
    modeloIa: input.modelo_ia,
    analiseConcluidaEm: input.concluida_em,
    disclaimer: GESTAO_TROCA_IA_DISCLAIMER_PDF,
  };
}
