import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  AMZ_GLOBAL_TOOL_NAMES,
  canUseAmzGlobalTools,
  filterToolsForTenant,
  OWNER_ONLY_TOOL_NAMES,
  resolveTenantToolScope,
} from "./whatsapp-tenant-tool-access.ts";

const ADMIN_AMZ_USER_ID = "tenant-amz";
const META_MUTATING_TOOLS = [
  "rascunho_anuncio_meta",
  "publicar_anuncio_meta",
  "pausar_campanha_meta",
  "ativar_campanha_meta",
];
const tools = [
  { type: "function", function: { name: "consultar_campanhas" } },
  ...[...AMZ_GLOBAL_TOOL_NAMES].map((name) => ({
    type: "function",
    function: { name },
  })),
  ...[...OWNER_ONLY_TOOL_NAMES].map((name) => ({
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
    ["consultar_campanhas", ...OWNER_ONLY_TOOL_NAMES],
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

Deno.test("todas as ferramentas mutáveis de Meta Ads são exclusivas do dono", () => {
  for (const name of META_MUTATING_TOOLS) {
    assertEquals(OWNER_ONLY_TOOL_NAMES.has(name), true);
  }
  const nonOwner = {
    userId: "tenant-outro",
    isOwner: false,
    adminAmzUserId: ADMIN_AMZ_USER_ID,
  };
  const visible = new Set(
    filterToolsForTenant(tools, nonOwner).map((tool) => tool.function.name),
  );
  for (const name of META_MUTATING_TOOLS) {
    assertEquals(visible.has(name), false);
  }
});
