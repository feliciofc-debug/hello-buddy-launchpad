import {
  assertEquals,
  assertRejects,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildSoapEnvelope,
  escapeXml,
  xmlFirstText,
  xmlPrincipalCodigoRetorno,
} from "./webmotors-soap-client.ts";
import {
  wmAlterarCarro,
  wmIncluirCarro,
  type WmAnuncioPayload,
} from "./webmotors-car-api.ts";
import { webmotorsCodigoRetornoMessageSingle } from "./webmotors-errors.ts";

const incluirComOpcionalXml = `<IncluirCarroResponse xmlns="http://tempuri.org/">
  <IncluirCarroResult>
    <Opcional>
      <OpcionalWM><CodigoOpcional>6</CodigoOpcional><Descricao /><CodigoRetorno /></OpcionalWM>
      <OpcionalWM><CodigoOpcional>5</CodigoOpcional><Descricao /><CodigoRetorno /></OpcionalWM>
    </Opcional>
    <CodigoAnuncio>987654</CodigoAnuncio>
    <CodigoRetorno>500</CodigoRetorno>
  </IncluirCarroResult>
</IncluirCarroResponse>`;

Deno.test("escapeXml escapa caracteres especiais", () => {
  assertEquals(escapeXml(`a & b <c>`), "a &amp; b &lt;c&gt;");
});

Deno.test("buildSoapEnvelope inclui body", () => {
  const xml = buildSoapEnvelope("<Test/>");
  assertEquals(xml.includes("<Test/>"), true);
  assertEquals(xml.includes("soap:Envelope"), true);
});

Deno.test("WEBMOTORS-1.3 — xmlFirstText ignora CodigoRetorno auto-fechado", () => {
  const broken = `<OpcionalWM><CodigoRetorno /></OpcionalWM><CodigoRetorno>500</CodigoRetorno>`;
  assertEquals(xmlFirstText(broken, "CodigoRetorno"), "500");
  assertEquals(
    xmlPrincipalCodigoRetorno(
      `<IncluirCarroResult>${broken}</IncluirCarroResult>`,
      "IncluirCarroResult",
    ),
    "500",
  );
});

Deno.test("WEBMOTORS-1.3 — resposta real com OpcionalWM → sucesso 500 e CodigoAnuncio", async () => {
  assertEquals(
    xmlPrincipalCodigoRetorno(incluirComOpcionalXml, "IncluirCarroResult"),
    "500",
  );
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () =>
    new Response(incluirComOpcionalXml, { status: 200 });
  try {
    const payload = {
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
      Observacao: "teste",
      OpcionalCodigos: [6, 5],
    } satisfies WmAnuncioPayload;
    const created = await wmIncluirCarro("homolog", "hash", payload);
    assertEquals(created.codigoAnuncio, 987654);
    assertEquals(created.codigoRetorno, "500");
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("WEBMOTORS-1.3 — CodigoRetorno 22|78 no Result → erro traduzido", async () => {
  const xml = `<AlterarCarroResponse><AlterarCarroResult><CodigoRetorno>22|78</CodigoRetorno></AlterarCarroResult></AlterarCarroResponse>`;
  assertEquals(
    webmotorsCodigoRetornoMessageSingle("22|78"),
    "Preço 'de' deve ser zero ou maior que o preço de venda",
  );
  assertEquals(xmlPrincipalCodigoRetorno(xml, "AlterarCarroResult"), "22|78");
  const originalFetch = globalThis.fetch;
  globalThis.fetch = async () => new Response(xml, { status: 200 });
  try {
    await assertRejects(
      () => wmAlterarCarro("homolog", "hash", {
        CodigoAnuncio: 1,
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
        Observacao: "teste",
        OpcionalCodigos: [],
      }),
      Error,
      "Preço 'de'",
    );
  } finally {
    globalThis.fetch = originalFetch;
  }
});
