import {
  assert,
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  wmAlterarCarro,
  type WmAnuncioPayload,
  wmExcluirCarro,
  wmExcluirFoto,
  wmIncluirCarro,
  wmIncluirFotoBase64,
  wmObterEstoqueAtual,
} from "./webmotors-car-api.ts";

const payload: WmAnuncioPayload = {
  CodigoAnuncio: 0,
  CodigoModalidade: 7,
  TipoAnuncio: "U",
  CodigoMarca: 1,
  CodigoModelo: 2,
  CodigoVersao: 3,
  AnoDoModelo: 2024,
  AnoFabricacao: 2023,
  Km: 1000,
  Placa: "ABC1D23",
  CodigoCambio: 4,
  NrPortas: 4,
  CodigoCor: 5,
  CodigoCombustivel: 6,
  Blindado: "N",
  AdaptadoDeficientesFisicos: "N",
  UnicoDono: "N",
  Alienado: "N",
  IpvaPago: "N",
  NaoAceitaTroca: "N",
  RevisadoOficinaAgendaDoCarro: "N",
  RevisoesEmConcessionaria: "N",
  GarantiaDeFabrica: "N",
  Licenciado: "N",
  Leilao: "N",
  PrecoReal: 0,
  PrecoVenda: 100000,
  Observacao: "Veículo de teste",
  OpcionalCodigos: [8],
};

Deno.test("operações SOAP da collection: incluir, alterar, foto, estoque e excluir", async () => {
  const originalFetch = globalThis.fetch;
  const requests: string[] = [];
  const responses = [
    `<IncluirCarroResponse><CodigoRetorno>500</CodigoRetorno><CodigoAnuncio>123</CodigoAnuncio></IncluirCarroResponse>`,
    `<AlterarCarroResponse><CodigoRetorno>500</CodigoRetorno></AlterarCarroResponse>`,
    `<IncluirFotoResponse><CodigoRetorno>500</CodigoRetorno><CodigoFotoAnuncio>77</CodigoFotoAnuncio></IncluirFotoResponse>`,
    `<ExcluirFotoResponse><CodigoRetorno>500</CodigoRetorno></ExcluirFotoResponse>`,
    `<ObterEstoqueAtualResponse><CodigoRetorno>500</CodigoRetorno><ObterEstoqueAtualResult><AnuncioWM><CodigoAnuncio>123</CodigoAnuncio></AnuncioWM></ObterEstoqueAtualResult></ObterEstoqueAtualResponse>`,
    `<ExcluirCarroResponse><CodigoRetorno>500</CodigoRetorno></ExcluirCarroResponse>`,
  ];
  globalThis.fetch = async (_input, init) => {
    requests.push(String(init?.body ?? ""));
    return new Response(responses.shift(), { status: 200 });
  };
  try {
    const created = await wmIncluirCarro("homolog", "hash", payload);
    assertEquals(created.codigoAnuncio, 123);
    await wmAlterarCarro("homolog", "hash", { ...payload, CodigoAnuncio: 123 });
    assertEquals(
      await wmIncluirFotoBase64("homolog", "hash", 123, "aW1hZ2U="),
      77,
    );
    await wmExcluirFoto("homolog", "hash", 123, 77);
    assertEquals(await wmObterEstoqueAtual("homolog", "hash"), [123]);
    await wmExcluirCarro("homolog", "hash", 123, "3");

    assert(requests[0].includes("<IncluirCarro"));
    assert(requests[1].includes("<AlterarCarro"));
    assert(requests[2].includes("<IncluirFoto"));
    assert(requests[2].includes("<pByteImage>aW1hZ2U=</pByteImage>"));
    assert(requests[3].includes("<ExcluirFoto"));
    assert(requests[3].includes("<pCodigoFoto>77</pCodigoFoto>"));
    assert(requests[4].includes("<ObterEstoqueAtual"));
    assert(requests[5].includes("<ExcluirCarro"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("erro de campo obrigatório da Webmotors é propagado sem credenciais", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(
      `<IncluirCarroResponse><CodigoRetorno>21|1</CodigoRetorno></IncluirCarroResponse>`,
      { status: 200 },
    );
  try {
    await assertRejects(
      () => wmIncluirCarro("homolog", "hash-secreto", payload),
      Error,
      "código 21|1",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
