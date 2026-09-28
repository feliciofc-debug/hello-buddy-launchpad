import {
  buildMarketingImagePrompt,
  detectMarketingImageMode,
  generateMarketingImage,
} from "./marketing-image-generator.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

function bytesToDataUrl(bytes: Uint8Array): string {
  let binary = "";
  for (let index = 0; index < bytes.length; index += 8192) {
    binary += String.fromCharCode(...bytes.subarray(index, index + 8192));
  }
  return `data:image/png;base64,${btoa(binary)}`;
}

async function imageFixtures(): Promise<{ generated: string; logo: string }> {
  const generated = new Image(256, 256);
  generated.fill(0x243044ff);
  const logo = new Image(160, 60);
  logo.fill(0x00000000);
  logo.drawBox(25, 18, 110, 24, 0xffffffff);
  return {
    generated: bytesToDataUrl(new Uint8Array(await generated.encode())),
    logo: bytesToDataUrl(new Uint8Array(await logo.encode())),
  };
}

function mockedBrandFlow(
  generated: string,
  verifications: Array<Record<string, unknown> | "technical-error">,
): { fetchImpl: typeof fetch; counts: { generations: number; verifications: number } } {
  const counts = { generations: 0, verifications: 0 };
  const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init?.body || "{}"));
    if (body.model === "google/gemini-3.6-flash") {
      const result = verifications[counts.verifications++] ?? "technical-error";
      if (result === "technical-error") return new Response("timeout", { status: 500 });
      return new Response(JSON.stringify({
        choices: [{ message: { content: JSON.stringify(result) } }],
      }), { status: 200 });
    }
    counts.generations++;
    return new Response(JSON.stringify({
      choices: [{ message: { images: [{ image_url: { url: generated } }] } }],
    }), { status: 200 });
  };
  return { fetchImpl: fetchImpl as typeof fetch, counts };
}

const APPROVED = {
  brand_visible: true,
  text_exact: true,
  text_found: "AMZ Ofertas",
  logo_matches: true,
  invented_brands: [],
  confidence: 0.94,
};

const REJECTED = {
  brand_visible: true,
  text_exact: false,
  text_found: "Café Ofertas",
  logo_matches: false,
  invented_brands: ["Café Ofertas"],
  confidence: 0.91,
};

Deno.test("marketing prompt preserves IA Marketing modes and forbids invented brands", () => {
  const plain = buildMarketingImagePrompt({ prompt: "uma cafeteria à noite" });
  assert(plain.mode === "text", "text-only request should use text mode");
  assert(plain.prompt.includes("Never invent or add a company name"), "invented brands must be forbidden");
  assert(plain.prompt.includes("generic, unnamed interfaces"), "unnamed interfaces must be required");

  const base = buildMarketingImagePrompt({
    prompt: "crie um ambiente sofisticado em volta deste produto",
    references: ["https://example.com/product.png"],
  });
  assert(base.mode === "base_photo", "generic reference should use base-photo mode");
  assert(base.prompt.includes("Preserve the real product"), "base subject must be preserved");

  const portrait = buildMarketingImagePrompt({
    prompt: "use minha foto e faça um retrato executivo",
    references: ["https://example.com/person.png"],
  });
  assert(portrait.mode === "portrait", "portrait intent should use portrait mode");
  assert(portrait.prompt.includes("MESMA pessoa"), "portrait identity must be preserved");
});

Deno.test("scene preservation remains distinct from generic base photo", () => {
  assert(
    detectMarketingImageMode("melhore a iluminação desta fachada sem mudar o local", 1) === "scene",
    "facade preservation should use scene mode",
  );
  assert(
    detectMarketingImageMode("coloque o produto em um showroom moderno", 1) === "base_photo",
    "new environment should use base-photo mode",
  );
});

Deno.test("card logo prompt reserves a smooth area in its exact background color", () => {
  const result = buildMarketingImagePrompt({
    prompt: "cafeteria premium à noite",
    hasLogo: true,
    cardBackgroundHex: "#181c24",
  });
  assert(result.prompt.includes("#181c24"), "card color must be included in prompt");
  assert(result.prompt.includes("LISA e ESCURA"), "prompt must reserve a smooth dark area");
  assert(result.prompt.includes("sem luzes, reflexos"), "reserved area must avoid visual noise");
});

Deno.test("in-scene prompt treats official logo as sole source of truth", () => {
  const result = buildMarketingImagePrompt({
    prompt: "sala de reunião sofisticada",
    hasLogo: true,
    inSceneBrand: {
      logoDataUrl: "data:image/png;base64,AAAA",
      exactName: "AMZ Ofertas",
    },
  });
  assert(!result.prompt.includes('"AMZ Ofertas"'), "brand name must not be written separately");
  assert(
    result.prompt.includes("único texto permitido") || result.prompt.includes("only text allowed"),
    "only text already present in the logo may be rendered",
  );
  assert(result.prompt.includes("logo reference is the sole source of truth"), "logo must be authoritative");
  assert(result.prompt.includes("ONE coherent physical surface"), "brand must be integrated into one surface");
  assert(result.prompt.includes("Never invent another company name"), "invented brands must remain forbidden");
  const content = (result.messages.at(-1) as any)?.content;
  assert(Array.isArray(content) && content.some((part: any) =>
    part?.image_url?.url === "data:image/png;base64,AAAA"
  ), "official logo must be sent as image reference");
});

