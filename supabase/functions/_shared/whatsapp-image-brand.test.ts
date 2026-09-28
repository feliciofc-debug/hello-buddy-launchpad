import {
  classifyPendingBrandReply,
  decideWhatsAppImageBrand,
  detectWhatsAppBrandDirective,
  extractExplicitWhatsAppBrandSiteUrl,
  extractWhatsAppBrandSiteUrl,
  previewableWhatsAppLogoUrl,
  whatsAppImageBrandResultMessage,
  whatsAppSiteBrandGenerationOptions,
  whatsAppUploadedLogoConfirmationButtons,
} from "./whatsapp-image-brand.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("pedido sem diretiva sempre pergunta por imagem, mesmo com memória ou logo", () => {
  const withLogo = decideWhatsAppImageBrand({
    demonstration: false,
    hasSavedLogo: true,
  });
  const withMemory = decideWhatsAppImageBrand({
    demonstration: false,
    hasSavedLogo: false,
    preference: {
      mode: "site",
      siteUrl: "https://example.com",
      colors: ["#123456"],
      updatedAt: new Date().toISOString(),
    },
  });
  assert(withLogo.askChoice && !withLogo.useLogo, "saved logo must not skip per-request choice");
  assert(withMemory.askChoice && withMemory.colors.length === 0, "memory must only retain the site URL");
});

Deno.test("diretivas explícitas pulam a pergunta", () => {
  const none = decideWhatsAppImageBrand({
    demonstration: false,
    hasSavedLogo: true,
    directive: detectWhatsAppBrandDirective("gere sem logo"),
  });
  const use = decideWhatsAppImageBrand({
    demonstration: false,
    hasSavedLogo: true,
    directive: detectWhatsAppBrandDirective("gere com minha marca"),
  });
  const missing = decideWhatsAppImageBrand({
    demonstration: false,
    hasSavedLogo: false,
    directive: detectWhatsAppBrandDirective("use minha logo"),
  });
  assert(!none.useLogo && !none.askChoice && none.reason === "explicit_none", "opt-out must win");
  assert(use.useLogo && !use.askChoice && use.reason === "explicit_logo", "saved logo should be used");
  assert(!missing.useLogo && !missing.askChoice && missing.reason === "missing_logo", "missing logo asks for upload");
});

Deno.test("demonstrações permanecem sem marca e sem botões", () => {
  const first = decideWhatsAppImageBrand({ demonstration: false, hasSavedLogo: false });
  const demo = decideWhatsAppImageBrand({ demonstration: true, hasSavedLogo: true });
  assert(first.askChoice, "owner generation should ask for this request");
  assert(!demo.useLogo && !demo.askChoice && demo.reason === "demo", "demo must stay unbranded");
});

Deno.test("somente link explicitamente usado como identidade pula a escolha", () => {
  assert(
    extractExplicitWhatsAppBrandSiteUrl(
      "gere uma imagem usando as cores do meu site https://marca.example/identidade",
    ) ===
      "https://marca.example/identidade",
    "explicit brand site should be extracted",
  );
  assert(
    extractExplicitWhatsAppBrandSiteUrl(
      "faça um anúncio deste produto https://amazon.com.br/dp/ABC",
    ) === null,
    "product URL must still show the three brand buttons",
  );
  assert(extractWhatsAppBrandSiteUrl("gere sem marca") === null, "request without URL stays unset");
});

Deno.test("logo confiável do site é temporária e a resposta é honesta", () => {
  const options = whatsAppSiteBrandGenerationOptions({
    colors: ["#123456"],
    brand_name: "Marca Exemplo",
    logo_data_url: "data:image/png;base64,AAAA",
    logo_confidence: "high",
  });
  assert(options.incluirLogo, "trusted site logo must be sent to the shared generator");
  assert(options.logoDataUrl?.startsWith("data:image/png"), "site logo must remain in-memory");
  assert(options.brandName === "Marca Exemplo", "site brand name should be forwarded");
  assert(options.brandSource === "site", "result must preserve temporary site provenance");
  assert(
    whatsAppImageBrandResultMessage({
      brand_source: "site",
      site_logo_requested: true,
      logo_aplicada: true,
      brand_application_mode: "in_scene_verified",
    }) === "Apliquei a logo encontrada no site na cena.",
    "verified in-scene result should be reported",
  );
});

