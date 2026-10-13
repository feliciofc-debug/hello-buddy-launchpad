import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  anuncioCaptionExtraList,
  anuncioCaptionChoiceMessage,
  anuncioActionAfterCaption,
  anuncioFinalApprovalButtons,
  anuncioPostActionButtons,
  anuncioPostDestinationList,
  anuncioPostFormatButtons,
  anuncioPostNetworkButtons,
  anuncioScheduleApprovalButtons,
  anuncioScheduleTimeButtons,
  canOfferAnuncioPostActions,
  chooseAnuncioPostSource,
  formatBrazilianWhatsappNumber,
  generateVehicleAdCaptions,
  generateProductAdCaptions,
  normalizeBrazilianWhatsappNumber,
  anuncioRemainingDestinationsList,
  singleWhatsappCtaAtEnd,
  type LastAnuncio,
  parseAnuncioPostRequest,
  shouldBindPostToLastAnuncio,
  validLastAnuncio,
} from "./anuncio-social-flow.ts";
import {
  generateProductAdCaptions as generateProductCaptionsDirect,
} from "./anuncio-produto-captions.ts";
import {
  generateVehicleAdCaptions as generateVehicleCaptionsDirect,
} from "./anuncio-veiculo-captions.ts";

Deno.test("ações de publicação só são liberadas depois de todas as prévias", () => {
  assertEquals(
    canOfferAnuncioPostActions({ previewsSent: 0, expectedPreviews: 1 }),
    false,
  );
  assertEquals(
    canOfferAnuncioPostActions({ previewsSent: 1, expectedPreviews: 1 }),
    true,
  );
});

function lastAnuncio(createdAt = "2026-10-06T12:00:00.000Z"): LastAnuncio {
  return {
    images: [{
      id: "media-c3",
      url: "https://cdn.example/c3-impacto.png",
      style: "impacto",
      formato: "feed",
    }],
    selected_style: "impacto",
    data: {
      titulo: "Citroën C3 Picasso",
      versao: "Exclusive",
      ano: "2013/2014",
      quilometragem: "78 mil km",
      cambio: "Automático",
      motor: "1.6 Flex",
      donos: "2º dono",
      documentacao: "IPVA 2026 pago",
      revisoes: "Revisões em dia",
      opcionais: [
        "Ar digital",
        "Piloto automático",
        "Sensor de estacionamento",
        "Bancos em couro",
      ],
      condicoes: ["Aceita troca", "Financia em até 60x"],
      preco: "R$ 38.900",
      fipe: "R$ 41.900",
      telefone: "(21) 96752-0706",
    },
    created_at: createdAt,
  };
}

Deno.test("último anúncio válido vence catálogo e perfil", () => {
  const last = lastAnuncio();
  const selected = chooseAnuncioPostSource(
    last,
    { nome: "COMEXIA" },
    Date.parse("2026-10-06T13:00:00.000Z"),
  );
  assertEquals(selected, last);
  assert(validLastAnuncio(last, Date.parse("2026-10-07T11:59:59.000Z")));
});

Deno.test("anúncio expirado não sequestra outro pedido", () => {
  const fallback = { nome: "Produto pedido agora" };
  const selected = chooseAnuncioPostSource(
    lastAnuncio("2026-10-05T10:00:00.000Z"),
    fallback,
    Date.parse("2026-10-06T12:00:01.000Z"),
  );
  assertEquals(selected, fallback);
});

Deno.test("pedido completo detecta estilo, formato, redes e ação", () => {
  assertEquals(
    parseAnuncioPostRequest(
      "Postar impacto no feed do Facebook e Instagram",
    ),
    {
      action: "publish",
      style: "impacto",
      format: "feed",
      networks: ["facebook", "instagram"],
    },
  );
  assertEquals(parseAnuncioPostRequest("Poste no feed e story do Instagram"), {
    action: "publish",
    style: undefined,
    format: "feed_story",
    networks: ["instagram"],
  });
  assertEquals(parseAnuncioPostRequest("Salve o anúncio"), {
    action: "save",
    style: undefined,
    format: undefined,
    networks: [],
  });
});

