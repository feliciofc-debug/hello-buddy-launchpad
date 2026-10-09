import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import satori from "https://esm.sh/satori@0.10.13";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import { Image } from "https://deno.land/x/imagescript@1.3.0/mod.ts";
import { buildAnuncioBrandPlan } from "./anuncio-client-brand.ts";
import { selectAnuncioPhoto } from "./anuncio-photo.ts";
import {
  calculatePhotoFrame,
  frameContainsObject,
  normalizeFotoBox,
  parseFotoBoxFromVisionResponse,
} from "./anuncio-photo-framing.ts";
import { productAdPhotoImprovementPrompt } from "./anuncio-photo-prompt.ts";
import { classifyStoreReply, storeNameFromSite } from "./anuncio-store-flow.ts";
import { buildVehicleAdContent } from "./anuncio-vehicle-details.ts";
import {
  amzAnuncioClientButtons,
  amzMissingClientLogoButtons,
  anuncioSuccessMessage,
  shouldAskAmzAnuncioClient,
} from "./anuncio-tenant-brand.ts";
import { selectRecentOriginalPhoto } from "./anuncio-source-media.ts";
import {
  cleanReceivedMediaDescription,
  recognizedMediaReply,
} from "./media-received-copy.ts";
import {
  isImageCompositionIntent,
  isProductAdCreativeRequest,
  shouldImproveProductAdPhoto,
} from "./image-composition.ts";
import { imageUploadMetadata } from "./image-file-format.ts";
import {
  normalizeImageDataUrl,
  renderableImageDataUrl,
} from "./renderable-image.ts";
import {
  ANUNCIO_FOOTER_BOXES,
  type AnuncioData,
  anuncioSize,
  buildAnuncio,
  contrastRatio,
  readableAccent,
} from "./anuncio-templates/darkGold.ts";
import { buildImpactoAnuncio } from "./anuncio-templates/impacto.ts";
import { buildCatalogoAnuncio } from "./anuncio-templates/catalogo.ts";
import { buildDestaqueAnuncio } from "./anuncio-templates/destaque.ts";
import {
  ANUNCIO_LAYOUT_BOXES,
  type AnuncioEstilo,
} from "./anuncio-templates/premiumLayout.ts";
import {
  anuncioStyleFromText,
  otherAnuncioStyles,
  savedClientAnuncioStyle,
} from "./anuncio-style.ts";

const savedBase = {
  user_id: "tenant-1",
  client_name: "Loja Premium",
  normalized_name: "lojapremium",
};

Deno.test("identidade do anúncio usa logo cadastrada do cliente", () => {
  assertEquals(
    buildAnuncioBrandPlan({
      clientName: "Loja Premium",
      saved: {
        ...savedBase,
        logo_path: "tenant-1/client-brands/logo.png",
        identity: { colors: ["#E30613"] },
      },
    }),
    {
      mode: "client",
      businessName: "Loja Premium",
      logoPath: "tenant-1/client-brands/logo.png",
      colors: ["#E30613"],
    },
  );
});

Deno.test("cliente sem logo usa site informado ou salvo para extração", () => {
  assertEquals(
    buildAnuncioBrandPlan({
      clientName: "Loja Premium",
      saved: { ...savedBase, site_url: "https://loja.example" },
    }),
    {
      mode: "extract_site",
      businessName: "Loja Premium",
      site: "https://loja.example",
    },
  );
});

Deno.test("anúncio escolhe a variante da logo pelo fundo", () => {
  const saved = {
    ...savedBase,
    logo_path: "tenant/default.png",
    identity: {
      logo_fundo_claro_path: "tenant/light.png",
      logo_fundo_escuro_path: "tenant/dark.png",
    },
  };
  const light = buildAnuncioBrandPlan({
    clientName: "Loja Premium",
    saved,
    background: "light",
  });
  const dark = buildAnuncioBrandPlan({
    clientName: "Loja Premium",
    saved,
    background: "dark",
  });
  assert(light.mode === "client" && dark.mode === "client");
  assertEquals(light.logoPath, "tenant/light.png");
  assertEquals(dark.logoPath, "tenant/dark.png");
});

