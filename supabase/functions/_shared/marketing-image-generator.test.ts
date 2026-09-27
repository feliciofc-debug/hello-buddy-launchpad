import {
  buildMarketingImagePrompt,
  detectMarketingImageMode,
  generateMarketingImage,
} from "./marketing-image-generator.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

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
