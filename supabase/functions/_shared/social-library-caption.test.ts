import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  libraryPhotoCaptionSubject,
  removeUncitedCatalogNames,
  uncitedCatalogNamesInVariants,
} from "./social-library-caption.ts";

Deno.test("foto de desodorantes não herda produto de catálogo não citado", () => {
  const ownerRequest = "Crie legendas para esta foto e publique no feed";
  const visualDescription =
    "Três frascos de desodorante sobre uma bancada clara.";

  assertEquals(
    libraryPhotoCaptionSubject({
      visualDescription,
      ownerRequest,
      suggestedName: "COMEXIA",
    }),
    visualDescription,
  );
  assertEquals(
    uncitedCatalogNamesInVariants({
      variants: {
        A: "Conheça COMEXIA.",
        B: "Desodorantes para sua rotina.",
        C: "Escolha seu desodorante.",
      },
      catalogNames: ["COMEXIA"],
      ownerRequest,
      visualDescription,
    }),
    ["COMEXIA"],
  );
  assertEquals(
    removeUncitedCatalogNames({
      A: "Conheça COMEXIA.",
      B: "COMEXIA em destaque.",
      C: "Desodorantes.",
    }, ["COMEXIA"]),
    {
      A: "Conheça produto.",
      B: "produto em destaque.",
      C: "Desodorantes.",
    },
  );
});

Deno.test("produto do catálogo é permitido quando o dono cita o nome", () => {
  assertEquals(
    libraryPhotoCaptionSubject({
      visualDescription: "Uma caixa sobre a mesa.",
      ownerRequest: "Faça um post do COMEXIA",
      suggestedName: "COMEXIA",
    }),
    "COMEXIA",
  );
});
