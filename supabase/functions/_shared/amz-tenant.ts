/** Tenant AMZ canônico criado na migração de 23/09/2026. */
export const CANONICAL_AMZ_TENANT_ID = "561e0ccc-3eda-4dc1-a315-c86a51623fc3";

function validUuid(value: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(value);
}

/**
 * Runtime usa o secret compartilhado; o fallback canônico mantém funções
 * one-shot e ambientes de teste seguros quando o secret ainda não foi criado.
 */
export function resolveAmzTenantId(): string {
  const configured = String(Deno.env.get("AMZ_TENANT_ID") || "").trim();
  if (!configured) return CANONICAL_AMZ_TENANT_ID;
  if (validUuid(configured)) return configured;
  console.error("[amz-tenant] AMZ_TENANT_ID inválido; usando tenant canônico");
  return CANONICAL_AMZ_TENANT_ID;
}

export const AMZ_TENANT_ID = resolveAmzTenantId();