Deno.test("cliente sem logo e sem site bloqueia fallback do tenant", () => {
  assertEquals(
    buildAnuncioBrandPlan({ clientName: "Loja Premium" }),
    { mode: "missing", businessName: "Loja Premium" },
  );
});

Deno.test("anúncio sem cliente mantém identidade do tenant", () => {
  assertEquals(buildAnuncioBrandPlan({}), { mode: "tenant" });
});

function baseData(overrides: Partial<AnuncioData> = {}): AnuncioData {
  return {
    titulo: "SUV PREMIUM",
    itens: [],
    primaryColor: "#8A6A12",
    accentColor: "#E8B93B",
    formato: "feed",
    ...overrides,
  };
}

function flatten(node: unknown): any[] {
  if (!node || typeof node !== "object") return [];
  const current = node as any;
  const children = current.props?.children;
  return [
    current,
    ...(Array.isArray(children)
      ? children.flatMap(flatten)
      : flatten(children)),
  ];
}

Deno.test("campos opcionais ausentes não aparecem no template", () => {
  const nodes = flatten(buildAnuncio(baseData()));
  const text = nodes.map((node) =>
    typeof node.props?.children === "string" ? node.props.children : ""
  ).join(" ");
  assert(!text.includes("FIPE"));
  assert(!text.includes("VALOR"));
  assert(!text.includes("HOJE"));
  assert(!text.includes("2023"));
  assertEquals(
    nodes.some((node) => node.props?.style?.textDecoration === "line-through"),
    false,
  );
});

Deno.test("preço de referência só aparece riscado quando informado", () => {
  const withoutReference = flatten(
    buildAnuncio(baseData({ preco: "R$ 99.900" })),
  );
  assertEquals(
    withoutReference.some((node) =>
      node.props?.style?.textDecoration === "line-through"
    ),
    false,
  );

  const withReference = flatten(buildAnuncio(baseData({
    preco: "R$ 99.900",
    precoLabel: "HOJE",
    precoReferencia: "R$ 110.000",
    precoReferenciaLabel: "FIPE",
    precoReferenciaObs: "sem blindagem",
  })));
  assert(
    withReference.some((node) =>
      node.props?.style?.textDecoration === "line-through"
    ),
  );
});

Deno.test("quatro a oito itens são distribuídos em duas colunas", () => {
  for (const count of [4, 8]) {
    const nodes = flatten(buildAnuncio(baseData({
      itens: Array.from({ length: count }, (_, index) => ({
        texto: `ITEM ${index + 1}`,
      })),
    })));
    assertEquals(
      nodes.filter((node) => node.props?.style?.width === "48%").length,
      count,
    );
  }
});

Deno.test("cor clara do cliente mantém textos legíveis", () => {
  const palette = readableAccent("#FFF59D");
  assert(contrastRatio(palette.textColor, "#08090B") >= 4.5);
  assert(contrastRatio(palette.onAccentColor, palette.detailColor) >= 4.5);
});

Deno.test("cor escura é clareada para contraste mínimo no título", () => {
  const palette = readableAccent("#102030");
  assert(palette.adjusted);
  assert(contrastRatio(palette.textColor, "#08090B") >= 4.5);
});

Deno.test("falha da foto melhorada usa a original", async () => {
  const attempts: string[] = [];
  const selected = await selectAnuncioPhoto({
    preferred: "https://cdn.example/melhorada.jpg",
    original: "https://cdn.example/original.jpg",
    load: async (url) => {
      attempts.push(url);
      return url.includes("original") ? "original-data" : null;
    },
  });
  assertEquals(attempts, [
    "https://cdn.example/melhorada.jpg",
    "https://cdn.example/original.jpg",
  ]);
  assertEquals(selected, { value: "original-data", source: "original" });
});

Deno.test("bytes inválidos da melhorada caem na foto original válida", async () => {
  const original = await fetchJpegPhoto();
  const selected = await selectAnuncioPhoto({
    preferred: "improved",
    original: "original",
    load: (value) =>
      renderableImageDataUrl(
        value === "improved" ? new Uint8Array([1, 2, 3]) : original,
        "foto",
        () => undefined,
      ),
  });
  assertEquals(selected.source, "original");
  assert(selected.value?.startsWith("data:image/jpeg;base64,"));
});