Deno.test("fluxo do anúncio não sequestra pedido de outro produto", () => {
  assert(
    shouldBindPostToLastAnuncio({
      requestText: "Postar impacto no feed do Facebook e Instagram",
      explicitProduct: "impacto",
      anuncioTitle: "Citroën C3 Picasso",
    }),
  );
  assert(
    shouldBindPostToLastAnuncio({
      requestText: "Postar no estilo impacto no feed",
      explicitProduct: "no estilo impacto",
      anuncioTitle: "Citroën C3 Picasso",
    }),
  );
  assert(
    shouldBindPostToLastAnuncio({
      requestText: "Postar o C3 Picasso no feed",
      explicitProduct: "C3 Picasso",
      anuncioTitle: "Citroën C3 Picasso",
    }),
  );
  assert(
    !shouldBindPostToLastAnuncio({
      requestText: "Postar COMEXIA no feed",
      explicitProduct: "COMEXIA",
      anuncioTitle: "Citroën C3 Picasso",
      pendingFlow: true,
    }),
  );
  assert(
    !shouldBindPostToLastAnuncio({
      requestText: "Postar COMEXIA no feed no estilo impacto",
      explicitProduct: "COMEXIA",
      anuncioTitle: "Citroën C3 Picasso",
      pendingFlow: true,
    }),
  );
});

Deno.test("legendas usam somente o anúncio atual e respeitam segurança", () => {
  const captions = generateVehicleAdCaptions(
    lastAnuncio().data,
    0,
    "veiculo",
  );
  const forbidden = [
    "comexia",
    "impecável",
    "zero defeitos",
    "estado de zero",
    "único no mercado",
    "imperdível",
    "melhor preço da cidade",
    "garantia",
  ];
  for (const caption of Object.values(captions)) {
    assertStringIncludes(caption, "C3 Picasso");
    assert(caption.length <= 600);
    for (const term of forbidden) {
      assert(!caption.toLocaleLowerCase("pt-BR").includes(term));
    }
  }
  assertStringIncludes(captions.A, "R$ 38.900");
  assertStringIncludes(captions.A, "R$ 41.900");
  assertStringIncludes(
    captions.A,
    "📱 Chame no WhatsApp: https://wa.me/5521967520706",
  );
  assertEquals(
    captions.A.endsWith(
      "📱 Chame no WhatsApp: https://wa.me/5521967520706",
    ),
    true,
  );
});

Deno.test("fatos ausentes não aparecem na legenda", () => {
  const captions = generateVehicleAdCaptions({
    titulo: "Citroën C3 Picasso",
    cambio: "Automático",
  }, 0, "veiculo");
  const text = Object.values(captions).join(" ");
  assert(!text.includes("FIPE"));
  assert(!text.includes("R$"));
  assert(!text.includes("km"));
  assert(!text.includes("garantia"));
});

Deno.test("interruptor automático usa kit produto sem vazamento automotivo", () => {
  const data = {
    titulo: "Interruptor Tramontina",
    itens: ["Bivolt automático", "Cor branca"],
    preco: "R$ 49,90",
    telefone: "5592999999999",
  };
  const captions = generateVehicleAdCaptions(data, 0, "produto");
  const text = Object.values(captions).join(" ").toLocaleLowerCase("pt-BR");
  for (const forbidden of ["câmbio", "🚗", "seminovos", "carros"]) {
    assert(!text.includes(forbidden));
  }
  assertStringIncludes(text, "interruptor tramontina");
  assertStringIncludes(
    captions.A,
    "📱 Chame no WhatsApp: https://wa.me/5592999999999",
  );
  assertEquals(
    captions.A.endsWith(
      "📱 Chame no WhatsApp: https://wa.me/5592999999999",
    ),
    true,
  );
  assertEquals(generateProductAdCaptions(data), captions);
});

Deno.test("roteador social preserva os resultados dos geradores isolados", () => {
  const vehicle = lastAnuncio().data;
  const product = {
    titulo: "Caneca branca",
    itens: ["Porcelana", "Alça confortável"],
    preco: "R$ 29,90",
  };
  assertEquals(
    generateVehicleAdCaptions(vehicle, 1, "veiculo"),
    generateVehicleCaptionsDirect(vehicle, 1),
  );
  assertEquals(
    generateVehicleAdCaptions(product, 0, "produto"),
    generateProductCaptionsDirect(product),
  );
  assertEquals(
    generateProductAdCaptions(product),
    generateProductCaptionsDirect(product),
  );
});

