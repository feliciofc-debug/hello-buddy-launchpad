import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR,
  GESTAO_TROCA_FOTO_ETIQUETA_CRLV,
  normalizeGestaoTrocaFotos,
} from "./gestao-troca-fotos.ts";
import {
  gestaoTrocaAvisoFotoTrocadaParaRow,
  gestaoTrocaAvisoFotoMarcadaErrada,
  mergeGestaoTrocaIaSlotsIntoFotos,
  normalizeGestaoTrocaSlotToken,
  parseGestaoTrocaIaSlotIdentificado,
} from "./gestao-troca-foto-slot.ts";

Deno.test("galeria — 12 uploads ficam a classificar, nenhum CRLV", () => {
  const raw = Array.from({ length: 12 }, (_, i) => ({
    path: `p/${i}.jpg`,
    etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR,
  }));
  const f = normalizeGestaoTrocaFotos(raw);
  assertEquals(f.length, 12);
  assertEquals(f.every((x) => x.etiqueta === GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR), true);
  assertEquals(f.some((x) => x.etiqueta === GESTAO_TROCA_FOTO_ETIQUETA_CRLV), false);
});

Deno.test("IA preenche traseira na 5ª foto sem aviso de troca", () => {
  const fotos = Array.from({ length: 5 }, (_, i) => ({
    path: `p/${i}.jpg`,
    etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_A_CLASSIFICAR,
  }));
  const rows = [{
    indice: 5,
    path: "p/4.jpg",
    slot_informado: "a_classificar",
    slot_identificado: "traseira",
    qualidade_imagem: "boa" as const,
    motivo_qualidade: "",
    descricao: "Traseira do veículo.",
    achados: [],
    nao_da_para_afirmar: [],
  }];
  const merged = mergeGestaoTrocaIaSlotsIntoFotos(fotos, rows);
  assertEquals(merged[4].slot, "traseira");
  assertEquals(merged[4].slot_origem, "ia");
  const aviso = gestaoTrocaAvisoFotoTrocadaParaRow({ fotoEntry: merged[4], row: rows[0] });
  assertEquals(aviso, null);
});

Deno.test("parser slot — ids válidos e normalização", () => {
  assertEquals(parseGestaoTrocaIaSlotIdentificado("Frente"), "frente");
  assertEquals(parseGestaoTrocaIaSlotIdentificado("Lateral Esq"), "lateral_esq");
  assertEquals(normalizeGestaoTrocaSlotToken("  Diag Diant Dir  "), "diag_diant_dir");
});

Deno.test("parser slot — sinônimos painel", () => {
  assertEquals(parseGestaoTrocaIaSlotIdentificado("painel"), "painel_ligado");
  assertEquals(parseGestaoTrocaIaSlotIdentificado("painel_instrumentos"), "painel_ligado");
  assertEquals(parseGestaoTrocaIaSlotIdentificado("odometro"), "painel_ligado");
  assertEquals(parseGestaoTrocaIaSlotIdentificado("Odômetro"), "painel_ligado");
});

Deno.test("parser slot — lixo vira null", () => {
  assertEquals(parseGestaoTrocaIaSlotIdentificado("selfie"), null);
  assertEquals(parseGestaoTrocaIaSlotIdentificado(""), null);
  assertEquals(parseGestaoTrocaIaSlotIdentificado(null), null);
});

Deno.test("aviso só quando usuário marcou errado", () => {
  const entry = {
    path: "x",
    etiqueta: "Bancos dianteiros",
    slot: "bancos_dianteiros",
    slot_origem: "usuario" as const,
  };
  const row = {
    indice: 1,
    path: "x",
    slot_informado: "bancos_dianteiros",
    slot_identificado: "traseira",
    qualidade_imagem: "boa" as const,
    motivo_qualidade: "",
    descricao: "Lanternas traseiras.",
    achados: [],
    nao_da_para_afirmar: [],
  };
  assertEquals(
    gestaoTrocaAvisoFotoMarcadaErrada("bancos_dianteiros", "traseira"),
    "⚠️ Foto marcada como «Bancos dianteiros», mas mostra «Traseira». Reenvie no lugar certo.",
  );
  const aviso = gestaoTrocaAvisoFotoTrocadaParaRow({ fotoEntry: entry, row });
  assertEquals(aviso?.includes("«Bancos dianteiros»"), true);
});