function overlaps(
  first: { x: number; y: number; width: number; height: number },
  second: { x: number; y: number; width: number; height: number },
): boolean {
  return first.x < second.x + second.width &&
    first.x + first.width > second.x &&
    first.y < second.y + second.height &&
    first.y + first.height > second.y;
}

Deno.test("rodapé reserva faixas sem sobrepor logo e contatos", () => {
  assertEquals(
    overlaps(
      ANUNCIO_FOOTER_BOXES.feed.logo,
      ANUNCIO_FOOTER_BOXES.feed.contacts,
    ),
    false,
  );
  assertEquals(
    overlaps(
      ANUNCIO_FOOTER_BOXES.story.logo,
      ANUNCIO_FOOTER_BOXES.story.contacts,
    ),
    false,
  );
});

Deno.test("logo horizontal usa contain e preserva proporção", () => {
  const tree = buildAnuncio(baseData({
    logoDataUrl: "data:image/png;base64,LOGO_HORIZONTAL",
  }));
  const logo = flatten(tree).find((node) =>
    node.type === "img" &&
    node.props?.src === "data:image/png;base64,LOGO_HORIZONTAL"
  );
  assertEquals(logo?.props?.style?.objectFit, "contain");
  assertEquals(logo?.props?.style?.width, "100%");
  assertEquals(logo?.props?.style?.height, "100%");
});

Deno.test("tenant AMZ sem cliente pergunta a loja e botão libera marca AMZ", () => {
  assertEquals(
    shouldAskAmzAnuncioClient({
      tenantId: "amz",
      amzTenantId: "amz",
    }),
    true,
  );
  assertEquals(amzAnuncioClientButtons().buttons, [
    { id: "anuncio_other_store", title: "Informar outra loja" },
    { id: "anuncio_use_amz", title: "Usar marca da AMZ" },
  ]);
  assertEquals(
    amzAnuncioClientButtons().body.includes("Para qual loja"),
    false,
  );
  assertEquals(
    shouldAskAmzAnuncioClient({
      tenantId: "amz",
      amzTenantId: "amz",
      useTenantBrand: true,
    }),
    false,
  );
  assertEquals(
    shouldAskAmzAnuncioClient({
      tenantId: "outro",
      amzTenantId: "amz",
    }),
    false,
  );
});

Deno.test("logo inválida no site oferece envio manual ou marca AMZ sem favicon", () => {
  const buttons = amzMissingClientLogoButtons();
  assertEquals(buttons.buttons, [
    { id: "anuncio_send_client_logo", title: "Enviar logo agora" },
    { id: "anuncio_use_amz", title: "Usar marca da AMZ" },
  ]);
  assert(buttons.buttons.every((button) => button.title.length <= 20));
});

Deno.test("fallback do anúncio escolhe foto original e ignora arte gerada", () => {
  const selected = selectRecentOriginalPhoto({
    nowMs: Date.parse("2026-10-05T18:00:00Z"),
    candidates: [
      {
        id: "arte",
        tipo: "foto",
        origem: "anuncio_produto",
        midia_url: "https://cdn.example/arte-preta.png",
        created_at: "2026-10-05T17:59:00Z",
      },
      {
        id: "jeep",
        tipo: "foto",
        origem: "whatsapp",
        midia_url: "https://cdn.example/jeep.jpg",
        created_at: "2026-10-05T17:40:00Z",
      },
    ],
  });
  assertEquals(selected?.id, "jeep");
});

Deno.test("reenvio deduplicado torna a mesma foto a mais recente", () => {
  const selected = selectRecentOriginalPhoto({
    nowMs: Date.parse("2026-10-05T18:00:00Z"),
    lastInteraction: {
      media_id: "jeep-antigo",
      at: "2026-10-05T17:59:30Z",
    },
    candidates: [
      {
        id: "outra-original",
        tipo: "foto",
        origem: "whatsapp",
        midia_url: "https://cdn.example/outra.jpg",
        created_at: "2026-10-05T17:58:00Z",
      },
      {
        id: "jeep-antigo",
        tipo: "foto",
        origem: "whatsapp",
        midia_url: "https://cdn.example/jeep.jpg",
        created_at: "2026-10-05T14:44:00Z",
      },
    ],
  });
  assertEquals(selected?.id, "jeep-antigo");
});

