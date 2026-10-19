import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  GESTAO_TROCA_IA_DESCRICAO_AREAS,
  validateGestaoTrocaIaDescricaoAreas,
} from "./gestao-troca-ia-descricao-schema.ts";

const INTERNO = new Set([
  "painel",
  "bancos",
  "volante_console",
  "forro_carpete",
  "outro",
]);

function stubTodasAreas(condicao = "nao_fotografado", fotos: number[] = []) {
  return GESTAO_TROCA_IA_DESCRICAO_AREAS.map((area) => ({
    secao: INTERNO.has(area) ? "interno" : "externo",
    area,
    condicao,
    texto: condicao === "nao_fotografado" ? "não fotografado" : "ok",
    fotos: condicao === "nao_fotografado" ? [] : fotos,
  }));
}

Deno.test("nao_fotografado exige fotos vazias", () => {
  const rows = stubTodasAreas("nao_fotografado");
  rows[0] = { ...rows[0], fotos: [1] };
  const r = validateGestaoTrocaIaDescricaoAreas(rows, 5);
  assertEquals(r.ok, false);
});

Deno.test("demais condições exigem foto válida", () => {
  const rows = stubTodasAreas("sem_alteracao_visivel", [1]);
  rows[1] = { ...rows[1], fotos: [] };
  const r = validateGestaoTrocaIaDescricaoAreas(rows, 3);
  assertEquals(r.ok, false);
});
