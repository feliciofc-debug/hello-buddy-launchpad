import { assert, assertEquals, assertFalse, assertMatch } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildCarouselPrompt } from "./business-context.ts";
import { AMZ_AUTO_MARK_LOGO_DATA_URL } from "./amz-auto-mark-embedded.ts";
import { resolveCarouselStyleRequest } from "./carousel-styles.ts";
import {
  AMZ_AUTO_BRAND_NAME,
  AMZ_AUTO_CAROUSEL_COLOR,
  AMZ_AUTO_FICHA_ITEMS,
  AMZ_AUTO_FORCED_TEMPLATE,
  amzAutoCarouselStyleLocked,
  buildAmzAutoCarouselCopyPromptBlock,
  buildAmzAutoCarouselPrompt,
  isAmzAutoCarouselFlow,
  mentionsAmzAutoInCarouselRequest,
  resolveAmzAutoCarouselRenderOptions,
  sanitizeAmzAutoCarouselCopy,
  sanitizeAmzAutoCarouselSlides,
  sanitizeAmzAutoCarouselVariants,
  shouldPromptCarouselStyleOrColor,
  shouldUseAmzAutoCarouselBrand,
} from "./amz-auto-brand.ts";
import { AMZ_TENANT_ID } from "./amz-tenant.ts";

const OUTRO_TENANT = "aaaaaaaa-bbbb-cccc-dddd-eeeeeeeeeeee";

Deno.test("CARROSSEL-AMZAUTO — pedido sem amz auto não ativa perfil AMZ Auto", () => {
  assertFalse(shouldUseAmzAutoCarouselBrand(AMZ_TENANT_ID, "carrossel vantagens da plataforma"));
  assertFalse(shouldUseAmzAutoCarouselBrand(AMZ_TENANT_ID, "vantagens da AMZ Ofertas"));
  const ofertasPrompt = buildCarouselPrompt({
    tema: "vantagens da AMZ Ofertas",
    numSlides: 7,
    business: null,
  });
  assert(!ofertasPrompt.includes("FICHA OFICIAL DA PLATAFORMA AMZ AUTO"));
});

Deno.test("CARROSSEL-AMZAUTO — tenant AMZ + carrossel AMZ Auto inclui ficha completa", () => {
  const tema = "carrossel da AMZ Auto";
  assert(shouldUseAmzAutoCarouselBrand(AMZ_TENANT_ID, tema));
  const prompt = buildAmzAutoCarouselPrompt({ tema, numSlides: 8, business: null });
  for (const item of AMZ_AUTO_FICHA_ITEMS) {
    assert(
      prompt.includes(item.slice(0, 40)),
      `ficha item ausente no prompt: ${item.slice(0, 40)}`,
    );
  }
  assertEquals(AMZ_AUTO_FICHA_ITEMS[10], "Painel de gestão: tudo acompanhado pelo painel, de qualquer lugar.");
  assert(prompt.includes("11. Painel de gestão: tudo acompanhado pelo painel, de qualquer lugar."));
  assert(prompt.includes(AMZ_AUTO_BRAND_NAME));
  const copyBlock = buildAmzAutoCarouselCopyPromptBlock();
  assert(copyBlock.includes("PROIBIDO citar"));
});

Deno.test("CARROSSEL-AMZAUTO — outro tenant + amz auto não troca marca", () => {
  assertFalse(shouldUseAmzAutoCarouselBrand(OUTRO_TENANT, "carrossel da AMZ Auto"));
});

Deno.test("CARROSSEL-AMZAUTO.1 — fluxo AMZ Auto usa logo embutida e layout dedicado", () => {
  const render = resolveAmzAutoCarouselRenderOptions();
  assertEquals(render.embedded_logo_data_url, AMZ_AUTO_MARK_LOGO_DATA_URL);
  assertMatch(render.embedded_logo_data_url, /^data:image\/png;base64,/);
  assertEquals(render.amz_auto_layout, true);
  assertEquals(render.skip_tenant_logo_fallback, true);
});

