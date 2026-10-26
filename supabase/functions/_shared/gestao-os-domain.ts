export const GESTAO_OS_STATUS = [
  "rascunho",
  "orcamento",
  "aguardando_aprovacao",
  "aprovada",
  "checkin",
  "em_execucao",
  "aguardando_retirada",
  "checkout",
  "concluida",
  "cancelada",
] as const;

export type GestaoOsStatus = (typeof GESTAO_OS_STATUS)[number];

const NEXT: Partial<Record<GestaoOsStatus, readonly GestaoOsStatus[]>> = {
  rascunho: ["orcamento", "cancelada"],
  orcamento: ["aguardando_aprovacao", "cancelada"],
  aguardando_aprovacao: ["aprovada", "cancelada"],
  aprovada: ["checkin", "cancelada"],
  checkin: ["em_execucao", "cancelada"],
  em_execucao: ["aguardando_retirada", "aguardando_aprovacao", "cancelada"],
  aguardando_retirada: ["checkout", "cancelada"],
  checkout: ["concluida", "cancelada"],
};

export function podeTransicionarOs(
  atual: GestaoOsStatus,
  destino: GestaoOsStatus,
): boolean {
  return NEXT[atual]?.includes(destino) ?? false;
}

export function proximosStatusOs(atual: GestaoOsStatus): GestaoOsStatus[] {
  return [...(NEXT[atual] ?? [])];
}

export type GestaoOsExcluirGateInput = {
  status: GestaoOsStatus;
  despesa_id?: string | null;
  conta_lancamento_id?: string | null;
};

/** Exclusão física só em rascunho/cotação sem financeiro (RPC valida cotação escolhida). */
export function podeExcluirOs(input: GestaoOsExcluirGateInput): boolean {
  if (!["rascunho", "orcamento"].includes(input.status)) return false;
  if (input.despesa_id) return false;
  if (input.conta_lancamento_id) return false;
  return true;
}

export const GESTAO_OS_EXCLUIR_DICA_APROVADA =
  "OS aprovada não pode ser excluída, apenas cancelada.";

export type GestaoOsAlertaInput = {
  status: GestaoOsStatus;
  ultimaMovimentacaoEm: string;
  tipo: "preparacao" | "garantia" | "revisao" | "avulsa";
  veiculoStatus?: string | null;
  entradaVeiculoEm?: string | null;
};

export type GestaoOsAlertasConfig = {
  osParadaDias: number;
  preparacaoParadaDias: number;
};

const MS_DIA = 86_400_000;

function diasEntre(inicio: string | null | undefined, agora: Date): number {
  if (!inicio) return 0;
  const ms = agora.getTime() - new Date(inicio).getTime();
  return Math.max(0, Math.floor(ms / MS_DIA));
}

export function alertasGestaoOs(
  os: GestaoOsAlertaInput[],
  config: GestaoOsAlertasConfig,
  agora = new Date(),
): { osParadas: number; preparacoesParadas: number } {
  return {
    osParadas: os.filter((item) =>
      !["concluida", "cancelada"].includes(item.status) &&
      diasEntre(item.ultimaMovimentacaoEm, agora) >= config.osParadaDias
    ).length,
    preparacoesParadas: os.filter((item) =>
      item.tipo === "preparacao" &&
      item.veiculoStatus === "em_preparacao" &&
      diasEntre(item.entradaVeiculoEm, agora) >= config.preparacaoParadaDias
    ).length,
  };
}

export function validarLiberacaoComOs(input: {
  fotos: string[] | null | undefined;
  preco: number | null | undefined;
  osPreparacao: Array<{ status: GestaoOsStatus }>;
}): { ok: true } | { ok: false; motivo: string } {
  if (!input.fotos?.length) {
    return { ok: false, motivo: "Adicione pelo menos uma foto." };
  }
  if (!input.preco || input.preco <= 0) {
    return { ok: false, motivo: "Informe o preço." };
  }
  if (input.osPreparacao.some((os) =>
    !["concluida", "cancelada"].includes(os.status)
  )) {
    return {
      ok: false,
      motivo: "Conclua ou cancele todas as OS de preparação.",
    };
  }
  return { ok: true };
}

export function exigeDecisaoConsignante(input: {
  consignadoAtivo: boolean;
  descontarDoConsignante: boolean | null | undefined;
}): boolean {
  return input.consignadoAtivo &&
    typeof input.descontarDoConsignante !== "boolean";
}

export type RegistroFinanceiroOs = {
  deletedAt?: string | null;
  pagoEm?: string | null;
  recebidoEm?: string | null;
  valor: number;
};

export const GESTAO_OS_DOCUMENTO_MAX_BYTES = 15 * 1024 * 1024;

export const GESTAO_OS_DOCUMENTO_MIME_TYPES = [
  "image/jpeg",
  "image/png",
  "image/webp",
  "application/pdf",
] as const;

export function validarArquivoDocumentoOs(
  file: Pick<File, "name" | "size" | "type">,
): { ok: true } | { ok: false; mensagem: string } {
  if (!(GESTAO_OS_DOCUMENTO_MIME_TYPES as readonly string[]).includes(file.type)) {
    return {
      ok: false,
      mensagem: `${file.name}: envie JPG, PNG, WebP ou PDF.`,
    };
  }
  if (file.size > GESTAO_OS_DOCUMENTO_MAX_BYTES) {
    return {
      ok: false,
      mensagem: `${file.name}: o arquivo pode ter no máximo 15 MB.`,
    };
  }
  return { ok: true };
}

export function decidirSincronizacaoOs(input: {
  registro?: RegistroFinanceiroOs | null;
  ultimoValorSincronizado?: number | null;
  novoValor: number;
}): "criar" | "atualizar" | "preservar_apagado" | "preservar_baixado" | "preservar_editado" {
  const { registro, ultimoValorSincronizado, novoValor } = input;
  if (!registro) return "criar";
  if (registro.deletedAt) return "preservar_apagado";
  if (registro.pagoEm || registro.recebidoEm) return "preservar_baixado";
  if (
    ultimoValorSincronizado != null &&
    registro.valor !== ultimoValorSincronizado
  ) return "preservar_editado";
  return registro.valor === novoValor ? "atualizar" : "atualizar";
}
