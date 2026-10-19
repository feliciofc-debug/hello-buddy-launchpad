/** Tipos do laudo foto a foto — sem dependência de Deno (safe para tsc app). */

export type GestaoTrocaResumoAreaCondicao =
  | "sem_apontamento"
  | "leve"
  | "atencao"
  | "grave"
  | "nao_fotografado";

export type GestaoTrocaResumoAreaRow = {
  area: "externo" | "estrutura_cofre" | "pneus" | "interno";
  condicao: GestaoTrocaResumoAreaCondicao;
  texto: string;
  fotos: number[];
};

export type GestaoTrocaConsolidacaoLaudo = {
  resumo_por_area: GestaoTrocaResumoAreaRow[];
  conclusao_visual: string;
  km_painel: number | null;
  luzes_painel: boolean | null;
  mensagem_parcial: string | null;
};
