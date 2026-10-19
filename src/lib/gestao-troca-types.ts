export type GestaoTrocaStatus =
  | "em_avaliacao"
  | "aguardando_aprovacao"
  | "aprovada"
  | "fechada"
  | "recusada_cliente"
  | "perdida"
  | "cancelada";

export type GestaoTrocaRow = {
  id: string;
  user_id: string;
  placa: string | null;
  marca: string;
  modelo: string;
  categoria: string | null;
  versao: string | null;
  ano_fabricacao: number | null;
  ano_modelo: number | null;
  km: number | null;
  km_painel_conferido?: boolean;
  cor: string | null;
  cliente_nome: string | null;
  cliente_telefone: string | null;
  vendedor_id: string | null;
  avaliado_por: string | null;
  status: GestaoTrocaStatus;
  destino: "estoque" | "repasse" | null;
  checklist_json: Record<string, unknown>;
  opcionais_json: unknown[];
  observacoes: string | null;
  fotos_json: unknown;
  kbb_troca: number | null;
  kbb_loja: number | null;
  kbb_km_caracteristico: number | null;
  fipe_valor: number | null;
  fipe_mes_ref: string | null;
  preparacao_estimada: number;
  valor_sugerido: number | null;
  faixa_verde_min: number | null;
  faixa_verde_max: number | null;
  teto: number | null;
  semaforo: "verde" | "amarelo" | "vermelho" | null;
  justificativas_json: string[];
  valor_proposto: number | null;
  valor_aprovado: number | null;
  valor_fechado: number | null;
  procedencia_consulta_id: string | null;
  veiculo_id: string | null;
  repasse_comprador: string | null;
  repasse_valor: number | null;
  created_at: string;
  updated_at: string;
};

export type GestaoTrocaEvento = {
  id: string;
  tipo: string;
  descricao: string;
  valor: number | null;
  autor: string | null;
  created_at: string;
};
