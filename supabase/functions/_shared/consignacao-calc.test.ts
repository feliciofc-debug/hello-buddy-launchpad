import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcularConsignacao } from "./consignacao-calc.ts";

Deno.test("CONSIG-1 — valor fixo: excedente integral fica com a loja", () => {
  const r = calcularConsignacao({
    preco: 120_000,
    valorGarantidoDono: 105_000,
    pctLojaExcedente: 100,
    pisoLoja: null,
    despesas: [],
    comissaoVendedor: 0,
  });
  assertEquals(r.parteLoja, 15_000);
  assertEquals(r.parteDono, 105_000);
});

Deno.test("CONSIG-1 — comissão percentual respeita piso", () => {
  const r = calcularConsignacao({
    preco: 120_000,
    valorGarantidoDono: 0,
    pctLojaExcedente: 8,
    pisoLoja: 5_000,
    despesas: [],
    comissaoVendedor: 0,
  });
  assertEquals(r.parteLoja, 9_600);
});

Deno.test("CONSIG-1 — híbrido divide metade do excedente", () => {
  const r = calcularConsignacao({
    preco: 120_000,
    valorGarantidoDono: 100_000,
    pctLojaExcedente: 50,
    pisoLoja: null,
    despesas: [],
    comissaoVendedor: 0,
  });
  assertEquals(r.parteLoja, 10_000);
  assertEquals(r.parteDono, 110_000);
});

Deno.test("CONSIG-1 — venda abaixo do garantido exige autorização", () => {
  const r = calcularConsignacao({
    preco: 90_000,
    valorGarantidoDono: 100_000,
    pctLojaExcedente: 100,
    pisoLoja: 0,
    despesas: [],
    comissaoVendedor: 0,
  });
  assertEquals(r.abaixoDoGarantido, true);
});

Deno.test("CONSIG-1 — despesas descontáveis reduzem só o repasse", () => {
  const r = calcularConsignacao({
    preco: 120_000,
    valorGarantidoDono: 100_000,
    pctLojaExcedente: 50,
    pisoLoja: null,
    despesas: [
      { valor: 1_000, descontarDoConsignante: true },
      { valor: 600, descontarDoConsignante: false },
    ],
    comissaoVendedor: 400,
  });
  assertEquals(r.repasseDonoLiquido, 109_000);
  assertEquals(r.lucroLoja, 9_000);
});
