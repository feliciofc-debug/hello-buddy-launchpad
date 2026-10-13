export const INTERIOR_STRUCTURE_FAILURE_MESSAGE =
  "Não consegui manter o cômodo idêntico. Tente pedir menos itens.";

export function interiorProjectLocalEditPrompt(
  ownerRequest: string,
  retry = false,
): string {
  return [
    retry
      ? "A tentativa anterior mudou o cômodo. Altere SOMENTE a decoração."
      : "",
    "A imagem recebida é a BASE FINAL. Devolva a MESMA foto: mesmo ângulo, enquadramento, teto, paredes, janelas, cortinas, piso e posição dos móveis. Só altere o que está em ALTERAÇÕES PERMITIDAS.",
    `ALTERAÇÕES PERMITIDAS:\n${String(ownerRequest || "").trim()}`,
    "Mantenha exatamente a arquitetura, as dimensões, a perspectiva e o formato da foto original. Quando o dono pedir para manter ou tratar um item, preserve seu modelo, material, cor, formato, proporção e posição; tratamento permite somente limpeza, brilho e correção de luz ou manchas.",
    "No piso mantido, preserve exatamente o material, a cor, o tamanho e a paginação das peças e o rejunte.",
    "Proibido mudar a estrutura do cômodo.",
  ].filter(Boolean).join("\n\n");
}

export type InteriorGeneration<T> =
  | { ok: true; value: T }
  | { ok: false; error: unknown };

export type InteriorEditResult<T> =
  | { ok: true; value: T; generations: number; checkFailedOpen: boolean }
  | { ok: false; reason: "generation_failed"; error: unknown }
  | { ok: false; reason: "structure_mismatch" };

export async function runInteriorEditValidation<T>(input: {
  ownerRequest: string;
  generate: (
    prompt: string,
    attempt: 1 | 2,
    previous?: T,
  ) => Promise<InteriorGeneration<T>>;
  validate: (generated: T, attempt: 1 | 2) => Promise<boolean | null>;
}): Promise<InteriorEditResult<T>> {
  let previous: T | undefined;
  for (const attempt of [1, 2] as const) {
    const generated = await input.generate(
      interiorProjectLocalEditPrompt(input.ownerRequest, attempt === 2),
      attempt,
      previous,
    );
    if (!generated.ok) {
      return { ok: false, reason: "generation_failed", error: generated.error };
    }
    previous = generated.value;
    let sameRoom: boolean | null;
    try {
      sameRoom = await input.validate(generated.value, attempt);
    } catch {
      sameRoom = null;
    }
    if (sameRoom !== false) {
      return {
        ok: true,
        value: generated.value,
        generations: attempt,
        checkFailedOpen: sameRoom === null,
      };
    }
  }
  return { ok: false, reason: "structure_mismatch" };
}
