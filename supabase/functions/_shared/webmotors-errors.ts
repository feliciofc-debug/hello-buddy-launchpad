const KNOWN: Record<string, string> = {
  "0": "Operação concluída.",
  "401": "Hash de autenticação Webmotors inválido.",
  "402": "A sessão Webmotors expirou. Tente novamente.",
  "403": "A loja não tem permissão para esta operação.",
  "500": "Operação concluída.",
};

export function webmotorsCodigoRetornoMessage(
  code: string | null | undefined,
): string {
  const c = (code ?? "").trim();
  if (!c || c === "0" || c === "500") return "Operação concluída.";
  return KNOWN[c] ?? `A Webmotors recusou a operação (código ${c}).`;
}

export function isWebmotorsSuccess(code: string | null | undefined): boolean {
  const c = (code ?? "").trim();
  return c === "" || c === "0" || c === "500";
}
