import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  AMZ_GLOBAL_TOOL_NAMES,
  canUseAmzGlobalTools,
  filterToolsForTenant,
  resolveTenantToolScope,
} from "./whatsapp-tenant-tool-access.ts";

const ADMIN_AMZ_USER_ID = "tenant-amz";
const tools = [
  { type: "function", function: { name: "consultar_campanhas" } },
  { type: "function", function: { name: "relatorio_anuncios_meta" } },
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
    ["consultar_campanhas", "relatorio_anuncios_meta"],
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
