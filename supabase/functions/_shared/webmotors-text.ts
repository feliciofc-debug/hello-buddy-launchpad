export type WebmotorsForbiddenRule = {
  label: string;
  re: RegExp;
};

/** Termos e padrões que não devem ir na Observacao pública do anúncio. */
export const WEBMOTORS_FORBIDDEN_IN_OBSERVACAO: WebmotorsForbiddenRule[] = [
  { label: "FIPE", re: /\bfipe\b/i },
  { label: "KBB", re: /\bkbb\b/i },
  { label: "CPF", re: /\bcpf\b/i },
  { label: "CNPJ", re: /\bcnpj\b/i },
  { label: "telefone", re: /\btelefone\b/i },
  { label: "WhatsApp", re: /\bwhatsapp\b/i },
  { label: "CPF (número)", re: /\b\d{3}\.?\d{3}\.?\d{3}-?\d{2}\b/ },
  { label: "CNPJ (número)", re: /\b\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}\b/ },
  { label: "telefone (número)", re: /(?:\(?\d{2}\)?\s*)?(?:9?\d{4})-?\d{4}\b/ },
  { label: "telefone (número)", re: /\b\d{8,}\b/ },
];

export function findWebmotorsForbiddenTerm(text: string): string | null {
  for (const rule of WEBMOTORS_FORBIDDEN_IN_OBSERVACAO) {
    if (rule.re.test(text)) return rule.label;
  }
  return null;
}

/** Texto público do anúncio — somente `descricao` do veículo, saneada. */
export function webmotorsPublicObservacao(descricao: string | null | undefined): string {
  const base = (descricao ?? "").trim();
  if (!base) return "";
  const term = findWebmotorsForbiddenTerm(base);
  if (term) {
    throw new Error(
      `A descrição contém '${term}' e não pode ir para o anúncio Webmotors.`,
    );
  }
  return base.slice(0, 4000);
}

export function normalizeCatalogLabel(value: string): string {
  return value
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim();
}
