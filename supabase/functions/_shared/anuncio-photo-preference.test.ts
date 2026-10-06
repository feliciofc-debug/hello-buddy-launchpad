import {
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  anuncioPhotoChoiceButtons,
  anuncioPhotoDirectiveFromText,
  anuncioPhotoPreferenceConfirmationButtons,
  anuncioPhotoRedoButtons,
  getTenantAnuncioPhotoPreference,
  preferenceAfterPhotoRedo,
  resolveAnuncioPhotoPreference,
  saveTenantAnuncioPhotoPreference,
  shouldImproveAnuncioPhoto,
} from "./anuncio-style.ts";

function preferenceDatabase(initial: Record<string, unknown> = {}) {
  let identity = { ...initial };
  const query = {
    select() {
      return this;
    },
    eq() {
      return this;
    },
    maybeSingle() {
      return Promise.resolve({
        data: { identidade_site: identity },
        error: null,
      });
    },
    upsert(row: { identidade_site: Record<string, unknown> }) {
      identity = { ...row.identidade_site };
      return Promise.resolve({ error: null });
    },
  };
  return {
    sb: { from: () => query },
    identity: () => identity,
  };
}

Deno.test("sem preferência e sem pedido explícito pergunta por botões", () => {
  assertEquals(
    resolveAnuncioPhotoPreference({ explicit: null, saved: null }),
    null,
  );
  const prompt = anuncioPhotoChoiceButtons();
  assertStringIncludes(prompt.body, "Melhorar só muda fundo e luz");
  assertEquals(prompt.buttons.map((button) => button.title), [
    "Melhorar fundo e luz",
    "Usar foto original",
  ]);
});

Deno.test("pedido explícito vence a preferência salva somente no anúncio", () => {
  assertEquals(
    anuncioPhotoDirectiveFromText("usa a foto como está"),
    "original",
  );
  assertEquals(
    anuncioPhotoDirectiveFromText("sem melhorar a foto"),
    "original",
  );
  assertEquals(anuncioPhotoDirectiveFromText("sem melhorar"), "original");
  assertEquals(
    anuncioPhotoDirectiveFromText("melhora o fundo e a luz"),
    "melhorada",
  );
  assertEquals(
    resolveAnuncioPhotoPreference({
      explicit: "original",
      saved: "melhorada",
    }),
    "original",
  );
});

Deno.test("escolha salva é reutilizada sem nova pergunta", async () => {
  const database = preferenceDatabase({ preferred_ad_style: "impacto" });
  await saveTenantAnuncioPhotoPreference(
    database.sb,
    "tenant-1",
    "original",
  );
  assertEquals(
    await getTenantAnuncioPhotoPreference(database.sb, "tenant-1"),
    "original",
  );
  assertEquals(database.identity(), {
    preferred_ad_style: "impacto",
    foto_anuncio_preferencia: "original",
  });
});

Deno.test("refazer troca somente a opção da foto", () => {
  const fromImproved = anuncioPhotoRedoButtons("melhorada");
  assertEquals(fromImproved.buttons[0].id, "anuncio_photo:redo:original");
  assertEquals(shouldImproveAnuncioPhoto("original"), false);
  const fromOriginal = anuncioPhotoRedoButtons("original");
  assertEquals(fromOriginal.buttons[0].id, "anuncio_photo:redo:melhorada");
  assertEquals(shouldImproveAnuncioPhoto("melhorada"), true);
});

Deno.test("confirmação permanente altera preferência e só desta vez mantém", () => {
  assertEquals(
    preferenceAfterPhotoRedo({
      current: "melhorada",
      used: "original",
      always: true,
    }),
    "original",
  );
  assertEquals(
    preferenceAfterPhotoRedo({
      current: "melhorada",
      used: "original",
      always: false,
    }),
    "melhorada",
  );
  assertEquals(
    anuncioPhotoPreferenceConfirmationButtons("original").buttons.map(
      (button) => button.title,
    ),
    ["Sim, sempre", "Só desta vez"],
  );
});
