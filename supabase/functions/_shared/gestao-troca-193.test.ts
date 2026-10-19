import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { calcIndicioColisao } from "./gestao-troca-indicio-colisao.ts";
import { calcResumoPorAreaRegra } from "./gestao-troca-consolidacao-regra.ts";
import {
  applyGestaoTrocaIaSlotMergeToFotosJson,
  gestaoTrocaFotoEntryComEtiquetaUsuario,
  gestaoTrocaFotosListaParaIa,
  gestaoTrocaIaFotoAnaliseRowsParaPdf,
} from "./gestao-troca-foto-slot.ts";
import {
  GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR,
  GESTAO_TROCA_FOTO_ETIQUETA_CRLV,
  normalizeGestaoTrocaFotos,
} from "./gestao-troca-fotos.ts";
import { gestaoTrocaIaFiltrarLuzesAlertaPainel } from "./gestao-troca-ia-rules.ts";

Deno.test("A — CRLV persiste após normalize e não entra na IA", () => {
  const saved = gestaoTrocaFotoEntryComEtiquetaUsuario(
    { path: "doc.jpg", etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR },
    GESTAO_TROCA_FOTO_ETIQUETA_CRLV,
  );
  assertEquals(saved.slot_origem, "usuario");
  const norm = normalizeGestaoTrocaFotos([saved]);
  assertEquals(norm[0].etiqueta, GESTAO_TROCA_FOTO_ETIQUETA_CRLV);
  const ia = gestaoTrocaFotosListaParaIa(norm);
  assertEquals(ia.length, 0);
  const pdfRows = gestaoTrocaIaFotoAnaliseRowsParaPdf(
    [{
      indice: 1,
      path: "doc.jpg",
      slot_informado: "a_classificar",
      slot_identificado: "frente",
      qualidade_imagem: "boa",
      motivo_qualidade: "",
      descricao: "doc",
      achados: [],
      nao_da_para_afirmar: [],
    }],
    norm,
  );
  assertEquals(pdfRows.length, 0);
});

Deno.test("B — legado posição vs escolha manual", () => {
  const a = normalizeGestaoTrocaFotos([
    { path: "1", etiqueta: "Lateral esquerda" },
    { path: "2", etiqueta: "Frente" },
    { path: "3", etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_CRLV },
  ]);
  assertEquals(a[0].etiqueta, GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR);
  assertEquals(a[1].etiqueta, GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR);
  assertEquals(a[2].etiqueta, GESTAO_TROCA_FOTO_ETIQUETA_CRLV);

  const b = normalizeGestaoTrocaFotos([{ path: "t", etiqueta: "Traseira" }]);
  assertEquals(b[0].etiqueta, "Traseira");
  assertEquals(b[0].slot, "traseira");
  assertEquals(b[0].slot_origem, "usuario");
});

Deno.test("C — merge pós-IA preserva foto nova no banco", () => {
  const db = [
    { path: "old", etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR },
    { path: "new", etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR },
  ];
  const merged = [
    { path: "old", etiqueta: "Traseira", slot: "traseira", slot_origem: "ia" as const },
  ];
  const out = applyGestaoTrocaIaSlotMergeToFotosJson(db, merged);
  assertEquals(out.length, 2);
  assertEquals(out[0].slot, "traseira");
  assertEquals(out[1].path, "new");
});

Deno.test("D2 — luzes cinto e freio filtradas", () => {
  const l = gestaoTrocaIaFiltrarLuzesAlertaPainel([
    "Cinto de segurança",
    "Check engine",
    "Freio de estacionamento acionado",
  ]);
  assertEquals(l, ["Check engine"]);
});

Deno.test("D3 — resumo recalc sem achado descartado", () => {
  const rows = calcResumoPorAreaRegra({
    fotosNorm: [{ path: "p", etiqueta: "Frente", slot: "frente", slot_origem: "usuario" }],
    fotoRows: [{
      indice: 1,
      path: "p",
      slot_informado: "frente",
      slot_identificado: "frente",
      qualidade_imagem: "boa",
      motivo_qualidade: "",
      descricao: "x",
      achados: [{
        tipo: "amassado",
        local: "capô",
        severidade: "grave",
        confianca: "alta",
        evidencia: "x",
      }],
      nao_da_para_afirmar: [],
    }],
    achadosDescartados: new Set(["f1a1"]),
  });
  assertEquals(rows.find((r) => r.area === "externo")?.condicao, "sem_apontamento");
});

Deno.test("D4 — espessura massa sozinha = fraco", () => {
  const r = calcIndicioColisao([], { capo: 450 }, { original_max: 180, repintura_max: 300 });
  assertEquals(r.dianteira.nivel, "fraco");
});
