import { assertEquals, assertThrows } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { webmotorsPublicObservacao } from "./webmotors-text.ts";

Deno.test("permite frases comuns de anuncio (custo, interno, avarias)", () => {
  assertEquals(
    webmotorsPublicObservacao("Baixo custo de manutenção e acabamento interno impecável, sem avarias."),
    "Baixo custo de manutenção e acabamento interno impecável, sem avarias.",
  );
});

Deno.test("bloqueia FIPE com mensagem indicando o termo", () => {
  assertThrows(
    () => webmotorsPublicObservacao("Valor abaixo da tabela FIPE"),
    Error,
    "A descrição contém 'FIPE'",
  );
});
