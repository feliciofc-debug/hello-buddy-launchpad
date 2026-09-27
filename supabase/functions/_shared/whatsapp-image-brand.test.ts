import {
  decideWhatsAppImageBrand,
  detectWhatsAppBrandDirective,
} from "./whatsapp-image-brand.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("saved logo is enabled by default for varied wording and no mention", () => {
  for (const text of ["crie uma imagem de café", "coloque a logo", "use minha marca"]) {
    const decision = decideWhatsAppImageBrand({
      demonstration: false,
      hasSavedLogo: true,
      directive: detectWhatsAppBrandDirective(text),
    });
    assert(decision.useLogo, `saved logo should be used for: ${text}`);
    assert(!decision.askChoice, "configured tenant must not be asked again");
  }
});

Deno.test("explicit sem logo wins and remembered choice is reused", () => {
  const explicit = decideWhatsAppImageBrand({
    demonstration: false,
    hasSavedLogo: true,
    directive: detectWhatsAppBrandDirective("gere sem logo"),
  });
  assert(!explicit.useLogo && explicit.reason === "explicit_none", "explicit opt-out must win");

  const remembered = decideWhatsAppImageBrand({
    demonstration: false,
    hasSavedLogo: false,
    preference: { mode: "none", updatedAt: new Date().toISOString() },
  });
  assert(!remembered.askChoice && remembered.reason === "remembered_none", "choice should be remembered");
});

Deno.test("unconfigured tenant is asked once and demos remain unbranded", () => {
  const first = decideWhatsAppImageBrand({ demonstration: false, hasSavedLogo: false });
  assert(first.askChoice, "first owner generation should ask for brand choice");
  const demo = decideWhatsAppImageBrand({ demonstration: true, hasSavedLogo: true });
  assert(!demo.useLogo && !demo.askChoice && demo.reason === "demo", "demo must stay unbranded");
});

Deno.test("site preference contributes colors without silently using its logo", () => {
  const decision = decideWhatsAppImageBrand({
    demonstration: false,
    hasSavedLogo: false,
    preference: {
      mode: "site",
      siteUrl: "https://example.com",
      colors: ["#123456", "#abcdef"],
      updatedAt: new Date().toISOString(),
    },
  });
  assert(!decision.useLogo, "site logo must not be applied before confirmation");
  assert(decision.colors.length === 2, "site colors should be remembered");
});
