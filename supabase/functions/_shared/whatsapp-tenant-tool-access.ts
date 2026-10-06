export const AMZ_GLOBAL_TOOL_NAMES = new Set([
  "consultar_metricas_amz",
  "listar_inadimplentes_amz",
  "status_plataforma_amz",
  "criar_cobranca_amz",
]);

export const OWNER_ONLY_TOOL_NAMES = new Set([
  "consultar_fipe",
  "relatorio_anuncios_meta",
  "alterar_limite_mensal_anuncios",
  "rascunho_anuncio_meta",
  "publicar_anuncio_meta",
  "pausar_campanha_meta",
  "ativar_campanha_meta",
  "status_campanha_meta",
]);

export type TenantToolAccessContext = {
  userId: string;
  isOwner: boolean;
  adminAmzUserId: string;
};

export function canUseAmzGlobalTools(
  context: TenantToolAccessContext,
): boolean {
  return context.isOwner && context.userId === context.adminAmzUserId;
}

export function resolveTenantToolScope(
  context: TenantToolAccessContext,
): { scopeUserId: string | null; isAdmin: boolean } {
  const isAdmin = canUseAmzGlobalTools(context);
  return {
    scopeUserId: isAdmin ? null : context.userId,
    isAdmin,
  };
}

type ToolDefinition = {
  function?: {
    name?: string;
  };
};

export function filterToolsForTenant<T extends ToolDefinition>(
  tools: readonly T[],
  context: TenantToolAccessContext,
): T[] {
  const ownerAllowed = context.isOwner
    ? [...tools]
    : tools.filter((tool) =>
      !OWNER_ONLY_TOOL_NAMES.has(String(tool.function?.name ?? ""))
    );
  if (canUseAmzGlobalTools(context)) return ownerAllowed;
  return ownerAllowed.filter((tool) =>
    !AMZ_GLOBAL_TOOL_NAMES.has(String(tool.function?.name ?? ""))
  );
}