Deno.test("site sem logo confiável usa somente cores", () => {
  const options = whatsAppSiteBrandGenerationOptions({
    colors: ["#123456", "#abcdef"],
    brand_name: "Marca Exemplo",
    logo_data_url: "data:image/png;base64,AAAA",
    logo_confidence: "none",
  });
  assert(!options.incluirLogo && options.logoDataUrl === null, "untrusted logo must be discarded");
  assert(
    whatsAppImageBrandResultMessage({
      brand_source: "site",
      site_logo_requested: false,
      logo_aplicada: false,
    }) === "Usei somente as cores encontradas no site.",
    "colors-only result should be reported",
  );
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

Deno.test("os três botões de marca resolvem a escolha", () => {
  const logoButton = classifyPendingBrandReply({
    stage: "awaiting_choice",
    text: "Com minha marca",
    interactiveId: "brand_image_logo",
    createdAt: new Date().toISOString(),
  });
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
  assert(logoButton.action === "choose_logo", "logo button must work");
  assert(siteButton.action === "choose_site", "site button must work");
  assert(shortSite.action === "choose_site", "short site choice must work");
  assert(noBrand.action === "choose_none", "short no-logo choice must work");
});

Deno.test("site anterior e upload manual mantêm escolhas explícitas", () => {
  const previous = classifyPendingBrandReply({
    stage: "awaiting_site_choice",
    text: "Usar example.com",
    interactiveId: "brand_site_previous",
    createdAt: new Date().toISOString(),
  });
  const other = classifyPendingBrandReply({
    stage: "awaiting_site_choice",
    text: "Outro site",
    interactiveId: "brand_site_other",
    createdAt: new Date().toISOString(),
  });
  const save = classifyPendingBrandReply({
    stage: "awaiting_uploaded_logo_confirmation",
    text: "Salvar como minha logo",
    interactiveId: "brand_uploaded_logo_save",
    createdAt: new Date().toISOString(),
  });
  const once = classifyPendingBrandReply({
    stage: "awaiting_uploaded_logo_confirmation",
    text: "Usar só nesta imagem",
    interactiveId: "brand_uploaded_logo_once",
    createdAt: new Date().toISOString(),
  });
  assert(previous.action === "use_previous_site", "previous site button must work");
  assert(other.action === "use_other_site", "other site button must work");
  assert(save.action === "save_uploaded_logo", "upload is only saved after confirmation");
  assert(once.action === "use_uploaded_logo_once", "temporary logo choice must not save");
  const uploadButtons = whatsAppUploadedLogoConfirmationButtons();
  assert(uploadButtons[0].title === "Salvar minha logo", "save button must not be truncated");
  assert(uploadButtons.every((button) => button.title.length <= 20), "Meta button titles must fit 20 chars");
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

Deno.test("botão antigo expira após trinta minutos sem prender outro assunto", () => {
  const now = Date.now();
  const oldButton = classifyPendingBrandReply({
    stage: "awaiting_choice",
    text: "Cores do meu site",
    interactiveId: "brand_image_site",
    createdAt: new Date(now - 31 * 60 * 1000).toISOString(),
    now,
  });
  const unrelated = classifyPendingBrandReply({
    stage: "awaiting_choice",
    text: "me lembra de ligar amanhã",
    createdAt: new Date(now - 31 * 60 * 1000).toISOString(),
    now,
  });
  assert(oldButton.action === "expired", "old interactive button must expire");
  assert(unrelated.action === "continue_conversation", "expired pending must not capture another subject");
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