Deno.test("sem foto original recente o anúncio pede nova foto", () => {
  assertEquals(
    selectRecentOriginalPhoto({
      nowMs: Date.parse("2026-10-05T18:00:00Z"),
      candidates: [{
        id: "arte",
        tipo: "foto",
        origem: "anuncio_produto",
        midia_url: "https://cdn.example/arte.png",
        created_at: "2026-10-05T17:59:00Z",
      }],
    }),
    null,
  );
});

Deno.test("confirmação AMZ é amigável e não vaza instrução interna", () => {
  const message = anuncioSuccessMessage();
  assertEquals(
    message,
    "Pronto! Ficou assim.",
  );
  assert(!/instrucao|enviado ao usuario|diga em/i.test(message));
});

Deno.test("mensagem de mídia reconhecida remove marcador e não corta frase", () => {
  const description = cleanReceivedMediaDescription(
    "[visão] Esta foto real de produto captura um Jeep branco em uma garagem bem iluminada.",
  );
  assertEquals(
    description,
    "Esta foto real de produto captura um Jeep branco em uma garagem bem iluminada.",
  );
  const reply = recognizedMediaReply({ type: "foto", description });
  assert(!reply.includes("[visão]"));
  assert(reply.includes("garagem bem iluminada."));
  assert(!reply.includes(" - ID "));
});

let renderWasmReady: Promise<void> | null = null;

async function fetchJpegPhoto(): Promise<Uint8Array> {
  const response = await fetch(
    "https://images.unsplash.com/photo-1492144534655-ae79c964c9d7?w=1200&fm=jpg&fit=crop",
  );
  assert(response.ok);
  const bytes = new Uint8Array(await response.arrayBuffer());
  assertEquals(imageUploadMetadata(bytes)?.mime, "image/jpeg");
  return bytes;
}

async function renderTemplateWithRealPhoto(
  formato: "feed" | "story",
  photoDataUrl?: string,
): Promise<Image> {
  if (!photoDataUrl) {
    const photoBytes = await fetchJpegPhoto();
    let binary = "";
    for (let offset = 0; offset < photoBytes.length; offset += 8192) {
      binary += String.fromCharCode(
        ...photoBytes.subarray(offset, offset + 8192),
      );
    }
    photoDataUrl = `data:image/jpeg;base64,${btoa(binary)}`;
  }
  const font = await (await fetch(
    "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-700-normal.woff",
  )).arrayBuffer();
  const { width, height } = anuncioSize(formato);
  const tree = buildAnuncio(baseData({
    formato,
    fotoDataUrl: photoDataUrl,
    subtitulo: "AUTOMÁTICO • BLINDADO",
    ano: "2023/2023",
    itens: ["38 MIL KM", "ÚNICO DONO", "REVISADO", "PNEUS NOVOS"].map(
      (texto) => ({ texto }),
    ),
  }));
  const svg = await satori(tree as any, {
    width,
    height,
    fonts: [{ name: "Inter", data: font, weight: 700, style: "normal" }],
  });
  renderWasmReady ??= initWasm(fetch(
    "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm",
  ));
  await renderWasmReady;
  return await Image.decode(
    new Resvg(svg, { fitTo: { mode: "width", value: width } }).render().asPng(),
  );
}

function regionDeviation(
  image: Image,
  box: { x: number; y: number; width: number; height: number },
): number {
  const values: number[] = [];
  const step = 12;
  for (let y = box.y; y < box.y + box.height; y += step) {
    for (let x = box.x; x < box.x + box.width; x += step) {
      const offset = (y * image.width + x) * 4;
      values.push(
        image.bitmap[offset] * 0.2126 +
          image.bitmap[offset + 1] * 0.7152 +
          image.bitmap[offset + 2] * 0.0722,
      );
    }
  }
  const mean = values.reduce((sum, value) => sum + value, 0) / values.length;
  return Math.sqrt(
    values.reduce((sum, value) => sum + (value - mean) ** 2, 0) /
      values.length,
  );
}

