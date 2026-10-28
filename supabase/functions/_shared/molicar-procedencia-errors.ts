import { MolicarDailyLimitError } from "./molicar-service.ts";
import { MolicarHttpError } from "./molicar-client.ts";

export type ProcedenciaStartReason =
  | "molicar_nao_conectada"
  | "quota_mensal"
  | "quota_diaria"
  | "webhook_env_ausente"
  | "webhook_registro_falhou"
  | "credenciais_invalidas"
  | "identidade_invalida"
  | "servicos_invalidos"
  | "reserva_vazia"
  | "reserva_falhou"
  | "tenant_link_invalido"
  | "procedencia_automatica_desabilitada"
  | "molicar_api_falhou"
  | "desconhecido";

export type ProcedenciaStartFailure = {
  reason: ProcedenciaStartReason;
  userMessage: string;
};

const GENERIC_START =
  "Não foi possível iniciar a procedência Molicar agora. Tente novamente em instantes.";

const MOLICAR_PANEL_PATH = "Gestão › Integrações › Molicar";

function notConfiguredReply(): string {
  return `Sua loja ainda não tem a Molicar conectada. Caminho: ${MOLICAR_PANEL_PATH}.`;
}

export function classifyProcedenciaStartFailure(
  error: unknown,
): ProcedenciaStartFailure {
  if (error instanceof MolicarDailyLimitError) {
    return {
      reason: "quota_diaria",
      userMessage:
        "A loja atingiu o limite de 30 consultas Molicar hoje. Tente novamente amanhã.",
    };
  }
  if (error instanceof MolicarHttpError) {
    if (error.status === 401) {
      return {
        reason: "credenciais_invalidas",
        userMessage: notConfiguredReply(),
      };
    }
    if (/webhook/i.test(error.message)) {
      return {
        reason: "webhook_registro_falhou",
        userMessage: GENERIC_START,
      };
    }
    return {
      reason: "molicar_api_falhou",
      userMessage: GENERIC_START,
    };
  }

  const message = String((error as Error)?.message ?? "").trim();
  const lower = message.toLowerCase();

  if (/conecte a molicar|conex[aã]o molicar|credenciais molicar inv[aá]lidas/i
    .test(message)) {
    return { reason: "molicar_nao_conectada", userMessage: notConfiguredReply() };
  }
  if (/teto do m[eê]s|limite mensal|quota/i.test(message)) {
    return {
      reason: "quota_mensal",
      userMessage:
        "A cota mensal de consultas Molicar desta loja acabou. Tente no próximo mês ou ajuste o limite no painel.",
    };
  }
  if (/limite di[aá]rio/i.test(message)) {
    return {
      reason: "quota_diaria",
      userMessage:
        "A loja atingiu o limite de 30 consultas Molicar hoje. Tente novamente amanhã.",
    };
  }
  if (
    /molicar_procedencia_webhook_url|molicar_procedencia_webhook_secret/i
      .test(message) ||
    /configure molicar_procedencia_webhook/i.test(lower)
  ) {
    return {
      reason: "webhook_env_ausente",
      userMessage: GENERIC_START,
    };
  }
  if (/identidade inv[aá]lida|somente placa ou chassi|renajud s[oó]/i.test(message)) {
    return {
      reason: "identidade_invalida",
      userMessage: "Não consegui usar essa placa na procedência. Confere as letras?",
    };
  }
  if (/servi[cç]os de proced[eê]ncia|servi[cç]os inv[aá]lidos/i.test(message)) {
    return { reason: "servicos_invalidos", userMessage: GENERIC_START };
  }
  if (/n[aã]o pertence a esta loja/i.test(message)) {
    return { reason: "tenant_link_invalido", userMessage: GENERIC_START };
  }
  if (/proced[eê]ncia autom[aá]tica n[aã]o est[aá] habilitada/i.test(message)) {
    return {
      reason: "procedencia_automatica_desabilitada",
      userMessage: GENERIC_START,
    };
  }
  if (/reserva_vazia|nenhuma linha reservada/i.test(message)) {
    return { reason: "reserva_vazia", userMessage: GENERIC_START };
  }

  return { reason: "desconhecido", userMessage: GENERIC_START };
}

export function logProcedenciaSkip(
  reason: ProcedenciaStartReason,
  extra: Record<string, unknown> = {},
): void {
  console.warn("[procedencia] skip", { reason, ...extra });
}
