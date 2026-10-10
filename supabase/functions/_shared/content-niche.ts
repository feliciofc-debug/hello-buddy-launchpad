export type ContentNiche = "produto" | "veiculo";

function normalize(value: unknown): string {
  return String(value || "").normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .trim();
}

export function resolveNichoDoConteudo(
  tenantRamo: unknown,
  conteudoDetectado: unknown,
): ContentNiche {
  const tenant = normalize(tenantRamo);
  const content = normalize(conteudoDetectado);
  if (/consorci/.test(tenant)) return "produto";
  if (!/^(veiculo|carro|automotivo)$/.test(content)) return "produto";
  const tenantAutomotivo =
    /(veiculo|carro|automotivo|concessionaria|revenda)/.test(tenant);
  const tenantAdmin = /^(amz|admin|administrador)$/.test(tenant);
  return tenantAutomotivo || tenantAdmin ? "veiculo" : "produto";
}
