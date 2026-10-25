export const OS_COTACAO_SESSAO_TTL_MS = 2 * 60 * 60 * 1000;

export type OsCotacaoSessaoGate = {
  fase: string;
  updated_at?: string | null;
};

const FASES_ATIVAS = new Set([
  "valor",
  "prazo",
  "obs",
  "confirmar",
  "confirmar_midia",
]);

export function sessaoCotacaoEstaAtiva(
  sessao: OsCotacaoSessaoGate | null,
  nowMs = Date.now(),
): boolean {
  if (!sessao || !FASES_ATIVAS.has(sessao.fase)) return false;
  const updatedMs = Date.parse(String(sessao.updated_at ?? ""));
  return Number.isFinite(updatedMs) &&
    nowMs - updatedMs >= 0 &&
    nowMs - updatedMs < OS_COTACAO_SESSAO_TTL_MS;
}

export function textoPareceOrcamentoForte(text: string): boolean {
  const normalized = String(text || "")
    .normalize("NFD")
    .replace(/\p{M}/gu, "")
    .toLowerCase();
  if (/(?:r\s*\$|\breais?\b)/i.test(normalized)) return true;
  return /\d[\d.,]*[\s\S]*\b\d{1,3}\s*dias?\b/i.test(normalized);
}

export function textoCancelaSessaoCotacao(text: string): boolean {
  return /^(?:cancelar|sair)$/i.test(String(text || "").trim());
}

export function deveCapturarMensagemCotacao(input: {
  interactive: boolean;
  sessaoAtiva: boolean;
  texto: string;
  documentoOuImagem: boolean;
}): boolean {
  return input.interactive ||
    input.sessaoAtiva ||
    input.documentoOuImagem ||
    textoPareceOrcamentoForte(input.texto);
}
