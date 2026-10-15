import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runVehicleStockShowcaseTurn } from "./vehicle-stock-showcase-turn.ts";
import type { ShowcaseTurnDeps } from "./vehicle-stock-showcase-turn.ts";
import type { VeiculoVitrineRow } from "./vehicle-stock-whatsapp.ts";

function sampleVehicle(id: string): VeiculoVitrineRow {
  return {
    id,
    marca: "Porsche",
    modelo: "911",
    versao: "Carrera",
    ano_fabricacao: 2022,
    ano_modelo: 2022,
    km: 12000,
    preco: 890000,
    cor: "Cinza",
    cambio: "PDK",
    combustivel: "Gasolina",
    portas: 2,
    blindado: false,
    nivel_blindagem: null,
    opcionais: ["Bose"],
    caracteristicas: ["Revisões em dia"],
    descricao: null,
    fotos: ["https://example.com/1.jpg", "https://example.com/2.jpg"],
    status: "disponivel",
  };
}

function stubDeps(overrides: Partial<ShowcaseTurnDeps> = {}): ShowcaseTurnDeps {
  const noop = async () => ({ ok: true as const, messageId: "x" });
  return {
    loadTenantFlags: async () => ({
      segmento: "revenda de veículos",
      vitrine_veiculos_demo: false,
      nome_empresa: "Lux Motors",
    }),
    loadMarcas: async () => ["Honda"],
    loadPrecosDisponiveis: async () => [250_000, 450_000],
    loadVeiculosByMarca: async () => [],
    loadVeiculosByFaixa: async () => [],
    loadVeiculoById: async () => null,
    sendText: noop,
    sendMenu: noop,
    sendButtons: noop,
    sendImage: noop,
    sendImageHeaderButtons: noop,
    sendCarousel: noop,
    encaminharRecado: async () => ({ ok: true }),
    savePending: async () => {},
    getPending: () => ({
      stage: "handoff",
      offset: 0,
      updated_at: new Date().toISOString(),
    }),
    pause: async () => {},
    ...overrides,
  };
}

Deno.test("texto livre com pending ativo não entra na vitrine (Jarvis)", async () => {
  const result = await runVehicleStockShowcaseTurn({
    userText: "posso ir amanhã às 10h?",
    fromNumber: "5521999999999",
    deps: stubDeps(),
  });
  assertEquals(result.handled, false);
});

Deno.test("carrossel: voltar marcas só depois do envio e pausa", async () => {
  const calls: string[] = [];
  const v1 = sampleVehicle("v1");
  const v2 = sampleVehicle("v2");
  v2.id = "v2";
  await runVehicleStockShowcaseTurn({
    userText: "<<INTERACTIVE_ID:veiculo_vitrine:marca:porsche>>",
    fromNumber: "5521999999999",
    forceInteractive: true,
    deps: stubDeps({
      loadMarcas: async () => ["Porsche"],
      loadVeiculosByMarca: async () => [v1, v2],
      sendCarousel: async () => {
        calls.push("carousel");
        return { ok: true };
      },
      pause: async (ms) => {
        calls.push(`pause:${ms}`);
      },
      sendButtons: async () => {
        calls.push("voltar_marcas");
        return { ok: true };
      },
    }),
  });
  assertEquals(calls.indexOf("carousel") < calls.indexOf("pause:1500"), true);
  assertEquals(calls.indexOf("pause:1500") < calls.indexOf("voltar_marcas"), true);
});

Deno.test("detalhe envia galeria, ficha e lista interativa", async () => {
  const calls: string[] = [];
  const vehicle = sampleVehicle("v1");
  await runVehicleStockShowcaseTurn({
    userText: "<<INTERACTIVE_ID:veiculo_vitrine:detalhe:v1>>",
    fromNumber: "5521999999999",
    forceInteractive: true,
    deps: stubDeps({
      loadVeiculoById: async () => vehicle,
      sendImage: async () => {
        calls.push("image");
        return { ok: true };
      },
      sendText: async () => {
        calls.push("ficha");
        return { ok: true };
      },
      sendMenu: async (_body, sections) => {
        calls.push(`menu:${sections[0]?.rows?.length ?? 0}`);
        return { ok: true };
      },
    }),
  });
  assert(calls.filter((c) => c === "image").length >= 2);
  assertEquals(calls.includes("ficha"), true);
  assertEquals(calls.includes("menu:7"), true);
});
