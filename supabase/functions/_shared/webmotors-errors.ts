const KNOWN: Record<string, string> = {
  "0": "Operação concluída.",
  "401": "Hash de autenticação Webmotors inválido.",
  "402": "A sessão Webmotors expirou. Tente novamente.",
  "403": "A loja não tem permissão para esta operação.",
  "500": "Operação concluída.",
};

export function webmotorsCodigoRetornoMessageSingle(
  code: string,
): string {
  const c = code.trim();
  if (!c || c === "0" || c === "500") return "Operação concluída.";
  if (KNOWN[c]) return KNOWN[c];
  if (c === "43|74") return "Placa obrigatória";
  if (c === "22|78") {
    return "Preço 'de' deve ser zero ou maior que o preço de venda";
  }
  if (c === "43|55") return "Tipo de anúncio inválido";
  if (/^43\|(4[6-9]|5[0-4])$/.test(c)) {
    return "Informações Sim/Não obrigatórias do veículo";
  }
  if (/^43\|/.test(c)) return `Campo obrigatório inválido (${c})`;
  return `A Webmotors recusou a operação (código ${c}).`;
}

export function webmotorsCodigoRetornoMessage(
  code: string | null | undefined,
): string {
  const raw = (code ?? "").trim();
  if (!raw || raw === "0" || raw === "500") return "Operação concluída.";
  const parts = raw.split(",").map((p) => p.trim()).filter(Boolean);
  if (parts.length <= 1) {
    return webmotorsCodigoRetornoMessageSingle(parts[0] ?? raw);
  }
  const messages = parts.map((p) => webmotorsCodigoRetornoMessageSingle(p));
  return [...new Set(messages)].join(" ");
}

export function isWebmotorsSuccess(code: string | null | undefined): boolean {
  const c = (code ?? "").trim();
  return c === "" || c === "0" || c === "500";
}