Deno.test("JPEG rotulado como PNG usa MIME real e permanece visível", async () => {
  const jpeg = await fetchJpegPhoto();
  let binary = "";
  for (let offset = 0; offset < jpeg.length; offset += 8192) {
    binary += String.fromCharCode(...jpeg.subarray(offset, offset + 8192));
  }
  const normalized = await normalizeImageDataUrl(
    `data:image/png;base64,${btoa(binary)}`,
    "foto",
  );
  assert(normalized?.startsWith("data:image/jpeg;base64,"));
  const feed = await renderTemplateWithRealPhoto("feed", normalized!);
  const story = await renderTemplateWithRealPhoto("story", normalized!);
  assert(
    regionDeviation(feed, { x: 140, y: 270, width: 800, height: 340 }) > 12,
  );
  assert(
    regionDeviation(story, { x: 140, y: 380, width: 800, height: 620 }) > 12,
  );
});

Deno.test("WEBP é convertido para PNG renderizável", async () => {
  const response = await fetch("https://www.gstatic.com/webp/gallery/1.webp");
  assert(response.ok);
  const normalized = await renderableImageDataUrl(
    new Uint8Array(await response.arrayBuffer()),
    "foto",
  );
  assert(normalized?.startsWith("data:image/png;base64,"));
  const bytes = Uint8Array.from(
    atob(normalized!.split(",")[1]),
    (character) => character.charCodeAt(0),
  );
  const decoded = await Image.decode(bytes);
  assert(decoded.width > 1 && decoded.height > 1);
});

Deno.test("upload usa MIME e extensão detectados nos bytes", () => {
  const mislabeledJpeg = Uint8Array.from([0xff, 0xd8, 0xff, 0xe0]);
  assertEquals(imageUploadMetadata(mislabeledJpeg, "image/png"), {
    mime: "image/jpeg",
    extension: "jpg",
  });
});

Deno.test("arte de produto tem prioridade e respeita foto sem melhoria", () => {
  const request =
    "Monta a arte desse carro: Jeep Compass. Usa a foto como está";
  assert(isProductAdCreativeRequest(request));
  assertEquals(isImageCompositionIntent(request), false);
  assertEquals(shouldImproveProductAdPhoto(request), false);
  assertEquals(
    shouldImproveProductAdPhoto(
      "Monta um anúncio desse carro e melhora a foto",
    ),
    true,
  );
});

Deno.test("melhoria do anúncio preserva o estado real do veículo", () => {
  const prompt = productAdPhotoImprovementPrompt("Jeep Compass");
  for (
    const expected of [
      "Mude SOMENTE o fundo/ambiente e a iluminação",
      "mesma pintura e o mesmo brilho real",
      "arranhões, amassados, manchas, desgastes e sujeira",
      "Não remova, não corrija, não adicione e não troque nada no veículo",
    ]
  ) {
    assert(prompt.includes(expected));
  }
});

const premiumBuilders = {
  impacto: buildImpactoAnuncio,
  catalogo: buildCatalogoAnuncio,
  destaque: buildDestaqueAnuncio,
};

Deno.test("templates mantêm todas as caixas de texto fora do veículo", () => {
  for (const style of Object.keys(premiumBuilders) as AnuncioEstilo[]) {
    for (const format of ["feed", "story"] as const) {
      const layout = ANUNCIO_LAYOUT_BOXES[style][format];
      for (const textBox of layout.text) {
        assertEquals(overlaps(layout.vehicle, textBox), false);
      }
    }
  }
});

Deno.test("foto 4:3 mantém caixa alta inteira dentro do Catálogo feed", () => {
  const target = ANUNCIO_LAYOUT_BOXES.catalogo.feed.vehicle;
  const plan = calculatePhotoFrame({
    sourceWidth: 1200,
    sourceHeight: 900,
    targetWidth: target.width,
    targetHeight: target.height,
    fotoBox: [50, 80, 950, 920],
  });
  assertEquals(plan.mode, "box");
  assert(frameContainsObject(plan, target.width, target.height));
  assert(plan.transformedBox);
  assert(plan.transformedBox.y >= 0);
  assert(plan.transformedBox.y + plan.transformedBox.height <= target.height);
});

