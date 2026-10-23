import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildAnuncioXml, type WmAnuncioPayload } from "./webmotors-car-api.ts";

function samplePayload(overrides: Partial<WmAnuncioPayload> = {}): WmAnuncioPayload {
  return {
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
    UnicoDono: "S",
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
    ...overrides,
  };
}

Deno.test("WEBMOTORS-1.1 — buildAnuncioXml ordem Placa após Km e S/N após Blindado", () => {
  const xml = buildAnuncioXml(samplePayload({ Placa: "ABC1D23" }));
  const km = xml.indexOf("<Km>1000</Km>");
  const placa = xml.indexOf("<Placa>ABC1D23</Placa>");
  const cambio = xml.indexOf("<CodigoCambio>");
  const blindado = xml.indexOf("<Blindado>N</Blindado>");
  const adaptado = xml.indexOf("<AdaptadoDeficientesFisicos>");
  const leilao = xml.indexOf("<Leilao>N</Leilao>");
  const precoReal = xml.indexOf("<PrecoReal>0</PrecoReal>");

  assert(km >= 0 && placa > km && cambio > placa);
  assert(blindado >= 0 && adaptado > blindado && leilao > adaptado && precoReal > leilao);
  assertEquals(xml.includes("<UnicoDono>S</UnicoDono>"), true);
});

Deno.test("WEBMOTORS-1.1 — escapeXml na placa", () => {
  const xml = buildAnuncioXml(samplePayload({ Placa: "A&B<1" }));
  assert(xml.includes("<Placa>A&amp;B&lt;1</Placa>"));
});
