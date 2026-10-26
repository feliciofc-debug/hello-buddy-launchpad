import type { GestaoOsStatus } from "../../supabase/functions/_shared/gestao-os-domain.ts";

export type GestaoOsTipo = "preparacao" | "garantia" | "revisao" | "avulsa";

export type GestaoOsRow = {
  id: string;
  user_id: string;
  numero: number;
  veiculo_id: string;
  parceiro_id: string | null;
  tipo: GestaoOsTipo;
  status: GestaoOsStatus;
  origem: string;
  troca_id: string | null;
  garantia_id: string | null;
  ocorrencia_garantia_id: string | null;
  data_prevista: string | null;
  valor_estimado: number;
  valor_aprovado: number | null;
  valor_real: number | null;
  descontar_do_consignante: boolean | null;
  conta_vencimento: string | null;
  sync_aviso: string | null;
  observacao: string | null;
  ultima_movimentacao_em: string;
  created_at: string;
  concluida_em: string | null;
  despesa_id?: string | null;
  conta_lancamento_id?: string | null;
};

export type GestaoOsItemRow = {
  id: string;
  user_id: string;
  os_id: string;
  descricao: string;
  categoria_despesa: string;
  quantidade: number;
  valor_estimado: number;
  valor_aprovado: number | null;
  valor_real: number | null;
  status: "sugerido" | "aprovado" | "recusado" | "executado" | "cancelado";
  origem: "manual" | "laudo";
};

export type GestaoOsCotacaoRow = {
  id: string;
  user_id: string;
  os_id: string;
  parceiro_id: string;
  valor: number | null;
  prazo_dias: number | null;
  observacao: string | null;
  status: "solicitada" | "recebida" | "escolhida" | "descartada" | "recusada";
  solicitada_em: string;
  recebida_em: string | null;
  canal?: "painel" | "whatsapp";
  envio_whatsapp_status?: "enviado" | "convite_enviado" | "pendente_modelo" | "falhou" | "nao_aplicavel" | null;
  envio_whatsapp_erro?: string | null;
  envio_pendente_motivo?: string | null;
  transcricao_audio?: string | null;
  recusada_em?: string | null;
};

export type GestaoParceiroRow = {
  id: string;
  user_id: string;
  nome: string;
  nome_fantasia: string | null;
  documento: string | null;
  whatsapp_e164: string | null;
  email: string | null;
  tipos: string[];
  prazo_medio_dias: number | null;
  ativo: boolean;
  observacao: string | null;
};

export const GESTAO_OS_STATUS_LABEL: Record<GestaoOsStatus, string> = {
  rascunho: "Rascunho",
  orcamento: "Em cotação",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  checkin: "Check-in",
  em_execucao: "Em execução",
  aguardando_retirada: "Aguardando retirada",
  checkout: "Check-out",
  concluida: "Concluída",
  cancelada: "Cancelada",
};

export const GESTAO_OS_TIPO_LABEL: Record<GestaoOsTipo, string> = {
  preparacao: "Preparação",
  garantia: "Garantia",
  revisao: "Revisão",
  avulsa: "Avulsa",
};
