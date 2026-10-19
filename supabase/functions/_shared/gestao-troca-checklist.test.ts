import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  emptyGestaoTrocaChecklist,
  somaPreparacaoChecklist,
} from "./gestao-troca-checklist.ts";

Deno.test("checklist soma preparação de itens regular/ruim", () => {
  const c = emptyGestaoTrocaChecklist();
  c.pintura = { condicao: "ruim", reparo: "pintura", valor_estimado: 1500 };
  c.pneus = { condicao: "regular", reparo: "troca", valor_estimado: 800 };
  c.lataria = { condicao: "bom" };
  assertEquals(somaPreparacaoChecklist(c), 2300);
});