Deno.test("enquadramento medido contém o veículo em todos os estilos e formatos", () => {
  for (const style of Object.keys(ANUNCIO_LAYOUT_BOXES) as AnuncioEstilo[]) {
    for (const format of ["feed", "story"] as const) {
      const target = ANUNCIO_LAYOUT_BOXES[style][format].vehicle;
      const plan = calculatePhotoFrame({
        sourceWidth: 1200,
        sourceHeight: 900,
        targetWidth: target.width,
        targetHeight: target.height,
        fotoBox: [50, 80, 950, 920],
      });
      assertEquals(plan.mode, "box", `${style}/${format}`);
      assert(
        frameContainsObject(plan, target.width, target.height),
        `${style}/${format}`,
      );
    }
  }
});

Deno.test("foto sem caixa ou com caixa inválida usa contain", () => {
  for (const fotoBox of [undefined, [-1, 20, 800, 900], [500, 20, 100, 900]]) {
    const plan = calculatePhotoFrame({
      sourceWidth: 1200,
      sourceHeight: 900,
      targetWidth: 984,
      targetHeight: 420,
      fotoBox,
    });
    assertEquals(plan.mode, "contain");
    assert(plan.resizedWidth <= 984);
    assert(plan.resizedHeight <= 420);
  }
  assertEquals(normalizeFotoBox([50, 80, 950, 920]), {
    ymin: 50,
    xmin: 80,
    ymax: 950,
    xmax: 920,
  });
});

Deno.test("parser valida box_2d e conferência rejeita corte", () => {
  assertEquals(
    parseFotoBoxFromVisionResponse(
      '```json\n{"box_2d":[50,80,950,920]}\n```',
    ),
    { ymin: 50, xmin: 80, ymax: 950, xmax: 920 },
  );
  assertEquals(
    parseFotoBoxFromVisionResponse('{"box_2d":[0,0,1200,900]}'),
    null,
  );
  assertEquals(
    frameContainsObject(
      {
        mode: "box",
        resizedWidth: 1200,
        resizedHeight: 900,
        x: -100,
        y: 0,
        transformedBox: { x: -4, y: 10, width: 900, height: 390 },
      },
      984,
      420,
    ),
    false,
  );
});

Deno.test("template usa fill só para foto já composta e contain como fallback", () => {
  const composed = flatten(buildCatalogoAnuncio(baseData({
    fotoDataUrl: "data:image/png;base64,COMPOSTA",
    fotoPrecomposed: true,
  }))).find((node) => node.props?.src === "data:image/png;base64,COMPOSTA");
  const fallback = flatten(buildCatalogoAnuncio(baseData({
    fotoDataUrl: "data:image/png;base64,ORIGINAL",
  }))).find((node) => node.props?.src === "data:image/png;base64,ORIGINAL");
  assertEquals(composed?.props?.style?.objectFit, "fill");
  assertEquals(fallback?.props?.style?.objectFit, "contain");
});

Deno.test("site sozinho fornece nome e nome sozinho pergunta site uma vez", () => {
  assertEquals(
    storeNameFromSite("https://lojaexemplo.com.br", "Loja Exemplo | Veículos"),
    "Loja Exemplo | Veículos",
  );
  assertEquals(
    classifyStoreReply({
      text: "https://lojaexemplo.com.br",
      site: "https://lojaexemplo.com.br",
    }),
    {
      action: "site",
      site: "https://lojaexemplo.com.br",
      name: null,
    },
  );
  assertEquals(classifyStoreReply({ text: "Loja Exemplo" }), {
    action: "ask_site",
    name: "Loja Exemplo",
  });
  assertEquals(
    classifyStoreReply({
      text: "não",
      storedName: "Loja Exemplo",
      askedSite: true,
    }),
    {
      action: "name_only",
      name: "Loja Exemplo",
    },
  );
  assertEquals(
    classifyStoreReply({
      text: "AMZ Ofertas, site amzofertas.com.br",
      site: "https://amzofertas.com.br",
    }),
    {
      action: "site",
      site: "https://amzofertas.com.br",
      name: "AMZ Ofertas",
    },
  );
  assertEquals(
    classifyStoreReply({
      text: "o site da Loja X é lojax.com.br",
      site: "https://lojax.com.br",
    }),
    {
      action: "site",
      site: "https://lojax.com.br",
      name: "Loja X",
    },
  );
});

