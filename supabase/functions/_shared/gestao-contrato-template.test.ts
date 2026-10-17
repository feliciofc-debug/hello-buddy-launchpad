import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  defaultGestaoContratoModelos,
  renderGestaoContratoCorpo,
} from "./gestao-contrato-template.ts";

Deno.test("render substitui variáveis do contrato", () => {
  const text = renderGestaoContratoCorpo("Veículo {veiculo} por {valor}", {
    veiculo: "HB20",
    valor: "R$ 50.000,00",
  });
  assertEquals(text, "Veículo HB20 por R$ 50.000,00");
});

Deno.test("modelos exemplo um de cada tipo", () => {
  const m = defaultGestaoContratoModelos();
  assertEquals(m.length, 4);
  assertEquals(m.every((x) => x.is_exemplo), true);
});
