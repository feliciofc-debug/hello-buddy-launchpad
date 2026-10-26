import {
  assert,
  assertEquals,
  assertGreater,
  assertLess,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import {
  buildGestaoOsCotacaoWhatsappPdfBytes,
  compositeImageOnWhiteBackground,
  normalizeTextoPdfPortugues,
} from "./os-parceiro-cotacao-pdf.ts";

const input = {
  titulo: "pedido_cotacao" as const,
  lojaNome: "Loja São José",
  lojaCnpj: "12.345.678/0001-90",
  lojaCidade: "São Paulo",
  lojaContato: "(11) 99999-9999",
  parceiroNome: "Funilaria do Zé",
  osNumero: 15,
  dataIso: "2026-10-26T12:00:00Z",
  veiculo: { marca: "MINI", modelo: "Cooper", ano: 2021 },
  itens: [{ descricao: "Higienização e polimento" }],
  comoResponder: "Envie valor e prazo pelo WhatsApp.",
};

async function jpegFixture(): Promise<Uint8Array> {
  const image = new Image(320, 180);
  image.fill(0x3366ccff);
  return new Uint8Array(await image.encodeJPEG(80));
}

function responseBytes(bytes: Uint8Array): ArrayBuffer {
  return bytes.slice().buffer as ArrayBuffer;
}

Deno.test("COTACAO-WPP-1.3 — PDF com 4 JPG contém 4 objetos de imagem", async () => {
  const jpeg = await jpegFixture();
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => Promise.resolve(new Response(responseBytes(jpeg), {
    status: 200,
    headers: { "content-type": "image/jpeg" },
  }))) as typeof fetch;
  try {
    const pdf = await buildGestaoOsCotacaoWhatsappPdfBytes(input, {
      fotos: Array.from({ length: 4 }, (_, i) => ({
        url: `https://api.amzofertas.com.br/foto-${i + 1}.jpg`,
        legenda: `Foto do anúncio ${i + 1}`,
      })),
    });
    const raw = new TextDecoder("latin1").decode(pdf);
    console.log(`PDF_EXEMPLO_4_FOTOS_BYTES=${pdf.byteLength}`);
    assertEquals((raw.match(/\/Subtype\s*\/Image/g) ?? []).length, 4);
    assertGreater(pdf.byteLength, jpeg.byteLength * 2);
    assertLess(pdf.byteLength, 8 * 1024 * 1024);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("COTACAO-WPP-1.3 — URL WebP convertida pelo proxy entra no PDF", async () => {
  const jpeg = await jpegFixture();
  let fetched = "";
  const originalFetch = globalThis.fetch;
  globalThis.fetch = ((url: string | URL | Request) => {
    fetched = String(url);
    return Promise.resolve(new Response(responseBytes(jpeg), { status: 200 }));
  }) as typeof fetch;
  try {
    const proxy = "https://projeto.supabase.co/functions/v1/media-para-meta?url=carro.webp";
    const pdf = await buildGestaoOsCotacaoWhatsappPdfBytes(input, {
      fotos: [{ url: proxy, legenda: "WebP convertido" }],
    });
    assertStringIncludes(fetched, "media-para-meta");
    assert(new TextDecoder("latin1").decode(pdf).includes("/Subtype /Image"));
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("COTACAO-WPP-1.3 — foto quebrada é ignorada sem derrubar PDF", async () => {
  const originalFetch = globalThis.fetch;
  globalThis.fetch = (() => Promise.resolve(new Response("erro", { status: 500 }))) as typeof fetch;
  const warnings: string[] = [];
  try {
    const pdf = await buildGestaoOsCotacaoWhatsappPdfBytes(input, {
      fotos: [{ url: "https://api.amzofertas.com.br/quebrada.jpg", legenda: "Quebrada" }],
      log: (warning) => warnings.push(warning),
    });
    assertGreater(pdf.byteLength, 500);
    assertEquals(warnings.length, 1);
  } finally {
    globalThis.fetch = originalFetch;
  }
});

Deno.test("COTACAO-WPP-1.3 — acentos portugueses são preservados", () => {
  assertEquals(
    normalizeTextoPdfPortugues("Pedido de cotação — higienização"),
    "Pedido de cotação — higienização",
  );
});

Deno.test("COTACAO-WPP-1.4 — PNG transparente composto fica branco no canto", () => {
  const logo = new Image(4, 4);
  logo.fill(0x00000000);
  logo.setPixelAt(2, 2, 0xff0000ff);
  const flat = compositeImageOnWhiteBackground(logo);
  const idx = (0 * flat.width + 0) * 4;
  assertEquals(flat.bitmap[idx], 255);
  assertEquals(flat.bitmap[idx + 1], 255);
  assertEquals(flat.bitmap[idx + 2], 255);
});

Deno.test("COTACAO-WPP-1.4 — empresa_config select sem cnpj/cidade", async () => {
  const source = await Deno.readTextFile(new URL(
    "../gestao-os-cotacao-whatsapp-send/index.ts",
    import.meta.url,
  ));
  assertStringIncludes(source, '.select("nome_empresa,site,identidade_site")');
  assertEquals(source.includes("nome_empresa,cnpj,cidade"), false);
});

Deno.test("COTACAO-WPP-1.4 — preview não grava gestao_os_documento", async () => {
  const source = await Deno.readTextFile(new URL(
    "./os-parceiro-whatsapp-envio.ts",
    import.meta.url,
  ));
  assertStringIncludes(source, "/previa/");
  const previewBlock = source.slice(
    source.indexOf("const preview = input.previewOnly"),
    source.indexOf("if (input.previewOnly) {"),
  );
  assertStringIncludes(previewBlock, "if (!preview)");
  assertStringIncludes(previewBlock, 'from("gestao_os_documento").insert');
});

Deno.test("COTACAO-WPP-1.3 — fotos avulsas precedem mensagem final", async () => {
  const source = await Deno.readTextFile(new URL(
    "./os-parceiro-whatsapp-envio.ts",
    import.meta.url,
  ));
  const loop = source.indexOf("for (const foto of fotosComUrl.slice(0, 10))");
  const finalMessage = source.indexOf("interactive_buttons", loop);
  assert(loop > 0);
  assert(finalMessage > loop);
  assertStringIncludes(source.slice(loop, finalMessage), "image_url");
});
