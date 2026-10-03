import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  AMZ_GLOBAL_TOOL_NAMES,
  canUseAmzGlobalTools,
  filterToolsForTenant,
  OWNER_ONLY_TOOL_NAMES,
  resolveTenantToolScope,
} from "./whatsapp-tenant-tool-access.ts";

const ADMIN_AMZ_USER_ID = "tenant-amz";
const META_ADS_OWNER_TOOLS = [
  "relatorio_anuncios_meta",
  "rascunho_anuncio_meta",
  "publicar_anuncio_meta",
  "pausar_campanha_meta",
  "ativar_campanha_meta",
  "status_campanha_meta",
];
const tools = [
  { type: "function", function: { name: "consultar_campanhas" } },
  ...META_ADS_OWNER_TOOLS.map((name) => ({
    type: "function",
    function: { name },
  })),
  ...[...AMZ_GLOBAL_TOOL_NAMES].map((name) => ({
    type: "function",
    function: { name },
  })),
];

Deno.test("dono AMZ mantém escopo global e ferramentas administrativas", () => {
  const context = {
    userId: ADMIN_AMZ_USER_ID,
    isOwner: true,
    adminAmzUserId: ADMIN_AMZ_USER_ID,
  };

  assertEquals(canUseAmzGlobalTools(context), true);
  assertEquals(resolveTenantToolScope(context), {
    scopeUserId: null,
    isAdmin: true,
  });
  assertEquals(filterToolsForTenant(tools, context), tools);
});

Deno.test("dono de outro tenant fica no próprio escopo e não recebe tools AMZ", () => {
  const context = {
    userId: "tenant-outro",
    isOwner: true,
    adminAmzUserId: ADMIN_AMZ_USER_ID,
  };

  assertEquals(canUseAmzGlobalTools(context), false);
  assertEquals(resolveTenantToolScope(context), {
    scopeUserId: "tenant-outro",
    isAdmin: false,
  });
  assertEquals(
    filterToolsForTenant(tools, context).map((tool) => tool.function.name),
    ["consultar_campanhas", ...META_ADS_OWNER_TOOLS],
  );
});

Deno.test("não-dono sempre fica no escopo do tenant", () => {
  for (const userId of [ADMIN_AMZ_USER_ID, "tenant-outro"]) {
    const context = {
      userId,
      isOwner: false,
      adminAmzUserId: ADMIN_AMZ_USER_ID,
    };

    assertEquals(canUseAmzGlobalTools(context), false);
    assertEquals(resolveTenantToolScope(context), {
      scopeUserId: userId,
      isAdmin: false,
    });
    assertEquals(
      filterToolsForTenant(tools, context).map((tool) => tool.function.name),
      ["consultar_campanhas"],
    );
  }
});

Deno.test("todas as ferramentas Meta Ads mutáveis são owner-only", () => {
  for (const name of META_ADS_OWNER_TOOLS) {
    assertEquals(OWNER_ONLY_TOOL_NAMES.has(name), true, name);
  }
});
