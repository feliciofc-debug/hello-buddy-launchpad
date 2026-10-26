import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { gestaoTrocaResolveFotoSlot } from "./gestao-troca-roteiro.ts";
import type { GestaoTrocaFotoEntry } from "./gestao-troca-fotos.ts";

function simUpload(fotos: GestaoTrocaFotoEntry[], slot: string, path: string): GestaoTrocaFotoEntry[] {
  const rest = fotos.filter((f) => gestaoTrocaResolveFotoSlot(f) !== slot);
  return [...rest, { path, etiqueta: "Outra", slot, slot_origem: "usuario" as const }];
}

Deno.test("roteiro — 6 slots distintos preservados", () => {
  let fotos: GestaoTrocaFotoEntry[] = [];
  const slots = ["diag_diant_esq", "diag_diant_dir", "pneu_de", "pneu_dd", "pneu_te", "pneu_td"];
  for (const s of slots) {
    fotos = simUpload(fotos, s, `path-${s}`);
  }
  assertEquals(fotos.length, 6);
  for (const s of slots) {
    assertEquals(gestaoTrocaResolveFotoSlot(fotos.find((f) => f.path === `path-${s}`)!), s);
  }
});

Deno.test("DOC-1.1b — slot CRLV usa somente o cofre e abre conferência", async () => {
  const roteiro = await Deno.readTextFile(
    new URL(
      "../../../src/components/gestao/trocas/GestaoTrocaRoteiroFotos.tsx",
      import.meta.url,
    ),
  );
  const start = roteiro.indexOf("const uploadCrlv");
  const end = roteiro.indexOf("\n  return (", start);
  const handler = roteiro.slice(start, end);
  assert(start >= 0 && end > start);
  assertStringIncludes(handler, '"gestao-cofre"');
  assertStringIncludes(handler, 'origem: "troca"');
  assertStringIncludes(handler, "troca_id: trocaId");
  assertEquals(handler.includes('.storage.from("trocas")'), false);
  assertStringIncludes(roteiro, "Guardado no cofre ✓");
  assertStringIncludes(roteiro, "<GestaoCrlvConferencia");

  const galeria = await Deno.readTextFile(
    new URL(
      "../../../src/components/gestao/trocas/GestaoTrocaFotoGaleria.tsx",
      import.meta.url,
    ),
  );
  assertStringIncludes(
    galeria,
    "etiqueta !== GESTAO_TROCA_FOTO_ETIQUETA_CRLV",
  );
});
