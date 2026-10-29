import { assert, assertEquals, assertFalse } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { buildCarouselPrompt } from "./business-context.ts";
import {
  AMZ_AUTO_BRAND_NAME,
  AMZ_AUTO_FICHA_ITEMS,
  amzAutoLogoStoragePath,
  buildAmzAutoCarouselCopyPromptBlock,
  buildAmzAutoCarouselPrompt,
  mentionsAmzAutoInCarouselRequest,
  resolveAmzAutoCarouselRenderOptions,
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
  assert(prompt.includes(AMZ_AUTO_BRAND_NAME));
  assert(prompt.includes("lojas de veículos"));
  const copyBlock = buildAmzAutoCarouselCopyPromptBlock();
  assert(copyBlock.includes("12.") || copyBlock.includes(AMZ_AUTO_FICHA_ITEMS[11].slice(0, 20)));
});

Deno.test("CARROSSEL-AMZAUTO — outro tenant + amz auto não troca marca", () => {
  assertFalse(shouldUseAmzAutoCarouselBrand(OUTRO_TENANT, "carrossel da AMZ Auto"));
});

Deno.test("CARROSSEL-AMZAUTO — logo ausente usa texto e não fallback Ofertas", () => {
  const render = resolveAmzAutoCarouselRenderOptions(AMZ_TENANT_ID);
  assertEquals(render.businessName, "AMZ Auto");
  assertEquals(render.brand_mark_text, "AMZ Auto");
  assertEquals(render.skip_tenant_logo_fallback, true);
  assertEquals(render.logo_path, amzAutoLogoStoragePath(AMZ_TENANT_ID));
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
