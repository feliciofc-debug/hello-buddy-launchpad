export type GestaoTrocaIaAnaliseStatus = "processando" | "concluida" | "erro";

export type GestaoTrocaIaItemDecisao = "pendente" | "confirmado" | "descartado";

export type GestaoTrocaIaQualidadeFoto = {
  path: string;
  etiqueta: string;
  bytes: number;
  usada: boolean;
  motivo_skip?: string;
};

export type GestaoTrocaIaAnalise = {
  id: string;
  troca_id: string;
  status: GestaoTrocaIaAnaliseStatus;
  km_painel_lido: number | null;
  km_ficha: number | null;
  alerta_km: boolean;
  aviso_carroceria: boolean;
  luzes_painel: boolean | null;
  resumo: string | null;
  qualidade_json: GestaoTrocaIaQualidadeFoto[];
  erro: string | null;
  total_preparacao: number | null;
  modelo_ia?: string | null;
  created_at: string;
  concluida_em: string | null;
};

export type GestaoTrocaIaItem = {
  id: string;
  analise_id: string;
  area: string;
  tipo: string;
  gravidade: string;
  confianca: string;
  descricao: string;
  valor_estimado: number | null;
  decisao: GestaoTrocaIaItemDecisao;
  foto_path?: string | null;
};

export type GestaoTrocaIaCustoRow = {
  categoria: string;
  gravidade: string;
  valor: number;
};

export const GESTAO_TROCA_IA_DISCLAIMER =
  "Pré-análise por IA. Não substitui vistoria. Itens só valem após confirmação do avaliador.";

export const GESTAO_TROCA_IA_CUSTO_CATEGORIAS: { id: string; label: string }[] = [
  { id: "funilaria_pintura", label: "Funilaria / pintura" },
  { id: "mecanica", label: "Mecânica" },
  { id: "pneus", label: "Pneus / rodas" },
  { id: "estetica", label: "Estética / interior" },
  { id: "outros", label: "Outros" },
];

export const GESTAO_TROCA_IA_GRAVIDADES = [
  { id: "leve", label: "Leve" },
  { id: "moderada", label: "Moderada" },
  { id: "grave", label: "Grave" },
] as const;

export function normalizeGestaoTrocaIaQualidade(raw: unknown): GestaoTrocaIaQualidadeFoto[] {
  if (!Array.isArray(raw)) return [];
  return raw
    .filter((r) => r && typeof r === "object")
    .map((r) => {
      const o = r as Record<string, unknown>;
      return {
        path: String(o.path ?? ""),
        etiqueta: String(o.etiqueta ?? ""),
        bytes: Number(o.bytes ?? 0),
        usada: o.usada === true,
        motivo_skip: o.motivo_skip ? String(o.motivo_skip) : undefined,
      };
    })
    .filter((q) => q.path);
}

export function parseGestaoTrocaIaAnaliseRow(raw: Record<string, unknown>): GestaoTrocaIaAnalise {
  return {
    id: String(raw.id),
    troca_id: String(raw.troca_id),
    status: String(raw.status) as GestaoTrocaIaAnaliseStatus,
    km_painel_lido: raw.km_painel_lido != null ? Number(raw.km_painel_lido) : null,
    km_ficha: raw.km_ficha != null ? Number(raw.km_ficha) : null,
    alerta_km: raw.alerta_km === true,
    aviso_carroceria: raw.aviso_carroceria === true,
    luzes_painel: typeof raw.luzes_painel === "boolean" ? raw.luzes_painel : null,
    resumo: raw.resumo != null ? String(raw.resumo) : null,
    qualidade_json: normalizeGestaoTrocaIaQualidade(raw.qualidade_json),
    erro: raw.erro != null ? String(raw.erro) : null,
    total_preparacao: raw.total_preparacao != null ? Number(raw.total_preparacao) : null,
    modelo_ia: raw.modelo_ia != null ? String(raw.modelo_ia) : null,
    created_at: String(raw.created_at ?? ""),
    concluida_em: raw.concluida_em != null ? String(raw.concluida_em) : null,
  };
}

export function parseGestaoTrocaIaItemRow(raw: Record<string, unknown>): GestaoTrocaIaItem {
  return {
    id: String(raw.id),
    analise_id: String(raw.analise_id),
    area: String(raw.area ?? ""),
    tipo: String(raw.tipo ?? ""),
    gravidade: String(raw.gravidade ?? ""),
    confianca: String(raw.confianca ?? ""),
    descricao: String(raw.descricao ?? ""),
    valor_estimado: raw.valor_estimado != null ? Number(raw.valor_estimado) : null,
    decisao: String(raw.decisao ?? "pendente") as GestaoTrocaIaItemDecisao,
    foto_path: raw.foto_path != null ? String(raw.foto_path) : null,
  };
}