Deno.test("14 dados viram no máximo 8 destaques e o restante fica na ficha", () => {
  const supplied = {
    versao: "Longitude",
    motor: "2.0 Turbo",
    cambio: "Automático",
    quilometragem: "38 mil km",
    cor: "Preto",
    donos: "Único dono",
    documentacao: "IPVA pago",
    revisoes: "Revisado",
    pneus: "Pneus novos",
    opcionais: ["Blindado", "Teto solar", "Banco em couro"],
    condicoes: ["Aceita troca", "Financia"],
    itens: ["Chave reserva"],
  };
  const content = buildVehicleAdContent(supplied);
  assertEquals(content.highlights.length, 8);
  assert(content.ficha.length > 0);
  const delivered = [...content.highlights, ...content.ficha];
  for (
    const value of [
      supplied.motor,
      supplied.cambio,
      supplied.quilometragem,
      supplied.cor,
      supplied.donos,
      supplied.documentacao,
      supplied.revisoes,
      supplied.pneus,
      ...supplied.opcionais,
      ...supplied.condicoes,
      ...supplied.itens,
    ]
  ) {
    assert(
      delivered.some((item) =>
        item.toLocaleUpperCase("pt-BR") === value.toLocaleUpperCase("pt-BR")
      ),
      value,
    );
  }
  assertEquals(content.subtitle, "Longitude • 2.0 Turbo");
});

Deno.test("Ficha separa vírgulas e padroniza itens em maiúsculas", () => {
  const content = buildVehicleAdContent({
    quilometragem: "38 mil km",
    cambio: "Automático",
    motor: "2.0 Turbo",
    documentacao: "IPVA 2026 pago, licenciado 2026",
    cor: "preto",
    itens: ["item muito longo para sair dos destaques"],
  });
  assert(content.ficha.includes("ITEM MUITO LONGO PARA SAIR DOS DESTAQUES"));
  const delivered = [...content.highlights, ...content.ficha];
  assert(delivered.some((item) => item.toUpperCase() === "IPVA 2026 PAGO"));
  assert(delivered.some((item) => item.toUpperCase() === "LICENCIADO 2026"));
});

Deno.test("três dados informados produzem somente três destaques", () => {
  const content = buildVehicleAdContent({
    quilometragem: "40 mil km",
    cambio: "Automático",
    motor: "1.3 Turbo",
  });
  assertEquals(content.highlights, ["40 mil km", "Automático", "1.3 Turbo"]);
  assertEquals(content.ficha, []);
});

Deno.test("logo quadrada mostra nome e logo horizontal não repete", () => {
  const iconNodes = flatten(buildCatalogoAnuncio(baseData({
    logoDataUrl: "data:image/png;base64,ICONE",
    logoIsIcon: true,
    businessName: "AMZ Ofertas",
  })));
  assert(iconNodes.some((node) => node.props?.children === "AMZ Ofertas"));
  const icon = iconNodes.find((node) =>
    node.props?.src === "data:image/png;base64,ICONE"
  );
  assertEquals(icon?.props?.style?.width, 72);

  const horizontalNodes = flatten(buildCatalogoAnuncio(baseData({
    logoDataUrl: "data:image/png;base64,HORIZONTAL",
    logoIsIcon: false,
    businessName: "AMZ Ofertas",
  })));
  assertEquals(
    horizontalNodes.some((node) => node.props?.children === "AMZ Ofertas"),
    false,
  );
});

