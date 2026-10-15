import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatRecadoClienteLine,
  VITRINE_CLIENTE_NOME_PROMPT,
} from "./vehicle-stock-cliente-nome.ts";
import { runVehicleStockShowcaseTurn } from "./vehicle-stock-showcase-turn.ts";
import type { ShowcaseTurnDeps } from "./vehicle-stock-showcase-turn.ts";
import type {
  PendingVitrineEstoque,
  VeiculoVitrineRow,
} from "./vehicle-stock-whatsapp.ts";

Deno.test("formatRecadoClienteLine usa perfil e telefone", () => {
  const line = formatRecadoClienteLine({
    clienteNome: "Maria",
    contactName: "Mari Whats",
    fromNumber: "5521999999999",
  });
  assertStringIncludes(line, "Cliente: Maria");
  assertStringIncludes(line, "perfil: Mari Whats");
  assertStringIncludes(line, "55 21 99999-9999");
});

Deno.test("interesse: pergunta nome uma vez e conclui com recado", async () => {
  const vehicle: VeiculoVitrineRow = {
    id: "v-int",
    marca: "Honda",
    modelo: "Civic",
    versao: null,
    ano_fabricacao: 2020,
    ano_modelo: 2020,
    km: 10000,
    preco: 120000,
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
  let pending: PendingVitrineEstoque | null = null;
  const outbound: string[] = [];
  let recados = 0;
  const noop = async () => ({ ok: true as const, messageId: "x" });
  const deps: ShowcaseTurnDeps = {
    loadTenantFlags: async () => ({
      segmento: "revenda de veículos",
      vitrine_veiculos_demo: false,
      nome_empresa: "Loja X",
    }),
    loadMarcas: async () => [],
    loadPrecosDisponiveis: async () => [],
    loadVeiculosByMarca: async () => [],
    loadVeiculosByFaixa: async () => [],
    loadVeiculoById: async (id) => (id === "v-int" ? vehicle : null),
    sendText: async (text) => {
      outbound.push(text);
      return { ok: true };
    },
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
    userId: "user-test",
    fetchViaCep: async () => null,
    saveFinanciamentoFicha: async () => ({ id: "ficha-1" }),
  };

  const interesseId =
    "<<INTERACTIVE_ID:veiculo_vitrine:interesse:v-int>>";
  const first = await runVehicleStockShowcaseTurn({
    userText: interesseId,
    fromNumber: "5521888888888",
    contactName: "Perfil WA",
    forceInteractive: true,
    deps,
  });
  assertEquals(first.handled, true);
  assertEquals(first.replyPreview, "cliente_nome_prompt");
  assertEquals(outbound.length, 1);
  assertEquals(outbound[0], VITRINE_CLIENTE_NOME_PROMPT);
  assertEquals(recados, 0);
  assert(pending?.form?.flow === "cliente_nome");

  const second = await runVehicleStockShowcaseTurn({
    userText: "Carlos",
    fromNumber: "5521888888888",
    contactName: "Perfil WA",
    allowEarlyFormCapture: true,
    deps,
  });
  assertEquals(second.handled, true);
  assertEquals(second.replyPreview, "interesse");
  assertEquals(recados, 1);
  assertEquals(outbound.length, 2);
  assert(outbound[1].includes("Loja X"));
  assertEquals(pending?.cliente_nome, "Carlos");

  const third = await runVehicleStockShowcaseTurn({
    userText: interesseId,
    fromNumber: "5521888888888",
    contactName: "Perfil WA",
    forceInteractive: true,
    deps,
  });
  assertEquals(third.replyPreview, "interesse");
  assertEquals(recados, 1);
  assertEquals(outbound.length, 3);
  assertEquals(
    outbound.filter((m) => m === VITRINE_CLIENTE_NOME_PROMPT).length,
    1,
  );
});

Deno.test("interesse: resposta vazia usa contactName no recado", async () => {
  const vehicle: VeiculoVitrineRow = {
    id: "v-fb",
    marca: "VW",
    modelo: "Golf",
    versao: null,
    ano_fabricacao: 2019,
    ano_modelo: 2019,
    km: 50000,
    preco: 95000,
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
  let pending: PendingVitrineEstoque | null = null;
  let lastRecado = "";
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
    loadVeiculoById: async (id) => (id === "v-fb" ? vehicle : null),
    sendText: noop,
    sendMenu: noop,
    sendButtons: noop,
    sendImage: noop,
    sendImageHeaderButtons: noop,
    sendCarousel: noop,
    encaminharRecado: async (r) => {
      lastRecado = r;
      return { ok: true };
    },
    savePending: async (p) => {
      pending = p;
    },
    getPending: () => pending,
    pause: async () => {},
    userId: "user-test",
    fetchViaCep: async () => null,
    saveFinanciamentoFicha: async () => ({ id: "ficha-1" }),
  };

  await runVehicleStockShowcaseTurn({
    userText: "<<INTERACTIVE_ID:veiculo_vitrine:interesse:v-fb>>",
    fromNumber: "5521777777777",
    contactName: "João Perfil",
    forceInteractive: true,
    deps,
  });
  await runVehicleStockShowcaseTurn({
    userText: "   ",
    fromNumber: "5521777777777",
    contactName: "João Perfil",
    allowEarlyFormCapture: true,
    deps,
  });
  assertStringIncludes(lastRecado, "Cliente: João Perfil");
  assertStringIncludes(lastRecado, "perfil: João Perfil");
});
