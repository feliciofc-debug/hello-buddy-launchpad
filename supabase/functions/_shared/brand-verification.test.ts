import {
  isBrandVerificationApproved,
  verifyBrandInImage,
} from "./brand-verification.ts";

function assert(condition: unknown, message: string): asserts condition {
  if (!condition) throw new Error(message);
}

Deno.test("invented brand always rejects an otherwise exact verification", () => {
  assert(
    !isBrandVerificationApproved({
      brand_visible: true,
      text_exact: true,
      text_found: "AMZ Ofertas",
      logo_matches: true,
      invented_brands: ["Influxo Digital"],
      confidence: 0.99,
    }),
    "invented brand must reject image",
  );
});

Deno.test("verification requires every flag and minimum confidence", () => {
  assert(
    isBrandVerificationApproved({
      brand_visible: true,
      text_exact: true,
      text_found: "AMZ Ofertas",
      logo_matches: true,
      invented_brands: [],
      confidence: 0.7,
    }),
    "all checks at threshold should pass",
  );
  assert(
    !isBrandVerificationApproved({
      brand_visible: true,
      text_exact: true,
      text_found: "AMZ Ofertas",
      logo_matches: true,
      invented_brands: [],
      confidence: 0.69,
    }),
    "confidence below threshold must reject",
  );
});

Deno.test("invalid verification response becomes technical rejection", async () => {
  const fetchImpl = async (): Promise<Response> =>
    new Response(JSON.stringify({
      choices: [{ message: { content: "não consegui verificar" } }],
    }), { status: 200 });
  const result = await verifyBrandInImage({
    generatedImageDataUrl: "data:image/png;base64,AA==",
    logoDataUrl: "data:image/png;base64,AA==",
    exactBrandName: "AMZ Ofertas",
    apiKey: "test",
    fetchImpl: fetchImpl as typeof fetch,
  });
  assert(!result.approved, "invalid response must reject");
  assert(result.technical_error, "invalid response must be marked technical");
});
