/**
 * Caminhos 1–7 (P1.2): confirmação ao cliente + recado ao dono na mesma interação,
 * nome opcional só depois (sem bloquear).
 */
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { runVehicleStockShowcaseTurn } from "./vehicle-stock-showcase-turn.ts";
import type { ShowcaseTurnDeps } from "./vehicle-stock-showcase-turn.ts";
import type {
  PendingVitrineEstoque,
  VeiculoVitrineRow,
} from "./vehicle-stock-whatsapp.ts";
import { vitrineButtonId } from "./vehicle-stock-whatsapp.ts";

function baseVehicle(id: string): VeiculoVitrineRow {
  return {
    id,
    marca: "VW",
    modelo: "Golf",
    versao: null,
    ano_fabricacao: 2019,
    ano_modelo: 2019,
    km: 40000,
    preco: 90000,
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
}

function makeHarness(vehicleId: string) {
  let pending: PendingVitrineEstoque | null = null;
  let recados = 0;
  const noop = async () => ({ ok: true as const, messageId: "m" });
  const deps: ShowcaseTurnDeps = {
    loadTenantFlags: async () => ({
      segmento: "revenda de veículos",
      vitrine_veiculos_demo: false,
      nome_empresa: "AutoTest",
    }),
    loadMarcas: async () => ["VW"],
    loadPrecosDisponiveis: async () => [90000],
    loadVeiculosByMarca: async () => [baseVehicle(vehicleId)],
    loadVeiculosByFaixa: async () => [],
    loadSegmentoCounts: async () => ({ carros: 1, motos: 0 }),
    loadEstilosMoto: async () => [],
    loadPrecosMotosDisponiveis: async () => [],
    loadVeiculosByEstilo: async () => [],
    loadVeiculosByFaixaMoto: async () => [],
    loadVeiculoById: async (id) => (id === vehicleId ? baseVehicle(vehicleId) : null),
    sendText: noop,
    sendMenu: noop,
    sendButtons: noop,
    sendImage: noop,
    sendImageHeaderButtons: noop,
    sendCarousel: noop,
    encaminharRecado: async () => {
      recados += 1;
      return { ok: true };
    },
    savePending: async (p) => {
      pending = p;
    },
    getPending: () => pending,
    pause: async () => {},
    userId: "u-path",
    fetchViaCep: async () => null,
    saveFinanciamentoFicha: async () => ({ id: "f1" }),
  };
  return { deps, recados: () => recados };
}

const PATHS: Array<{
  n: number;
  label: string;
  run: (h: ReturnType<typeof makeHarness>) => Promise<string | undefined>;
  expectRecados: number;
  expectPreview: string;
}> = [
  {
    n: 1,
    label: "Interesse",
    run: async ({ deps }) => {
      const r = await runVehicleStockShowcaseTurn({
        userText: `<<INTERACTIVE_ID:veiculo_vitrine:interesse:v-path>>`,
        fromNumber: "5521000000001",
        forceInteractive: true,
        deps,
      });
      return r.replyPreview;
    },
    expectRecados: 1,
    expectPreview: "cliente_nome_opcional_prompt",
  },
  {
    n: 2,
    label: "Consultor no veículo",
    run: async ({ deps }) => {
      const r = await runVehicleStockShowcaseTurn({
        userText: `<<INTERACTIVE_ID:veiculo_vitrine:consultor:v-path>>`,
        fromNumber: "5521000000002",
        forceInteractive: true,
        deps,
      });
      return r.replyPreview;
    },
    expectRecados: 1,
    expectPreview: "cliente_nome_opcional_prompt",
  },
  {
    n: 3,
    label: "Consultor geral (menu vitrine)",
    run: async ({ deps }) => {
      const r = await runVehicleStockShowcaseTurn({
        userText: "<<INTERACTIVE_ID:veiculo_vitrine:consultor>>",
        fromNumber: "5521000000003",
        forceInteractive: true,
        deps,
      });
      return r.replyPreview;
    },
    expectRecados: 1,
    expectPreview: "cliente_nome_opcional_prompt",
  },
  {
    n: 4,
    label: "Visita (turno confirmado)",
    run: async (h) => {
      const iso = "2026-10-20";
      const turnoId = vitrineButtonId("visita_turno", `${iso}:tarde`);
      let pending: PendingVitrineEstoque = {
        stage: "detalhe",
        offset: 0,
        updated_at: new Date().toISOString(),
        form: {
          flow: "visita",
          step: "turno",
          veiculo_id: "v-path",
          dia_iso: iso,
          updated_at: new Date().toISOString(),
        },
      };
      const deps: ShowcaseTurnDeps = {
        ...h.deps,
        getPending: () => pending,
        savePending: async (p) => {
          if (p) pending = p;
        },
      };
      const r = await runVehicleStockShowcaseTurn({
        userText: `<<INTERACTIVE_ID:${turnoId}>>`,
        fromNumber: "5521000000004",
        forceInteractive: true,
        deps,
      });
      return r.replyPreview;
    },
    expectRecados: 1,
    expectPreview: "cliente_nome_opcional_prompt",
  },
  {
    n: 5,
    label: "Troca (início do fluxo)",
    run: async ({ deps }) => {
      const r = await runVehicleStockShowcaseTurn({
        userText: "<<INTERACTIVE_ID:veiculo_vitrine:acao:troca:v-path>>",
        fromNumber: "5521000000005",
        forceInteractive: true,
        deps,
      });
      return r.replyPreview;
    },
    expectRecados: 0,
    expectPreview: "troca_modelo_ano",
  },
  {
    n: 6,
    label: "Financiamento inicia (sem recado ainda)",
    run: async ({ deps }) => {
      const r = await runVehicleStockShowcaseTurn({
        userText: "<<INTERACTIVE_ID:veiculo_vitrine:acao:financiamento:v-path>>",
        fromNumber: "5521000000006",
        forceInteractive: true,
        deps,
      });
      return r.replyPreview;
    },
    expectRecados: 0,
    expectPreview: "financiamento_modo",
  },
  {
    n: 7,
    label: "Ver detalhes (exploração, sem handoff)",
    run: async ({ deps }) => {
      const r = await runVehicleStockShowcaseTurn({
        userText: "<<INTERACTIVE_ID:veiculo_vitrine:detalhe:v-path>>",
        fromNumber: "5521000000007",
        forceInteractive: true,
        deps,
      });
      return r.replyPreview;
    },
    expectRecados: 0,
    expectPreview: "detalhe",
  },
];

for (const path of PATHS) {
  Deno.test(`caminho ${path.n} — ${path.label}`, async () => {
    const h = makeHarness("v-path");
    const preview = await path.run(h);
    assertEquals(preview, path.expectPreview);
    assertEquals(h.recados(), path.expectRecados);
  });
}
