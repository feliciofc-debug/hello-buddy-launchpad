import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runVehicleStockShowcaseTurn } from "./vehicle-stock-showcase-turn.ts";
import type { ShowcaseTurnDeps } from "./vehicle-stock-showcase-turn.ts";

function stubDeps(overrides: Partial<ShowcaseTurnDeps> = {}): ShowcaseTurnDeps {
  const noop = async () => ({ ok: true as const, messageId: "x" });
  return {
    loadTenantFlags: async () => ({
      segmento: "revenda de veículos",
      vitrine_veiculos_demo: false,
    }),
    loadMarcas: async () => ["Honda"],
    loadVeiculosByMarca: async () => [],
    loadVeiculoById: async () => null,
    sendText: noop,
    sendList: noop,
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
