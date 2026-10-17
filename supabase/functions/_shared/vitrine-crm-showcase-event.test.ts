import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runVehicleStockShowcaseTurn } from "./vehicle-stock-showcase-turn.ts";
import type { ShowcaseTurnDeps } from "./vehicle-stock-showcase-turn.ts";
import type { VeiculoVitrineRow } from "./vehicle-stock-whatsapp.ts";
import type { VitrineEvento } from "./vitrine-eventos.ts";

Deno.test("detalhe chama trackVitrineCrmEvent para cliente", async () => {
  const logged: Array<{ e: VitrineEvento; id: string | null }> = [];
  const vehicle: VeiculoVitrineRow = {
    id: "v-crm",
    marca: "Audi",
    modelo: "A3",
    versao: null,
    ano_fabricacao: 2021,
    ano_modelo: 2021,
    km: 20000,
    preco: 150000,
    cor: null,
    cambio: null,
    combustivel: null,
    portas: null,
    blindado: false,
    nivel_blindagem: null,
    opcionais: null,
    caracteristicas: null,
    descricao: null,
    fotos: ["https://example.com/1.jpg"],
    status: "disponivel",
  };
  const noop = async () => ({ ok: true as const, messageId: "x" });
  const deps: ShowcaseTurnDeps = {
    loadTenantFlags: async () => ({
      segmento: "revenda de veículos",
      vitrine_veiculos_demo: false,
      nome_empresa: "Loja",
    }),
    loadMarcas: async () => [],
    loadPrecosDisponiveis: async () => [],
    loadVeiculosByMarca: async () => [],
    loadVeiculosByFaixa: async () => [],
    loadVeiculoById: async (id) => (id === "v-crm" ? vehicle : null),
    sendText: noop,
    sendMenu: noop,
    sendButtons: noop,
    sendImage: noop,
    sendImageHeaderButtons: noop,
    sendCarousel: noop,
    encaminharRecado: async () => ({ ok: true }),
    savePending: async () => {},
    getPending: () => null,
    pause: async () => {},
    userId: "u1",
    fetchViaCep: async () => null,
    saveFinanciamentoFicha: async () => ({ id: "f1" }),
    trackVitrineCrmEvent: (e, id) => {
      logged.push({ e, id: id ?? null });
    },
  };
  await runVehicleStockShowcaseTurn({
    userText: "<<INTERACTIVE_ID:veiculo_vitrine:detalhe:v-crm>>",
    fromNumber: "5521888888888",
    forceInteractive: true,
    deps,
  });
  assertEquals(logged.some((x) => x.e === "detalhe" && x.id === "v-crm"), true);
});
