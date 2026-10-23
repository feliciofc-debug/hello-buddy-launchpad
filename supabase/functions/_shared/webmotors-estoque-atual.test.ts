import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { xmlAllBlocks, xmlAllBlocksPrefer } from "./webmotors-soap-client.ts";
import { wmObterEstoqueAtual } from "./webmotors-car-api.ts";

const estoqueRealXml = `<ObterEstoqueAtualResponse xmlns="http://tempuri.org/">
  <ObterEstoqueAtualResult>
    <Anuncio>
      <CodigoAnuncio>26113197</CodigoAnuncio>
      <CodigoModalidade>2943</CodigoModalidade>
      <Placa>FWC2B93</Placa>
    </Anuncio>
    <Anuncio>
      <CodigoAnuncio>26153807</CodigoAnuncio>
      <CodigoModalidade>2943</CodigoModalidade>
      <Placa>ABC1D23</Placa>
    </Anuncio>
  </ObterEstoqueAtualResult>
  <CodigoRetorno>500</CodigoRetorno>
</ObterEstoqueAtualResponse>`;

Deno.test("WEBMOTORS-1.4 — Anuncio não confunde com CodigoAnuncio", () => {
  assertEquals(xmlAllBlocks("<CodigoAnuncio>99</CodigoAnuncio>", "Anuncio").length, 0);
  assertEquals(
    xmlAllBlocksPrefer(
      "<AnuncioWM><CodigoAnuncio>1</CodigoAnuncio></AnuncioWM>",
      "Anuncio",
      "AnuncioWM",
    ).length,
    1,
  );
});

Deno.test("WEBMOTORS-1.4 — ObterEstoqueAtual lê blocos Anuncio (homologação real)", async () => {
  assertEquals(
    xmlAllBlocksPrefer(estoqueRealXml, "Anuncio", "AnuncioWM").length,
    2,
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(estoqueRealXml, { status: 200 });
  try {
    assertEquals(await wmObterEstoqueAtual("homolog", "hash"), [
      26113197,
      26153807,
    ]);
  } finally {
    globalThis.fetch = originalFetch;
  }
});
