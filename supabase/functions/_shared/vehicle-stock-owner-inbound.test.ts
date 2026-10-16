import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyOwnerStockIntent,
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
