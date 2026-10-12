import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  interiorProjectLocalEditPrompt,
  runInteriorEditValidation,
} from "./interior-edit.ts";

Deno.test("prompt de interiores começa pela base final e limita alterações", () => {
  const prompt = interiorProjectLocalEditPrompt("Troque apenas a luminária.");
  assertEquals(
    prompt.startsWith("A imagem recebida é a BASE FINAL."),
    true,
  );
  assertStringIncludes(prompt, "ALTERAÇÕES PERMITIDAS:\nTroque apenas");
  assertEquals(prompt.endsWith("Proibido mudar a estrutura do cômodo."), true);
  assertEquals(prompt.includes("Edite esta foto conforme"), false);
  assertEquals(prompt.includes("pronto para publicação"), false);
});

Deno.test("checagem true entrega a primeira geração", async () => {
  const result = await runInteriorEditValidation({
    ownerRequest: "Decore a sala.",
    generate: (_prompt, attempt) =>
      Promise.resolve({ ok: true as const, value: `imagem-${attempt}` }),
    validate: () => Promise.resolve(true),
  });
  assertEquals(result, {
    ok: true,
    value: "imagem-1",
    generations: 1,
    checkFailedOpen: false,
  });
});

Deno.test("false e depois true refaz uma vez com prefixo corretivo", async () => {
  const prompts: string[] = [];
  const result = await runInteriorEditValidation({
    ownerRequest: "Decore a sala.",
    generate: (prompt, attempt) => {
      prompts.push(prompt);
      return Promise.resolve({ ok: true as const, value: `imagem-${attempt}` });
    },
    validate: (_generated, attempt) => Promise.resolve(attempt === 2),
  });
  assertEquals(prompts.length, 2);
  assertEquals(
    prompts[1].startsWith(
      "A tentativa anterior mudou o cômodo. Altere SOMENTE a decoração.",
    ),
    true,
  );
  assertEquals(result.ok && result.generations, 2);
});

Deno.test("duas rejeições não entregam imagem", async () => {
  const result = await runInteriorEditValidation({
    ownerRequest: "Decore a sala.",
    generate: (_prompt, attempt) =>
      Promise.resolve({ ok: true as const, value: `imagem-${attempt}` }),
    validate: () => Promise.resolve(false),
  });
  assertEquals(result, { ok: false, reason: "structure_mismatch" });
});

Deno.test("erro da checagem entrega normalmente", async () => {
  const result = await runInteriorEditValidation({
    ownerRequest: "Decore a sala.",
    generate: () =>
      Promise.resolve({ ok: true as const, value: "imagem-1" }),
    validate: () => Promise.reject(new Error("timeout")),
  });
  assertEquals(result, {
    ok: true,
    value: "imagem-1",
    generations: 1,
    checkFailedOpen: true,
  });
});
