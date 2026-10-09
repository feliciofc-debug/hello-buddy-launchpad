import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildBusinessPromptBlock } from "./business-context.ts";
import { montarPromptBlock } from "./copy-style.ts";
import {
  buildMetodoAmzBlock,
  metodoAmzExigeRevisao,
  revisarComMetodoAmz,
  type MetodoAmzTipo,
} from "./metodo-amz.ts";

Deno.test("bloco do Método AMZ preserva princípios e não contém dados de tenants", () => {
  const block = buildMetodoAmzBlock({ tipo: "post", estilo: "direto" });
  assertStringIncludes(
    block,
    "Você pensa como um estrategista de marketing de primeira linha antes de escrever.",
  );
  assertStringIncludes(
    block,
    "Checklist final: gancho forte? uma ideia só? concreto e crível? emoção? chamada para ação clara? coerente com a marca? nada inventado?",
  );
  assertStringIncludes(block, 'Use o estilo "direto".');
  assert(!block.includes("Clínica Tenant A"));
  assert(!block.includes("Loja Tenant B"));
});

Deno.test("sem estilo explícito delega escolha ao segmento e objetivo", () => {
  const block = buildMetodoAmzBlock({ tipo: "linkedin" });
  assertStringIncludes(
    block,
    "Escolha o estilo mais adequado ao segmento, ao objetivo comercial",
  );
  assertStringIncludes(
    block,
    "sem mencionar o nome “Método AMZ” nem citar autores",
  );
});

Deno.test("builders centrais de copy e negócio injetam o Método AMZ", () => {
  const copy = montarPromptBlock(
    "empresa",
    null,
    null,
    null,
    null,
    { tipo: "carrossel", estilo: "emocional" },
  );
  const business = buildBusinessPromptBlock(
    ["- Segmento: odontologia"],
    { tipo: "anuncio" },
  );
  assertStringIncludes(copy, "=== MÉTODO AMZ");
  assertStringIncludes(copy, "Tipo de peça: carrossel.");
  assertStringIncludes(business, "Tipo de peça: anuncio.");
  assertStringIncludes(business, "- Segmento: odontologia");
});

Deno.test("revisão ocorre somente para roteiro e anúncio", async () => {
  const tipos: MetodoAmzTipo[] = [
    "post",
    "carrossel",
    "linkedin",
    "roteiro",
    "anuncio",
  ];
  const chamadas: MetodoAmzTipo[] = [];
  for (const tipo of tipos) {
    const result = await revisarComMetodoAmz({
      tipo,
      primeiraVersao: "primeira",
      revisar: async () => {
        chamadas.push(tipo);
        return "revisada";
      },
    });
    assertEquals(
      result,
      metodoAmzExigeRevisao(tipo) ? "revisada" : "primeira",
    );
  }
  assertEquals(chamadas, ["roteiro", "anuncio"]);
});

Deno.test("falha ou resposta vazia da revisão preserva primeira versão", async () => {
  const onError = await revisarComMetodoAmz({
    tipo: "roteiro",
    primeiraVersao: { titulo: "original" },
    revisar: async () => {
      throw new Error("indisponível");
    },
  });
  const onEmpty = await revisarComMetodoAmz({
    tipo: "anuncio",
    primeiraVersao: "original",
    revisar: async () => null,
  });
  assertEquals(onError, { titulo: "original" });
  assertEquals(onEmpty, "original");
});
