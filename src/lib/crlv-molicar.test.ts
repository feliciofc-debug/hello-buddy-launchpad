/// <reference lib="deno.ns" />
import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  fillOnlyEmptyCrlvValues,
  normalizeCrlvMolicarResponse,
} from "./crlv-molicar.ts";

Deno.test("DOC-1.2 — Molicar completa somente campos vazios do CRLV", () => {
  const result = normalizeCrlvMolicarResponse({
    placa: "ABC1D23",
    vin: "9BWZZZ377VT004251",
    dados: {
      marca: "Marca Molicar",
      modelo: "Modelo Exato",
      versao: "Versão Premium",
      ano_fabricacao: 2023,
      ano_modelo: 2024,
      cor: "Prata",
      combustivel: "flex",
      cilindrada_cc: 1998,
    },
    precos: {
      referencia: 120000,
      b2c: null,
      b2b: 108000,
      c2c: 116000,
      c2b: 104000,
    },
  });
  const merged = fillOnlyEmptyCrlvValues(
    {
      placa: "ABC1D23",
      marca: "Marca conferida",
      modelo: "",
      versao: "",
    },
    result.completion,
  );
  assertEquals(merged.marca, "Marca conferida");
  assertEquals(merged.modelo, "Modelo Exato");
  assertEquals(merged.versao, "Versão Premium");
  assertEquals(merged.chassi, "9BWZZZ377VT004251");
  assertEquals(result.prices.referencia, 120000);
  assertEquals(result.prices.b2c, null);
  assertEquals(result.prices.c2b, 104000);
});
