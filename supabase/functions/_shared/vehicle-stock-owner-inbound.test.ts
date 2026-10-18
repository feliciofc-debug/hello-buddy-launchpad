import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyOwnerStockIntent,
  formatOwnerStockSummary,
  formatOwnerVendidosCount,
  formatOwnerVendidosMesFromSnapshot,
  hasExplicitOwnerStockSearchContext,
  ownerStockBlockedByActionVerb,
  ownerStockMentionsFipe,
  rankOwnerStockMatches,
  shouldDeferOwnerStockShortcut,
} from "./vehicle-stock-owner-inbound.ts";
import type { VeiculoVitrineRow } from "./vehicle-stock-whatsapp.ts";

const FLAGS = {
  segmento: "revenda-veiculos-premium",
  vitrine_veiculos_demo: false,
};

Deno.test("não intercepta quando menciona FIPE", () => {
  assert(ownerStockMentionsFipe("qual a fipe do civic?"));
  assert(
    shouldDeferOwnerStockShortcut({
      userText: "fipe do carro",
      hasInboundMedia: false,
      agentState: {},
    }),
  );
});

Deno.test("classifica resumo e vendidos", () => {
  assertEquals(
    classifyOwnerStockIntent("quais carros tenho?", FLAGS),
    "resumo",
  );
  assertEquals(classifyOwnerStockIntent("quantos vendi?", FLAGS), "vendidos");
});

Deno.test("classifica vitrine do dono", () => {
  assertEquals(
    classifyOwnerStockIntent("me mostra a vitrine", FLAGS),
    "vitrine",
  );
});

Deno.test("conta produto — intent none para meu estoque sem gate no handler", () => {
  assertEquals(
    classifyOwnerStockIntent("meu estoque", {
      segmento: "restaurante",
      vitrine_veiculos_demo: false,
    }),
    "resumo",
  );
});

Deno.test("vitrine demo / royal não vira busca por modelo solto", () => {
  const demoFlags = {
    segmento: "revenda-veiculos-premium",
    vitrine_veiculos_demo: true,
  };
  assertEquals(classifyOwnerStockIntent("expo royal", demoFlags), "none");
  assertEquals(classifyOwnerStockIntent("cria post do civic", demoFlags), "none");
  assert(ownerStockBlockedByActionVerb("gera anuncio do estoque"));
});

Deno.test("busca exige contexto explícito de estoque", () => {
  assert(hasExplicitOwnerStockSearchContext("tenho algum civic disponivel"));
  assertEquals(classifyOwnerStockIntent("civic", FLAGS), "none");
});

Deno.test("rankOwnerStockMatches vazio quando tokens não batem", () => {
  const rows: VeiculoVitrineRow[] = [{
    id: "1",
    marca: "Honda",
    modelo: "Fit",
    versao: null,
    ano_fabricacao: 2020,
    ano_modelo: 2020,
    km: 1,
    preco: 80000,
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
  }];
  assertEquals(rankOwnerStockMatches("zzzz inexistente", rows).length, 0);
});

const BASE_ROW: VeiculoVitrineRow = {
  id: "1",
  marca: "Toyota",
  modelo: "Corolla",
  versao: "XEi",
  ano_fabricacao: 2022,
  ano_modelo: 2022,
  km: 12000,
  preco: 149_900,
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

Deno.test("resumo estoque lista preços, total e marcas", () => {
  const nowMs = Date.parse("2026-10-18T12:00:00-03:00");
  const text = formatOwnerStockSummary([
    { ...BASE_ROW, created_at: "2026-10-06T12:00:00Z" },
    {
      ...BASE_ROW,
      id: "2",
      marca: "MINI",
      modelo: "Cooper",
      preco: 220_000,
      created_at: "2026-09-01T12:00:00Z",
    },
  ], "Estoque", nowMs);
  assert(text.includes("Valor total anunciado"));
  assert(text.includes("149.900") || text.includes("R$ 149.900"));
  assert(text.includes("Marcas:"));
  assert(text.includes("MINI"));
  assertEquals(
    classifyOwnerStockIntent(
      "quantos carros tenho no estoque, qual o valor do estoque, marcas e modelos?",
      FLAGS,
    ),
    "resumo",
  );
  assertEquals(
    classifyOwnerStockIntent(
      "preço de cada carro e qual o valor total do meu estoque?",
      FLAGS,
    ),
    "resumo",
  );
});

Deno.test("1 carro disponível no singular", () => {
  const text = formatOwnerStockSummary([{ ...BASE_ROW }], "Estoque");
  assert(text.includes("1 carro disponível"));
  assert(!text.includes("1 carros"));
});

Deno.test("vendidos — gatilhos e snapshot format", () => {
  assertEquals(classifyOwnerStockIntent("carros vendidos", FLAGS), "vendidos");
  assertEquals(classifyOwnerStockIntent("o que vendemos", FLAGS), "vendidos");
  assertEquals(classifyOwnerStockIntent("quais carros foram vendidos", FLAGS), "vendidos");
  const snapText = formatOwnerVendidosMesFromSnapshot({
    periodo: { competencia: "2026-10", label: "outubro" },
    vendas: {
      lista: [{
        veiculo: "BMW X6",
        valor_venda: 1_100_000,
        data: "2026-10-17",
        vendedor: "João Pedro",
      }],
      totais: { qtd: 1, faturamento: 1_100_000 },
    },
  }, "18/10");
  assert(snapText.includes("Vendidos"));
  assert(snapText.includes("1 carro"));
  assert(snapText.includes("João Pedro"));
});

Deno.test("vendidos não autorizado — contagem", () => {
  assert(formatOwnerVendidosCount(2).includes("2 veículo"));
});

Deno.test("defer gestão — carro parado e lucro", () => {
  assert(
    shouldDeferOwnerStockShortcut({
      userText: "qual carro está parado há mais tempo?",
      hasInboundMedia: false,
      agentState: {},
      gestaoAuthorized: true,
    }),
  );
  assert(
    shouldDeferOwnerStockShortcut({
      userText: "qual o lucro do civic?",
      hasInboundMedia: false,
      agentState: {},
      gestaoAuthorized: true,
    }),
  );
  assert(
    !shouldDeferOwnerStockShortcut({
      userText: "qual carro está parado há mais tempo?",
      hasInboundMedia: false,
      agentState: {},
      gestaoAuthorized: false,
    }),
  );
});
