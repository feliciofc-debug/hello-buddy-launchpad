import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  loadWebmotorsHomologCredentials,
  normalizeWebmotorsServerEnvironment,
  parseWebmotorsHmlTenantIds,
  webmotorsServerEnvironmentForUser,
} from "./webmotors-config.ts";
import { scopedWebmotorsCatalogKey } from "./webmotors-catalog.ts";

function env(values: Record<string, string>) {
  return { get: (name: string) => values[name] };
}

Deno.test("WEBMOTORS_ENV normaliza producao e homologacao", () => {
  assertEquals(normalizeWebmotorsServerEnvironment(undefined), "homologacao");
  assertEquals(
    normalizeWebmotorsServerEnvironment("homologacao"),
    "homologacao",
  );
  assertEquals(normalizeWebmotorsServerEnvironment("producao"), "producao");
});

Deno.test("lojas fora de WEBMOTORS_HML_TENANTS usam producao", () => {
  const reader = env({
    WEBMOTORS_HML_TENANTS: "tenant-hml-a, tenant-hml-b",
  });
  assertEquals(
    webmotorsServerEnvironmentForUser("loja-prod-1", reader),
    "producao",
  );
  assertEquals(
    webmotorsServerEnvironmentForUser("tenant-hml-a", reader),
    "homologacao",
  );
});

Deno.test("WEBMOTORS_HML_TENANTS aceita separadores comuns", () => {
  const ids = parseWebmotorsHmlTenantIds(env({
    WEBMOTORS_HML_TENANTS: "a,b; c\td",
  }));
  assertEquals(ids.has("a"), true);
  assertEquals(ids.has("b"), true);
  assertEquals(ids.has("c"), true);
  assertEquals(ids.has("d"), true);
});

Deno.test("credenciais HML vêm somente do ambiente", () => {
  const credentials = loadWebmotorsHomologCredentials(env({
    WEBMOTORS_HML_CNPJ: "12.345.678/0001-90",
    WEBMOTORS_HML_USER: "integracao@loja.test",
    WEBMOTORS_HML_PASSWORD: "segredo",
  }));
  assertEquals(credentials.cnpj, "12345678000190");
  assertEquals(credentials.email, "integracao@loja.test");
  assertEquals(credentials.senha, "segredo");
});

Deno.test("credenciais HML incompletas são rejeitadas sem expor valores", () => {
  assertThrows(
    () => loadWebmotorsHomologCredentials(env({})),
    Error,
    "WEBMOTORS_HML_CNPJ",
  );
});

Deno.test("cache de catálogo é isolado por tenant", () => {
  assertEquals(
    scopedWebmotorsCatalogKey("loja-a", "modalidades") ===
      scopedWebmotorsCatalogKey("loja-b", "modalidades"),
    false,
  );
});
