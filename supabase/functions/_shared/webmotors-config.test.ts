import {
  assertEquals,
  assertThrows,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  loadWebmotorsHomologCredentials,
  normalizeWebmotorsServerEnvironment,
} from "./webmotors-config.ts";
import { scopedWebmotorsCatalogKey } from "./webmotors-catalog.ts";

function env(values: Record<string, string>) {
  return { get: (name: string) => values[name] };
}

Deno.test("WEBMOTORS_ENV usa homologacao por padrão", () => {
  assertEquals(normalizeWebmotorsServerEnvironment(undefined), "homologacao");
  assertEquals(
    normalizeWebmotorsServerEnvironment("homologacao"),
    "homologacao",
  );
  assertEquals(normalizeWebmotorsServerEnvironment("producao"), "producao");
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
