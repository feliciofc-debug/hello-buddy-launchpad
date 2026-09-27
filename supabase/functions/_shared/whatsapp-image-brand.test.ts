import {
  classifyPendingBrandReply,
  decideWhatsAppImageBrand,
  detectWhatsAppBrandDirective,
  previewableWhatsAppLogoUrl,
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

Deno.test("unrelated reminder leaves brand choice and continues normal conversation", () => {
  const result = classifyPendingBrandReply({
    stage: "awaiting_choice",
    text: "me lembra de ligar amanhã às 10h",
    createdAt: new Date().toISOString(),
  });
  assert(result.action === "continue_conversation", "reminder must not be intercepted");
});

Deno.test("new image request replaces pending brand generation", () => {
  const result = classifyPendingBrandReply({
    stage: "awaiting_choice",
    text: "crie uma imagem de uma cafeteria moderna",
    createdAt: new Date().toISOString(),
  });
  assert(result.action === "continue_conversation", "new image request must restart normal generation");
});

Deno.test("brand buttons and short site choices still answer the pending question", () => {
  const siteButton = classifyPendingBrandReply({
    stage: "awaiting_choice",
    text: "Usar cores do site",
    interactiveId: "brand_image_site",
    createdAt: new Date().toISOString(),
  });
  const shortSite = classifyPendingBrandReply({
    stage: "awaiting_choice",
    text: "cores do site",
    createdAt: new Date().toISOString(),
  });
  const noBrand = classifyPendingBrandReply({
    stage: "awaiting_choice",
    text: "sem logo",
    createdAt: new Date().toISOString(),
  });
  assert(siteButton.action === "choose_site", "site button must work");
  assert(shortSite.action === "choose_site", "short site choice must work");
  assert(noBrand.action === "choose_none", "short no-logo choice must work");
});

Deno.test("site URL stage only intercepts a URL", () => {
  const withUrl = classifyPendingBrandReply({
    stage: "awaiting_site_url",
    text: "é https://example.com",
    createdAt: new Date().toISOString(),
  });
  const otherSubject = classifyPendingBrandReply({
    stage: "awaiting_site_url",
    text: "qual é a previsão do tempo?",
    createdAt: new Date().toISOString(),
  });
  assert(withUrl.action === "site_url", "valid URL must continue site flow");
  assert(otherSubject.action === "continue_conversation", "other subject must not be intercepted");
});

Deno.test("brand pending expires after thirty minutes", () => {
  const now = Date.now();
  const result = classifyPendingBrandReply({
    stage: "awaiting_choice",
    text: "site",
    createdAt: new Date(now - 31 * 60 * 1000).toISOString(),
    now,
  });
  assert(result.action === "expired", "old pending question must be ignored");
});

Deno.test("SVG site logo is not sent as WhatsApp image preview", () => {
  assert(
    previewableWhatsAppLogoUrl(
      "https://example.com/logo.svg",
      "data:image/svg+xml;base64,PHN2Zz48L3N2Zz4=",
    ) === null,
    "SVG preview must be omitted",
  );
  assert(
    previewableWhatsAppLogoUrl(
      "https://example.com/logo.png",
      "data:image/png;base64,iVBORw0KGgo=",
    ) === "https://example.com/logo.png",
    "raster preview should be retained",
  );
});