Deno.test("in-scene generation works without a separate brand name", async () => {
  const fixtures = await imageFixtures();
  const mock = mockedBrandFlow(fixtures.generated, [APPROVED]);
  const result = await generateMarketingImage({
    prompt: "recepção corporativa moderna",
    logoDataUrl: fixtures.logo,
    brandName: null,
    apiKey: "test",
    models: ["image-model"],
    fetchImpl: mock.fetchImpl,
  });
  assert(result.brandApplicationMode === "in_scene_verified", "logo reference should be enough");
  assert(mock.counts.verifications === 1, "logo should still be verified");
});

Deno.test("image gateway falls back to the next model", async () => {
  const calls: string[] = [];
  const pixel = "data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M/wHwAF/gL+Avp9WQAAAABJRU5ErkJggg==";
  const fetchImpl = async (_input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    const body = JSON.parse(String(init?.body || "{}"));
    calls.push(body.model);
    if (body.model === "broken-model") {
      return new Response(JSON.stringify({ error: "unsupported" }), { status: 400 });
    }
    return new Response(JSON.stringify({
      choices: [{ message: { images: [{ image_url: { url: pixel } }] } }],
    }), { status: 200, headers: { "content-type": "application/json" } });
  };

  const result = await generateMarketingImage({
    prompt: "produto em fundo azul",
    apiKey: "test",
    models: ["broken-model", "working-model"],
    fetchImpl: fetchImpl as typeof fetch,
  });
  assert(result.model === "working-model", "second model should succeed");
  assert(calls.join(",") === "broken-model,working-model", "models should be attempted in order");
  assert(!result.logoApplied, "unbranded generation must not apply a logo");
});

Deno.test("in-scene brand is approved on first generation", async () => {
  const fixtures = await imageFixtures();
  const mock = mockedBrandFlow(fixtures.generated, [APPROVED]);
  const result = await generateMarketingImage({
    prompt: "escritório moderno",
    logoDataUrl: fixtures.logo,
    brandName: "AMZ Ofertas",
    apiKey: "test",
    models: ["image-model"],
    fetchImpl: mock.fetchImpl,
  });
  assert(result.brandApplicationMode === "in_scene_verified", "first verified image should be delivered");
  assert(mock.counts.generations === 1, "only one generation should run");
  assert(mock.counts.verifications === 1, "only one verification should run");
});

Deno.test("rejected first brand is regenerated and approved once", async () => {
  const fixtures = await imageFixtures();
  const mock = mockedBrandFlow(fixtures.generated, [REJECTED, APPROVED]);
  const result = await generateMarketingImage({
    prompt: "loja tecnológica",
    logoDataUrl: fixtures.logo,
    brandName: "AMZ Ofertas",
    apiKey: "test",
    models: ["image-model"],
    fetchImpl: mock.fetchImpl,
  });
  assert(result.brandApplicationMode === "in_scene_retry_verified", "second verified image should be delivered");
  assert(mock.counts.generations === 2, "two generations should run");
  assert(mock.counts.verifications === 2, "two verifications should run");
});

Deno.test("two rejected brands use third generation with overlay fallback", async () => {
  const fixtures = await imageFixtures();
  const mock = mockedBrandFlow(fixtures.generated, [REJECTED, REJECTED]);
  const result = await generateMarketingImage({
    prompt: "showroom premium",
    logoDataUrl: fixtures.logo,
    brandName: "AMZ Ofertas",
    apiKey: "test",
    models: ["image-model"],
    fetchImpl: mock.fetchImpl,
  });
  assert(result.brandApplicationMode === "overlay_fallback", "unsafe in-scene image must not be delivered");
  assert(result.logoApplied, "official logo should be overlaid");
  assert(mock.counts.generations === 3, "generation limit must be exactly three");
  assert(mock.counts.verifications === 2, "verification limit must be exactly two");
});

Deno.test("technical verification errors are rejected and end in safe fallback", async () => {
  const fixtures = await imageFixtures();
  const mock = mockedBrandFlow(fixtures.generated, ["technical-error", "technical-error"]);
  const result = await generateMarketingImage({
    prompt: "recepção corporativa",
    logoDataUrl: fixtures.logo,
    brandName: "AMZ Ofertas",
    apiKey: "test",
    models: ["image-model"],
    fetchImpl: mock.fetchImpl,
  });
  assert(result.brandApplicationMode === "overlay_fallback", "technical failure must force fallback");
  assert(result.verificationAttempts.every((item) => item.technical_error), "errors must be recorded");
  assert(mock.counts.generations === 3, "technical errors must not exceed generation limit");
});

Deno.test("base photo never draws a new brand into the real scene", async () => {
  const fixtures = await imageFixtures();
  const mock = mockedBrandFlow(fixtures.generated, []);
  const result = await generateMarketingImage({
    prompt: "preserve este produto e melhore o ambiente",
    references: ["https://example.com/base.jpg"],
    logoDataUrl: fixtures.logo,
    brandName: "AMZ Ofertas",
    apiKey: "test",
    models: ["image-model"],
    fetchImpl: mock.fetchImpl,
  });
  assert(result.brandApplicationMode === "overlay", "base photo should retain overlay behavior");
  assert(mock.counts.generations === 1, "base photo should generate once");
  assert(mock.counts.verifications === 0, "base photo should not enter in-scene verification");
});

Deno.test("demonstration without logo remains unbranded", async () => {
  const fixtures = await imageFixtures();
  const mock = mockedBrandFlow(fixtures.generated, []);
  const result = await generateMarketingImage({
    prompt: "cafeteria contemporânea",
    apiKey: "test",
    models: ["image-model"],
    fetchImpl: mock.fetchImpl,
  });
  assert(result.brandApplicationMode === "none", "no-logo demo must stay unbranded");
  assert(mock.counts.generations === 1, "demo should generate only once");
  assert(mock.counts.verifications === 0, "demo should not be verified for branding");
});
