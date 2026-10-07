import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  anuncioCaptionExtraList,
  anuncioFinalApprovalButtons,
  anuncioPostActionButtons,
  anuncioPostFormatButtons,
  anuncioPostNetworkButtons,
  anuncioScheduleApprovalButtons,
  anuncioScheduleTimeButtons,
  canOfferAnuncioPostActions,
  chooseAnuncioPostSource,
  generateVehicleAdCaptions,
  type LastAnuncio,
  parseAnuncioPostRequest,
  shouldBindPostToLastAnuncio,
  validLastAnuncio,
} from "./anuncio-social-flow.ts";

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
  const captions = generateVehicleAdCaptions(lastAnuncio().data);
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
  assertStringIncludes(captions.A, "(21) 96752-0706");
});

Deno.test("fatos ausentes não aparecem na legenda", () => {
  const captions = generateVehicleAdCaptions({
    titulo: "Citroën C3 Picasso",
    cambio: "Automático",
  });
  const text = Object.values(captions).join(" ");
  assert(!text.includes("FIPE"));
  assert(!text.includes("R$"));
  assert(!text.includes("km"));
  assert(!text.includes("garantia"));
});

Deno.test("cada etapa oferece os controles exigidos", () => {
  assertEquals(
    anuncioPostActionButtons().buttons.map((button) => button.title),
    ["Publicar agora", "Agendar", "Só salvar"],
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
