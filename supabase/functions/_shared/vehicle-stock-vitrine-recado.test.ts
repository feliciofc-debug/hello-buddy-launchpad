import {
  assert,
  assertEquals,
  assertFalse,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildRecadoFinanciamentoFichaSemPii } from "./vehicle-stock-financiamento.ts";
import {
  buildFinanciamentoFichaPanelUrl,
  formatRecadoWhatsAppPhone,
  recadoContainsInternalIds,
} from "./vehicle-stock-vitrine-recado.ts";
import {
  buildRecadoConsultor,
  buildRecadoInteresse,
  buildRecadoVisita,
} from "./vehicle-stock-whatsapp.ts";
import { buildRecadoTrocaAvaliacao } from "./vehicle-stock-troca.ts";

const vehicle = {
  id: "00000000-0000-4000-8000-000000000001",
  marca: "Porsche",
  modelo: "911",
  versao: "Carrera 3.0 PDK",
  ano_fabricacao: 2024,
  ano_modelo: 2024,
  km: 1000,
  preco: 809900,
  cor: null,
  cambio: null,
  combustivel: null,
  portas: null,
  blindado: false,
  nivel_blindagem: null,
  opcionais: null,
  caracteristicas: null,
  descricao: null,
  fotos: null,
  status: "disponivel",
};

const cliente = {
  clienteNome: "Felicio Frauches Carega",
  contactName: "Fred",
  fromNumber: "5521995379550",
};

Deno.test("formatRecadoWhatsAppPhone formata DDD e hífen", () => {
  assertEquals(formatRecadoWhatsAppPhone("5521995379550"), "55 21 99537-9550");
});

Deno.test("link da ficha usa APP_URL configurável", () => {
  const url = buildFinanciamentoFichaPanelUrl("abc-123", "https://app.test/");
  assertEquals(url, "https://app.test/veiculos/financiamento/abc-123");
});

Deno.test("recados da vitrine não expõem IDs internos de estoque/painel", () => {
  const samples = [
    buildRecadoInteresse({ ...cliente, vehicle }),
    buildRecadoConsultor({ ...cliente, vehicle }),
    buildRecadoVisita({
      ...cliente,
      vehicle,
      diaIso: "2026-10-20",
      turno: "manha",
    }),
    buildRecadoFinanciamentoFichaSemPii({
      ...cliente,
      vehicle,
      fichaId: "00000000-0000-4000-8000-000000000099",
      appBaseUrl: "https://app.test",
    }),
    buildRecadoTrocaAvaliacao({
      ...cliente,
      vehicleEstoque: vehicle,
      form: {
        flow: "troca",
        step: "concluido",
        veiculo_id: vehicle.id,
        updated_at: new Date().toISOString(),
        modelo_ano: "Civic 2018",
        km: "80000",
        placa: "ABC1D23",
        fotos: [],
      },
    }),
  ];
  for (const recado of samples) {
    assertFalse(recadoContainsInternalIds(recado), recado);
    assertFalse(recado.includes("Dados sensíveis só no painel"));
  }
});

Deno.test("recado interesse segue padrão limpo", () => {
  const recado = buildRecadoInteresse({ ...cliente, vehicle });
  assertStringIncludes(recado, "💬 *Novo interesse*");
  assertStringIncludes(recado, "Felicio Frauches Carega (perfil: Fred)");
  assertStringIncludes(recado, "55 21 99537-9550");
  assertStringIncludes(recado, "🚗 Porsche 911");
  assertStringIncludes(recado, "809.900");
  assertStringIncludes(recado, "➡️ Retornar o contato do cliente.");
});

Deno.test("recado ficha financiamento traz link absoluto da ficha", () => {
  const recado = buildRecadoFinanciamentoFichaSemPii({
    ...cliente,
    vehicle,
    fichaId: "ficha-uuid-1",
    appBaseUrl: "https://amzofertas.com.br",
    camposPendentes: ["email"],
  });
  assertStringIncludes(
    recado,
    "📄 Ver ficha completa: https://amzofertas.com.br/veiculos/financiamento/ficha-uuid-1",
  );
  assertStringIncludes(recado, "📋 Pendências para consultor: email.");
});
