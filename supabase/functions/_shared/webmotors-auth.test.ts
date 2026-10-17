import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { xmlFirstText } from "./webmotors-soap-client.ts";

const fixture = await Deno.readTextFile(
  new URL("./fixtures/webmotors-autenticar-response.xml", import.meta.url),
);

Deno.test("parse autenticar response extrai hash sem logar conteudo sensivel", () => {
  const hash = xmlFirstText(fixture, "HashAutenticacao");
  const codigo = xmlFirstText(fixture, "CodigoRetorno");
  assertEquals(hash, "abc123hash");
  assertEquals(codigo, "0");
});
