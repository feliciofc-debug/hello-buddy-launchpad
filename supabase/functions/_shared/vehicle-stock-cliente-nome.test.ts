import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  formatRecadoClienteLine,
  parseOptionalClienteNome,
  VITRINE_CLIENTE_NOME_OPCIONAL_PROMPT,
} from "./vehicle-stock-cliente-nome.ts";
import { runVehicleStockShowcaseTurn } from "./vehicle-stock-showcase-turn.ts";
import type { ShowcaseTurnDeps } from "./vehicle-stock-showcase-turn.ts";
import type {
  PendingVitrineEstoque,
  VeiculoVitrineRow,
} from "./vehicle-stock-whatsapp.ts";

Deno.test("parseOptionalClienteNome rejeita frases e aceita nomes", () => {
  assertEquals(parseOptionalClienteNome("obrigado"), null);
  assertEquals(parseOptionalClienteNome("qual o preço?"), null);
  assertEquals(parseOptionalClienteNome("ok"), null);
  assertEquals(parseOptionalClienteNome("quero ver mais"), null);
  assertEquals(parseOptionalClienteNome("tem outro?"), null);
  assertEquals(parseOptionalClienteNome("quero financiar"), null);
  assertEquals(parseOptionalClienteNome("pode ser sábado"), null);
  assertEquals(parseOptionalClienteNome("ok obrigado"), null);
  assertEquals(parseOptionalClienteNome("Carlos"), "Carlos");
  assertEquals(parseOptionalClienteNome("Ana Paula"), "Ana Paula");
  assertEquals(parseOptionalClienteNome("meu nome é Ana Paula"), "Ana Paula");
  assertEquals(parseOptionalClienteNome("me chamo joão"), "joão");
  assertEquals(parseOptionalClienteNome("sou o Fred"), "Fred");
});

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

function interesseDeps(): {
  deps: ShowcaseTurnDeps;
  vehicle: VeiculoVitrineRow;
  getPending: () => PendingVitrineEstoque | null;
  recados: () => number;
  outbound: () => string[];
} {
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
  const messages: string[] = [];
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
      messages.push(text);
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
  return {
    deps,
    vehicle,
    getPending: () => pending,
    recados: () => recados,
    outbound: () => messages,
  };
}

Deno.test("P1.2 interesse: recado antes do nome opcional", async () => {
  const { deps, recados, outbound } = interesseDeps();
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
  assertEquals(first.replyPreview, "cliente_nome_opcional_prompt");
  assertEquals(recados(), 1);
  assertEquals(outbound().length, 2);
  assert(outbound()[0].includes("Loja X"));
  assertEquals(outbound()[1], VITRINE_CLIENTE_NOME_OPCIONAL_PROMPT);
});

Deno.test("P1.2 obrigado após confirmação não salva nome nem reencaminha", async () => {
  const { deps, recados, outbound, getPending } = interesseDeps();
  const interesseId =
    "<<INTERACTIVE_ID:veiculo_vitrine:interesse:v-int>>";
  await runVehicleStockShowcaseTurn({
    userText: interesseId,
    fromNumber: "5521888888888",
    contactName: "Perfil WA",
    forceInteractive: true,
    deps,
  });
  const after = await runVehicleStockShowcaseTurn({
    userText: "obrigado",
    fromNumber: "5521888888888",
    contactName: "Perfil WA",
    allowEarlyFormCapture: true,
    deps,
  });
  assertEquals(after.handled, false);
  assertEquals(recados(), 1);
  assertEquals(getPending()?.cliente_nome ?? null, null);
  assertEquals(
    outbound().filter((m) => m === VITRINE_CLIENTE_NOME_OPCIONAL_PROMPT).length,
    1,
  );
});

Deno.test("P1.2 qual o preço após confirmação não salva nome", async () => {
  const { deps, recados, getPending } = interesseDeps();
  await runVehicleStockShowcaseTurn({
    userText: "<<INTERACTIVE_ID:veiculo_vitrine:interesse:v-int>>",
    fromNumber: "5521888888888",
    contactName: "Perfil WA",
    forceInteractive: true,
    deps,
  });
  const after = await runVehicleStockShowcaseTurn({
    userText: "qual o preço?",
    fromNumber: "5521888888888",
    contactName: "Perfil WA",
    allowEarlyFormCapture: true,
    deps,
  });
  assertEquals(after.handled, false);
  assertEquals(recados(), 1);
  assertEquals(getPending()?.cliente_nome ?? null, null);
});

Deno.test("P1.2 nome válido opcional é salvo sem segundo recado", async () => {
  const { deps, recados, getPending } = interesseDeps();
  await runVehicleStockShowcaseTurn({
    userText: "<<INTERACTIVE_ID:veiculo_vitrine:interesse:v-int>>",
    fromNumber: "5521888888888",
    contactName: "Perfil WA",
    forceInteractive: true,
    deps,
  });
  const second = await runVehicleStockShowcaseTurn({
    userText: "Carlos",
    fromNumber: "5521888888888",
    contactName: "Perfil WA",
    allowEarlyFormCapture: true,
    deps,
  });
  assertEquals(second.handled, true);
  assertEquals(second.replyPreview, "cliente_nome_opcional_salvo");
  assertEquals(recados(), 1);
  assertEquals(getPending()?.cliente_nome, "Carlos");
});
