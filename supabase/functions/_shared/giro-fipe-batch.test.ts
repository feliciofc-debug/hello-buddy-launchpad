import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  selecionarLotePendentesFipe,
  simularRodadasFipeRefresh,
} from "./giro-fipe-batch.ts";

Deno.test("G90-1.2 — lote com 25 carros e 20 falhas consulta os 25", () => {
  const ids = Array.from({ length: 25 }, (_, i) =>
    `00000000-0000-4000-8000-${String(i + 1).padStart(12, "0")}`
  );
  const falha = new Set(ids.slice(0, 20));
  const r = simularRodadasFipeRefresh({
    veiculoIds: ids,
    refs: [],
    competenciaAtual: "2026-10",
    limit: 20,
    falhaPorVeiculo: (id) => falha.has(id),
  });
  assertEquals(r.tentados.length, 25);
  assertEquals(r.gravados.length, 5);
  assertEquals(r.falhas.length, 20);
  assertEquals(r.rodadas, 2);
});

Deno.test("G90-1.2 — skip_ids libera próximo lote estável por id", () => {
  const ids = ["b-id", "a-id", "c-id"];
  const first = selecionarLotePendentesFipe({
    veiculoIds: ids,
    refs: [],
    competenciaAtual: "2026-10",
    limit: 2,
  });
  assertEquals(first.lote, ["a-id", "b-id"]);
  const second = selecionarLotePendentesFipe({
    veiculoIds: ids,
    refs: [],
    competenciaAtual: "2026-10",
    skipIds: first.lote,
    limit: 2,
  });
  assertEquals(second.lote, ["c-id"]);
});