Deno.test("Destaque mantém tarja do preço compacta após seis itens longos", () => {
  const nodes = flatten(buildDestaqueAnuncio(baseData({
    accentColor: "#F36812",
    preco: "R$ 118.900",
    ficha: ["Manual e chave reserva"],
    itens: Array.from(
      { length: 6 },
      (_, index) => ({ texto: `Destaque longo ${index + 1}` }),
    ),
  })));
  const stripe = nodes.find((node) =>
    node.props?.style?.backgroundColor === "#F36812" &&
    node.props?.style?.alignSelf === "flex-end"
  );
  assertEquals(stripe?.props?.style?.maxWidth, "45%");
  assertEquals(stripe?.props?.style?.padding, "12px 24px 12px 28px");
  assertEquals(stripe?.props?.style?.marginLeft, undefined);
  const itemNodes = nodes.filter((node) =>
    typeof node.props?.children === "string" &&
    node.props.children.startsWith("DESTAQUE LONGO")
  );
  assert(itemNodes.every((node) => Number(node.props?.style?.fontSize) >= 16));
  assert(
    nodes.some((node) =>
      String(node.props?.children || "").startsWith("Ficha:")
    ),
  );
  const fichaNode = nodes.find((node) =>
    String(node.props?.children || "").startsWith("Ficha:")
  );
  assertEquals(fichaNode?.props?.style?.width, "55%");
});

Deno.test("Catálogo usa fundo branco e selo do ano legível", () => {
  const nodes = flatten(buildCatalogoAnuncio(baseData({
    ano: "2021/2022",
    accentColor: "#F36812",
  })));
  assert(
    nodes.some((node) => node.props?.style?.backgroundColor === "#FFFFFF"),
  );
  const badge = nodes.find((node) => node.props?.children === "2021/2022");
  assertEquals(badge?.props?.style?.color, "#111113");
  assertEquals(badge?.props?.style?.backgroundColor, "transparent");
  assertEquals(badge?.props?.style?.border, "3px solid #F36812");
});

Deno.test("templates omitem campos ausentes e preço nunca quebra linha", () => {
  for (const builder of Object.values(premiumBuilders)) {
    const absent = flatten(builder(baseData()));
    const content = absent.map((node) =>
      typeof node.props?.children === "string" ? node.props.children : ""
    ).join(" ");
    assert(!content.includes("FIPE"));
    assert(!content.includes("HOJE"));

    const priced = flatten(builder(baseData({
      preco: "R$ 123.456,78",
      precoLabel: "HOJE",
    })));
    const priceNode = priced.find((node) =>
      node.props?.children === "R$ 123.456,78"
    );
    assertEquals(priceNode?.props?.style?.whiteSpace, "nowrap");
  }
});

Deno.test("os três templates renderizam a foto em feed e story", async () => {
  const jpeg = await fetchJpegPhoto();
  const photoDataUrl = await renderableImageDataUrl(jpeg, "foto");
  const font = await (await fetch(
    "https://cdn.jsdelivr.net/npm/@fontsource/inter@4.5.15/files/inter-latin-700-normal.woff",
  )).arrayBuffer();
  renderWasmReady ??= initWasm(fetch(
    "https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm",
  ));
  await renderWasmReady;

  for (const style of Object.keys(premiumBuilders) as AnuncioEstilo[]) {
    for (const format of ["feed", "story"] as const) {
      const { width, height } = anuncioSize(format);
      const tree = premiumBuilders[style](baseData({
        formato: format,
        fotoDataUrl: photoDataUrl,
        subtitulo: "AUTOMÁTICO • BLINDADO",
        preco: "R$ 99.900",
        ano: "2023",
      }));
      const svg = await satori(tree as any, {
        width,
        height,
        fonts: [{ name: "Inter", data: font, weight: 700, style: "normal" }],
      });
      const rendered = await Image.decode(
        new Resvg(svg, { fitTo: { mode: "width", value: width } }).render()
          .asPng(),
      );
      const vehicle = ANUNCIO_LAYOUT_BOXES[style][format].vehicle;
      assert(regionDeviation(rendered, vehicle) > 10);
    }
  }
});

Deno.test("estilo explícito e preferência do cliente são reutilizados", () => {
  assertEquals(anuncioStyleFromText("monta no estilo catálogo"), "catalogo");
  assertEquals(
    savedClientAnuncioStyle({
      ...savedBase,
      identity: { preferred_ad_style: "impacto" },
    }),
    "impacto",
  );
  assertEquals(otherAnuncioStyles("impacto"), ["catalogo", "destaque"]);
});
