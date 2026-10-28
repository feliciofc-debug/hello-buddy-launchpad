/**
 * Regras espelham `gestao_documento_campos_sem_pii` em
 * supabase/migrations/20261032270000_seg_doc_cofre.sql — altere os dois juntos.
 */
export const CAMPOS_VEICULO_PII_KEYS = [
  "proprietario",
  "proprietario_nome",
  "nome",
  "cpf",
  "cnpj",
  "cpf_cnpj",
  "documento_proprietario",
] as const;

const CAMPOS_VEICULO_PII_KEY_SET = new Set<string>(
  CAMPOS_VEICULO_PII_KEYS.map((k) => k.toLowerCase()),
);

/** Mesmo padrão da constraint CHECK (qualquer profundidade no JSON serializado). */
export const CAMPOS_VEICULO_PII_JSON_KEY_RE =
  new RegExp(
    '"(proprietario|proprietario_nome|nome|cpf|cnpj|cpf_cnpj|documento_proprietario)"\\s*:',
    "i",
  );

export const GESTAO_DOCUMENTO_CAMPOS_SAVE_USER_MESSAGE =
  "Não consegui salvar os dados do documento agora. Tente de novo em instantes.";

export type GestaoDocumentoCamposSaveReason =
  | "gestao_documento_campos_sem_pii"
  | "gestao_documento_update_failed";

export class GestaoDocumentoCamposSaveError extends Error {
  readonly reasonCode: GestaoDocumentoCamposSaveReason;

  constructor(reasonCode: GestaoDocumentoCamposSaveReason) {
    super(GESTAO_DOCUMENTO_CAMPOS_SAVE_USER_MESSAGE);
    this.name = "GestaoDocumentoCamposSaveError";
    this.reasonCode = reasonCode;
  }
}

export function camposVeiculoViolatesPiiConstraint(
  campos: unknown,
): boolean {
  if (!campos || typeof campos !== "object" || Array.isArray(campos)) {
    return false;
  }
  const record = campos as Record<string, unknown>;
  for (const key of CAMPOS_VEICULO_PII_KEYS) {
    if (key in record) return true;
  }
  return CAMPOS_VEICULO_PII_JSON_KEY_RE.test(JSON.stringify(campos));
}

/** Remove chaves de PII em qualquer profundidade antes de gravar `campos_veiculo`. */
export function camposVeiculoSemPii<T = unknown>(value: T): T {
  if (Array.isArray(value)) {
    return value.map((item) => camposVeiculoSemPii(item)) as T;
  }
  if (!value || typeof value !== "object") return value;
  const out: Record<string, unknown> = {};
  for (
    const [key, nested] of Object.entries(value as Record<string, unknown>)
  ) {
    if (CAMPOS_VEICULO_PII_KEY_SET.has(key.toLowerCase())) continue;
    out[key] = camposVeiculoSemPii(nested);
  }
  return out as T;
}

export function camposVeiculoContainsPiiKey(value: unknown): boolean {
  return camposVeiculoViolatesPiiConstraint(value);
}

export function logGestaoDocumentoCamposSaveFailure(
  reason: GestaoDocumentoCamposSaveReason,
  extra: Record<string, unknown> = {},
): void {
  console.warn("[gestao-documento] save_failed", { reason, ...extra });
}

export function assertGestaoDocumentoCamposUpdateOk(
  error: { code?: string } | null,
): void {
  if (!error) return;
  const reason: GestaoDocumentoCamposSaveReason = error.code === "23514"
    ? "gestao_documento_campos_sem_pii"
    : "gestao_documento_update_failed";
  logGestaoDocumentoCamposSaveFailure(reason);
  throw new GestaoDocumentoCamposSaveError(reason);
}
