import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildCrlvTrocaPatch,
  buildCrlvVehiclePatch,
  safeCrlvReading,
  sanitizeCrlvVehicleValues,
} from "./crlv-cofre.ts";
import { parseCrlvText } from "./crlv-parser.ts";

Deno.test("DOC-1 — resposta segura mascara CPF e reduz nome do proprietário", () => {
  const parsed = parseCrlvText(`
PLACA: ABC1D23
RENAVAM: 12345678900
CHASSI: 9BWZZZ377VT004251
MARCA/MODELO/VERSAO: MARCA / MODELO / VERSAO
ANO MODELO: 2023
NOME DO PROPRIETARIO: PESSOA SINTETICA COMPLETA
CPF/CNPJ: 529.982.247-25
`);
  const safe = safeCrlvReading(parsed);
  assertEquals(safe.proprietario.primeiro_nome, "Pessoa");
  assertEquals(safe.proprietario.cpf_cnpj_mascarado, "***.***.247-**");
  const json = JSON.stringify(safe);
  assertEquals(json.includes("PESSOA SINTETICA COMPLETA"), false);
  assertEquals(json.includes("52998224725"), false);
});

Deno.test("DOC-1 — confirmação só sobrescreve campos marcados", () => {
  const values = sanitizeCrlvVehicleValues({
    placa: "abc-1d23",
    marca: "Marca nova",
    modelo: "Modelo novo",
    ano_modelo: "2025",
    campo_interno: "ignorado",
  });
  const patch = buildCrlvVehiclePatch(
    {
      placa: "OLD1234",
      marca: "",
      modelo: "Modelo atual",
      ano_modelo: null,
    },
    values,
    new Set(["modelo"]),
  );
  assertEquals(patch, {
    marca: "Marca nova",
    modelo: "Modelo novo",
    ano_modelo: 2025,
  });
  assertEquals(values.placa, "ABC1D23");
  assertEquals("campo_interno" in values, false);
});

Deno.test("DOC-1.1 — confirmação preenche a troca sem apagar dados existentes", () => {
  const patch = buildCrlvTrocaPatch(
    {
      placa: null,
      marca: "—",
      modelo: "Modelo conferido",
      versao: "",
      ano_fabricacao: null,
      ano_modelo: 2024,
      cor: null,
    },
    sanitizeCrlvVehicleValues({
      placa: "abc1d23",
      marca: "Marca do CRLV",
      modelo: "Modelo do CRLV",
      versao: "Versão",
      ano_fabricacao: 2023,
      ano_modelo: 2025,
      cor: "Prata",
      renavam: "12345678900",
    }),
    new Set(),
  );
  assertEquals(patch, {
    placa: "ABC1D23",
    marca: "Marca do CRLV",
    versao: "Versão",
    ano_fabricacao: 2023,
    cor: "Prata",
  });
});

Deno.test("DOC-1 — fluxo guarda arquivo cifrado antes dos metadados", async () => {
  const source = await Deno.readTextFile(
    new URL("./gestao-cofre-upload.ts", import.meta.url),
  );
  const encrypt = source.indexOf("cifrarCofreBytes(input.bytes)");
  const upload = source.indexOf(".upload(path, encrypted");
  const insert = source.indexOf('.from("gestao_documento").insert({');
  assertEquals(encrypt >= 0 && upload > encrypt && insert > upload, true);
  const endpoint = await Deno.readTextFile(
    new URL("../gestao-cofre/index.ts", import.meta.url),
  );
  assertStringIncludes(endpoint, "safeCrlvReading(result.leitura)");
  assertStringIncludes(endpoint, 'body.troca_id ?? doc.troca_id');
  assertStringIncludes(endpoint, '.from("gestao_troca").update(patch)');
});

Deno.test("DOC-1.2 — auditoria recebe somente métricas do OCR", async () => {
  const source = await Deno.readTextFile(
    new URL("./gestao-cofre-upload.ts", import.meta.url),
  );
  assertStringIncludes(source, 'metricasOcr ?? {}');
  assertStringIncludes(source, '"ler"');
  assertEquals(
    /auditGestaoDocumento\([\s\S]{0,250}(texto|leitura\.texto)/i.test(source),
    false,
  );
});

Deno.test("DOC-1.1 — troca começa pelo documento e mantém o vínculo", async () => {
  const page = await Deno.readTextFile(
    new URL("../../../src/pages/GestaoTrocasPage.tsx", import.meta.url),
  );
  assertStringIncludes(page, "Começar pelo documento");
  assertStringIncludes(page, 'origem: "troca"');
  assertStringIncludes(page, "troca_id: trocaId");
  assertStringIncludes(page, "trocaId={documentReview.trocaId}");
});
