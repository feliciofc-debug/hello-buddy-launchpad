import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { PDFDocument } from "https://esm.sh/pdf-lib@1.17.1?target=deno";
import { buildJarvisCartilhaPdfBytes } from "./jarvis-cartilha-pdf.ts";
import {
  JARVIS_AJUDA_CATALOGO_VERSAO,
  JARVIS_AJUDA_SECOES,
} from "./jarvis-ajuda-catalogo.ts";

Deno.test("AJUDA-1 — PDF tem capa e uma página inicial por seção", async () => {
  const bytes = await buildJarvisCartilhaPdfBytes({ lojaNome: "Loja Teste" });
  assert(bytes.byteLength > 5_000);
  assertEquals(new TextDecoder().decode(bytes.slice(0, 5)), "%PDF-");
  const pdf = await PDFDocument.load(bytes);
  assert(pdf.getPageCount() >= JARVIS_AJUDA_SECOES.length + 1);
});

Deno.test("AJUDA-1 — storage versionado e JWT configurado", async () => {
  const source = await Deno.readTextFile(
    new URL("./jarvis-cartilha-pdf.ts", import.meta.url),
  );
  const config = await Deno.readTextFile(
    new URL("../../config.toml", import.meta.url),
  );
  assertStringIncludes(source, `v\${JARVIS_AJUDA_CATALOGO_VERSAO}.pdf`);
  assert(JARVIS_AJUDA_CATALOGO_VERSAO.length > 0);
  assertStringIncludes(
    config,
    "[functions.jarvis-cartilha-pdf]\nverify_jwt = true",
  );
});
