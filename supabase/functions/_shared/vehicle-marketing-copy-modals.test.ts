import { assertStringIncludes } from "https://deno.land/std@0.224.0/assert/mod.ts";

const MODALS = [
  "src/components/PostarInstagramModal.tsx",
  "src/components/PostarFacebookModal.tsx",
  "src/components/PublicarSimultaneoModal.tsx",
  "src/components/PostarLinkedInModal.tsx",
];

for (const path of MODALS) {
  Deno.test(`${path} filtra URL inventada no ramo veículo`, async () => {
    const source = await Deno.readTextFile(path);
    assertStringIncludes(source, "buildGerarPostsInvokeBody");
    assertStringIncludes(source, "stripInventedUrlsFromVehicleCaption");
    assertStringIncludes(source, "isVehicle");
  });
}

Deno.test("modais produto continuam usando buildGerarPostsInvokeBody sem ramo veículo forçado", async () => {
  const ig = await Deno.readTextFile("src/components/PostarInstagramModal.tsx");
  assertStringIncludes(ig, "isVehicle ? sanitizeVehiclePostOptions(opcoes) : opcoes");
});