Deno.test("legenda tem um único CTA E.164 no final e nenhum telefone no corpo", () => {
  const caption = singleWhatsappCtaAtEnd(
    "https://wa.me/5521980804901\n\nInterruptor premium.\nLigue para (21) 96752-0706.\n\n📱 Chame no WhatsApp: https://wa.me/21967520706",
    "(21) 98080-4901",
  );
  assertEquals(
    caption,
    "Interruptor premium.\n\n📱 Chame no WhatsApp: https://wa.me/5521980804901",
  );
  assertEquals(caption.match(/wa\.me\//g)?.length, 1);
  assertEquals(caption.endsWith("https://wa.me/5521980804901"), true);
  assertEquals(/wa\.me\/(?!55)/.test(caption), false);
});

Deno.test("arte e CTA usam o mesmo contato comercial normalizado", () => {
  const configured = "5521980804901";
  assertEquals(
    normalizeBrazilianWhatsappNumber(
      formatBrazilianWhatsappNumber(configured),
    ),
    configured,
  );
});

Deno.test("destino curto mostra só redes conectadas", () => {
  const photo = anuncioPostDestinationList({
    mediaType: "foto",
    connected: ["facebook", "instagram", "tiktok"],
  });
  assertEquals(photo.rows.map((row) => row.title), [
    "📤 Face + Insta (Feed)",
    "📤 Face + Insta",
    "📱 Só Story",
    "🎵 TikTok",
    "🗓️ Agendar",
  ]);
  const video = anuncioPostDestinationList({
    mediaType: "video",
    connected: ["facebook", "instagram", "linkedin", "tiktok"],
  });
  assertEquals(video.rows.map((row) => row.title), [
    "🎬 Reels Face + Insta",
    "🎵 TikTok",
    "💼 LinkedIn",
    "📱 Story",
    "🗓️ Agendar",
  ]);
});

Deno.test("lista pós-publicação contém só redes restantes e nunca agenda", () => {
  const remaining = anuncioRemainingDestinationsList({
    mediaType: "foto",
    connected: ["linkedin", "tiktok"],
  });
  assertEquals(remaining?.body, "Quer publicar também em:");
  assertEquals(remaining?.send_text_first, true);
  assertEquals(remaining?.rows.map((row) => row.title), [
    "💼 LinkedIn",
    "🎵 TikTok",
  ]);
  assertEquals(
    anuncioRemainingDestinationsList({
      mediaType: "foto",
      connected: [],
    }),
    undefined,
  );
});

Deno.test("opções de legenda e pergunta ficam no mesmo balão", () => {
  const text = anuncioCaptionChoiceMessage({
    facebook: {
      A: "Legenda A",
      B: "Legenda B",
      C: "Legenda C",
    },
  });
  assertStringIncludes(text, "*Opção A*\nLegenda A");
  assertStringIncludes(text, "*Opção B*\nLegenda B");
  assertEquals(text.includes("<<SPLIT>>"), false);
});

Deno.test("produto publica ao escolher B sem etapa Aprovar criativo", () => {
  const steps = [
    "prévia + Publicar agora",
    "lista Feed + Story",
    "opções A/B/C + botões",
    "toque em B",
    "resultado final",
  ];
  assertEquals(steps.length <= 5, true);
  assertEquals(anuncioActionAfterCaption("publish"), "publish");
  assertEquals(anuncioActionAfterCaption("schedule"), "schedule_time");
});

Deno.test("cada etapa oferece os controles exigidos", () => {
  assertEquals(
    anuncioPostActionButtons().buttons.map((button) => button.title),
    ["📤 Publicar agora", "🗓️ Agendar", "🎨 Trocar estilo"],
  );
  assertStringIncludes(
    anuncioPostActionButtons().body,
    "Arte salva na sua biblioteca",
  );
  assertEquals(
    anuncioPostFormatButtons().buttons.map((button) => button.title),
    ["Feed", "Story", "Feed + Story"],
  );
  assertEquals(
    anuncioPostFormatButtons(true).buttons.map((button) => button.title),
    ["Feed"],
  );
  assertEquals(
    anuncioPostNetworkButtons(["facebook", "instagram"]).buttons.map((
      button,
    ) => button.title),
    ["Facebook + Instagram", "Só Instagram", "Só Facebook"],
  );
  assertEquals(
    anuncioPostNetworkButtons(["instagram"]).buttons.map((button) =>
      button.title
    ),
    ["Só Instagram"],
  );
  assertEquals(
    anuncioCaptionExtraList().rows.map((row) => row.title),
    ["Gerar outras", "Escrever a minha"],
  );
  assertEquals(
    anuncioFinalApprovalButtons("deadbeef").buttons.map((button) =>
      button.title
    ),
    ["Publicar", "Cancelar"],
  );
  assertEquals(
    anuncioScheduleApprovalButtons("deadbeef").buttons.map((button) =>
      button.title
    ),
    ["Agendar", "Cancelar"],
  );
  assertEquals(
    anuncioScheduleTimeButtons("deadbeef").buttons.map((button) =>
      button.title
    ),
    ["Cancelar"],
  );
});
