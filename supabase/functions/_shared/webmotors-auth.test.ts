import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { xmlFirstText } from "./webmotors-soap-client.ts";
import { webmotorsAutenticar } from "./webmotors-auth.ts";

const fixture = await Deno.readTextFile(
  new URL("./fixtures/webmotors-autenticar-response.xml", import.meta.url),
);

Deno.test("parse autenticar response extrai hash sem logar conteudo sensivel", () => {
  const hash = xmlFirstText(fixture, "HashAutenticacao");
  const codigo = xmlFirstText(fixture, "CodigoRetorno");
  assertEquals(hash, "abc123hash");
  assertEquals(codigo, "0");
});

Deno.test("autenticar aceita CodigoRetorno 500 da collection", async () => {
  const originalFetch = globalThis.fetch;
  let requestBody = "";
  globalThis.fetch = async (_input, init) => {
    requestBody = String(init?.body ?? "");
    return new Response(
      `<autenticarResponse><CodigoRetorno>500</CodigoRetorno><HashAutenticacao>token-omitido</HashAutenticacao></autenticarResponse>`,
      { status: 200 },
    );
  };
  try {
    const hash = await webmotorsAutenticar({
      ambiente: "homolog",
      cnpj: "12345678000190",
      email: "integracao@loja.test",
      senha: "nao-logar",
    });
    assertEquals(hash, "token-omitido");
    assertEquals(requestBody.includes("<autenticar"), true);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
