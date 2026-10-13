import {
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  anuncioArgsFromOwnerData,
  isPendingAnuncioDataCancellation,
  pendingAnuncioDataIsActive,
} from "./anuncio-data-followup.ts";

Deno.test("dados após botão Anúncio viram argumentos determinísticos", () => {
  const text =
    "Caneca de porcelana branca lisa / R$ 29,90 / Porcelana branca, acabamento texturizado, alça confortável, ideal para personalizar com logo, nome ou foto / Pix à vista ou 2x sem juros";
  assertEquals(anuncioArgsFromOwnerData(text), {
    titulo: "Caneca de porcelana branca lisa",
    preco: "R$ 29,90",
    itens: [
      "Porcelana branca, acabamento texturizado, alça confortável, ideal para personalizar com logo, nome ou foto",
    ],
    condicoes: ["Pix à vista ou 2x sem juros"],
  });
});

Deno.test("estado de dados do anúncio dura 30 minutos e aceita cancelar", () => {
  const now = Date.parse("2026-10-10T12:00:00.000Z");
  assertEquals(
    pendingAnuncioDataIsActive("2026-10-10T11:30:00.000Z", now),
    true,
  );
  assertEquals(
    pendingAnuncioDataIsActive("2026-10-10T11:29:59.000Z", now),
    false,
  );
  assertEquals(isPendingAnuncioDataCancellation("cancelar"), true);
});