Deno.test("CARROSSEL-AMZAUTO.1 — filtro remove amzofertas de slides e legendas", () => {
  const slides = sanitizeAmzAutoCarouselSlides([{
    type: "content",
    title: "Painel em amzofertas.com.br",
    body: "Veja na AMZ Ofertas\nLinha 2\nLinha 3\nLinha 4",
  }]);
  assertEquals(slides[0].title, "Painel em AMZ Auto");
  assert(slides[0].body.includes("AMZ Auto"));
  assertFalse(slides[0].body.toLowerCase().includes("amzofertas"));

  const variantes = sanitizeAmzAutoCarouselVariants({
    A: "Confira amzofertas.com.br hoje",
    B: "AMZ Ofertas para lojas",
    C: "amzofertas no painel",
  });
  for (const key of ["A", "B", "C"] as const) {
    assertFalse(variantes[key].toLowerCase().includes("amzofertas"));
    assert(variantes[key].includes("AMZ Auto"));
  }
  assertEquals(
    sanitizeAmzAutoCarouselCopy("Site amzOFERTAS.com.br"),
    "Site AMZ Auto",
  );
});

Deno.test("CARROSSEL-AMZAUTO.2 — AMZ Auto força dark-premium e não abre seletor", () => {
  const tema = "carrossel da AMZ Auto estilo neon tech";
  assert(isAmzAutoCarouselFlow({
    userId: AMZ_TENANT_ID,
    tema,
    demoProspect: false,
  }));
  const stylePlan = resolveCarouselStyleRequest({ request: tema });
  assertEquals(stylePlan.template, "neon-tech");
  const locked = amzAutoCarouselStyleLocked();
  assertEquals(locked.template, AMZ_AUTO_FORCED_TEMPLATE);
  assertEquals(locked.color.primaryColor, AMZ_AUTO_CAROUSEL_COLOR.primaryColor);
  assertEquals(shouldPromptCarouselStyleOrColor(true), false);
  assertEquals(shouldPromptCarouselStyleOrColor(false), true);
});

Deno.test("CARROSSEL-AMZAUTO.2 — AMZ Ofertas continua pedindo estilo quando necessário", () => {
  const tema = "vantagens da AMZ Ofertas";
  assertFalse(isAmzAutoCarouselFlow({
    userId: AMZ_TENANT_ID,
    tema,
    demoProspect: false,
  }));
  const stylePlan = resolveCarouselStyleRequest({ request: tema });
  assertEquals(stylePlan.template, null);
  assertEquals(shouldPromptCarouselStyleOrColor(false), true);
});

Deno.test("CARROSSEL-AMZAUTO.3 — pending AMZ Auto não vaza para carrossel novo", () => {
  const pending = { tema: "carrossel da AMZ Auto", amz_auto: true };
  assertFalse(isAmzAutoCarouselFlow({
    userId: AMZ_TENANT_ID,
    tema: "faz um carrossel sobre automação de marketing",
    pending,
  }));
  assert(isAmzAutoCarouselFlow({
    userId: AMZ_TENANT_ID,
    tema: "carrossel da AMZ Auto",
    pending,
  }));
  assert(isAmzAutoCarouselFlow({
    userId: AMZ_TENANT_ID,
    tema: "outro assunto",
    pending,
    ajuste: "troca o card 2",
  }));
  assert(isAmzAutoCarouselFlow({
    userId: AMZ_TENANT_ID,
    tema: "carrossel da AMZ Auto",
    pending,
    hasCurrentSlides: true,
  }));
});

Deno.test("CARROSSEL-AMZAUTO — detecção aceita variantes de amz auto", () => {
  const samples = ["AMZ Auto", "amz auto", "amzauto", "Amz-Auto", "faça um carrossel AmzAuto"];
  for (const sample of samples) {
    assert(
      mentionsAmzAutoInCarouselRequest(sample),
      `deveria detectar: ${sample}`,
    );
  }
  assertFalse(mentionsAmzAutoInCarouselRequest("automóveis da loja"));
});
