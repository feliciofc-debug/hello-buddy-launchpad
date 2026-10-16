import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  classifyOwnerStockIntent,
  ownerStockMentionsFipe,
  shouldDeferOwnerStockShortcut,
} from "./vehicle-stock-owner-inbound.ts";

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
