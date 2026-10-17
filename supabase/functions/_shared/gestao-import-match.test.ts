import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { matchGestaoImportRow } from "./gestao-import-match.ts";

const vehicles = [
  {
    id: "a",
    placa: "ABC1D23",
    codigo_origem: "C001",
    marca: "Fiat",
    modelo: "Argo",
    ano_modelo: 2022,
    ano_fabricacao: 2022,
  },
  {
    id: "b",
    placa: "XYZ9Z99",
    codigo_origem: null,
    marca: "VW",
    modelo: "Polo",
    ano_modelo: 2020,
    ano_fabricacao: 2020,
  },
];

Deno.test("import match prioriza placa", () => {
  const hit = matchGestaoImportRow(
    { placa: "ABC-1D23", codigo: "C001", marca: "Fiat", modelo: "Argo" },
    vehicles,
  );
  assertEquals(hit?.id, "a");
});

Deno.test("import match codigo quando placa ausente", () => {
  const hit = matchGestaoImportRow(
    { codigo: "C001", marca: "Fiat", modelo: "Argo" },
    vehicles,
  );
  assertEquals(hit?.id, "a");
});

Deno.test("import match marca modelo ano", () => {
  const hit = matchGestaoImportRow(
    { marca: "VW", modelo: "Polo", ano: 2020 },
    vehicles,
  );
  assertEquals(hit?.id, "b");
});
