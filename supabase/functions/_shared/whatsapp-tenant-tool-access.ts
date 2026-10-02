export const AMZ_GLOBAL_TOOL_NAMES = new Set([
  "consultar_metricas_amz",
  "listar_inadimplentes_amz",
  "status_plataforma_amz",
  "criar_cobranca_amz",
]);

export const OWNER_ONLY_TOOL_NAMES = new Set([
  "rascunho_anuncio_meta",
  "publicar_anuncio_meta",
  "pausar_campanha_meta",
  "ativar_campanha_meta",
  "status_campanha_meta",
  "relatorio_anuncios_meta",
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
  const canUseAmz = canUseAmzGlobalTools(context);
  return tools.filter((tool) => {
    const name = String(tool.function?.name ?? "");
    if (!context.isOwner && OWNER_ONLY_TOOL_NAMES.has(name)) return false;
    if (!canUseAmz && AMZ_GLOBAL_TOOL_NAMES.has(name)) return false;
    return true;
  });
}
