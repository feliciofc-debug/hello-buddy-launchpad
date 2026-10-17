const KNOWN: Record<string, string> = {
  "0": "Operação concluída.",
  "1": "Erro de autenticação. Verifique CNPJ, e-mail de integração e senha.",
  "2": "Usuário de integração inválido ou inativo.",
  "3": "Anúncio não encontrado na Webmotors.",
};

export function webmotorsCodigoRetornoMessage(code: string | null | undefined): string {
  const c = (code ?? "").trim();
  if (!c || c === "0") return KNOWN["0"];
  return KNOWN[c] ?? `A Webmotors recusou a operação (código ${c}).`;
}

export function isWebmotorsSuccess(code: string | null | undefined): boolean {
  const c = (code ?? "").trim();
  return c === "" || c === "0";
}
