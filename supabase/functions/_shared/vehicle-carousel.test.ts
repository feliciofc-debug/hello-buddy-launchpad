import {
  assert,
  assertEquals,
  assertStringIncludes,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  calculatePhotoFrame,
  frameContainsObject,
} from "./anuncio-photo-framing.ts";
import { buildVehiclePhotoSlide } from "./carousel-templates/vehiclePhoto.ts";
import {
  addVehicleCarouselPhotos,
  blockingVehiclePhotoFlow,
  buildVehicleCarouselSlides,
  expiredAnuncioPendingPatch,
  hasEnoughVehicleCarouselPhotos,
  hasVehicleCarouselData,
  isVehiclePhotoCarouselRequest,
  isVehiclePhotoCarouselTextRequest,
  parseVehicleCarouselData,
  planVehiclePhotoBatch,
  SINGLE_REPEATED_VEHICLE_PHOTO_MESSAGE,
  validPendingVehicleCarousel,
  vehicleCarouselAdStateReset,
  vehicleCarouselCollectionButtons,
  vehicleCarouselDeliveryButtons,
  vehicleCarouselDimensions,
  vehicleCarouselLayout,
  vehicleCarouselNeedMoreButtons,
  vehicleCarouselStartState,
  vehiclePhotoBatchButtons,
  vehiclePhotoBatchNewTopicReset,
  vehiclePhotoBatchOfferMessage,
  vehiclePhotoCaption,
  vehicleSingleRepeatedPhotoButtons,
} from "./vehicle-carousel.ts";

const photos = Array.from({ length: 9 }, (_, index) => ({
  id: `photo-${index + 1}`,
  url: `https://example.com/${index + 1}.jpg`,
}));

Deno.test("três fotos viram capa, conteúdo e página final", () => {
  const slides = buildVehicleCarouselSlides({
    photos: photos.slice(0, 3),
    data: {
      titulo: "Citroën C3 Picasso",
      ano: "2014",
      preco: "R$ 38.900",
      contato: "(21) 99999-0000",
    },
  });
  assertEquals(slides.length, 3);
  assertEquals(slides.map((slide) => slide.type), [
    "cover",
    "content",
    "cta",
  ]);
  assertStringIncludes(slides[0].title, "Citroën C3 Picasso");
  assertEquals(slides[2].body, "(21) 99999-0000");
});

Deno.test("nove fotos preservam a ordem das oito primeiras e avisam uma ignorada", () => {
  const added = addVehicleCarouselPhotos([], photos);
  assertEquals(
    added.photos.map((photo) => photo.id),
    photos.slice(0, 8).map((photo) => photo.id),
  );
  assertEquals(added.ignored, 1);
});

Deno.test("legenda visual usa somente opcionais informados relacionados", () => {
  assertEquals(
    vehiclePhotoCaption("Interior", {
      opcionais: ["bancos em couro", "sensor de estacionamento"],
    }),
    "Interior • bancos em couro",
  );
  assertEquals(
    vehiclePhotoCaption("Painel", { opcionais: ["bancos em couro"] }),
    "Painel",
  );
});

Deno.test("faixa ocupa no máximo 18% e fica separada da foto", () => {
  for (const format of ["portrait", "square"] as const) {
    const layout = vehicleCarouselLayout(format);
    assert(layout.stripHeight / layout.height <= 0.18);
    assertEquals(layout.photoHeight + layout.stripHeight, layout.height);
    assert(layout.fontSize >= 22);

    const tree = buildVehiclePhotoSlide({
      slide: {
        type: "content",
        photo_url: photos[0].url,
        title: "Interior",
        number: 1,
      },
      format,
      photoDataUrl: "data:image/png;base64,AA==",
      totalSlides: 3,
    });
    const children = tree.props.children as Array<Record<string, unknown>>;
    const image = children[0] as { props: { style: Record<string, unknown> } };
    const strip = children[1] as { props: { style: Record<string, unknown> } };
    assertEquals(image.props.style.height, layout.photoHeight);
    assertEquals(strip.props.style.height, layout.stripHeight);
  }
});

Deno.test("enquadramento mantém a caixa do veículo dentro da região da foto", () => {
  const layout = vehicleCarouselLayout("portrait");
  const frame = calculatePhotoFrame({
    sourceWidth: 1200,
    sourceHeight: 900,
    targetWidth: layout.width,
    targetHeight: layout.photoHeight,
    fotoBox: [50, 40, 950, 960],
  });
  assert(frameContainsObject(frame, layout.width, layout.photoHeight));
});

Deno.test("parser não inventa campos ausentes", () => {
  const data = parseVehicleCarouselData(
    "modelo: Onix Premier ano: 2022 câmbio: automático",
  );
  assertEquals(data.titulo, "Onix Premier");
  assertEquals(data.ano, "2022");
  assertEquals(data.cambio, "automático");
  assertEquals(data.preco, undefined);
  assertEquals(data.contato, undefined);
  assertEquals(data.opcionais, undefined);
});

Deno.test("gatilho, TTL, formatos e botões respeitam o fluxo", () => {
  for (
    const spelling of [
      "carrossel",
      "carrosel",
      "carrocel",
      "carossel",
      "carosel",
      "carroussel",
      "carousel",
    ]
  ) {
    assert(isVehiclePhotoCarouselRequest(`quero um ${spelling} do carro`));
  }
  assert(isVehiclePhotoCarouselRequest("álbum de fotos da moto"));
  assert(isVehiclePhotoCarouselRequest("galeria de fotos do veículo"));
  assert(
    !isVehiclePhotoCarouselTextRequest(
      "Carrossel de fotos\n<<INTERACTIVE_ID:vehicle_photo_batch:carousel>>",
    ),
  );
  assert(!isVehiclePhotoCarouselRequest("publique esta foto"));
  assert(hasVehicleCarouselData("modelo: Onix, ano: 2022"));
  assert(
    validPendingVehicleCarousel({
      stage: "collecting",
      photos: [],
      format: "portrait",
      created_at: new Date().toISOString(),
    }),
  );
  assertEquals(vehicleCarouselDimensions("portrait"), {
    width: 1080,
    height: 1350,
  });
  assertEquals(vehicleCarouselDimensions("square"), {
    width: 1080,
    height: 1080,
  });
  assert(vehicleCarouselCollectionButtons().buttons.length <= 3);
  assert(vehicleCarouselDeliveryButtons().buttons.length <= 3);
  assertEquals(vehiclePhotoBatchButtons().buttons.length, 3);
});

Deno.test("pedido na legenda inicia com a própria foto incluída", () => {
  const state = vehicleCarouselStartState(photos.slice(0, 1));
  assertEquals(state.stage, "collecting");
  assertEquals(state.photos.map((photo) => photo.id), ["photo-1"]);
});

Deno.test("pedido de carrossel descarta estados pendentes do anúncio", () => {
  assertEquals(vehicleCarouselAdStateReset(), {
    pending_anuncio_cliente: null,
    pending_anuncio_styles: null,
    pending_anuncio_photo: null,
    pending_anuncio_post: null,
  });
});

Deno.test("quatro fotos em sequência produzem uma única oferta", () => {
  let previous: ReturnType<typeof planVehiclePhotoBatch>["state"] | null = null;
  let offers = 0;
  for (let index = 0; index < 4; index++) {
    const planned = planVehiclePhotoBatch({
      previous,
      recentPhotos: photos.slice(0, index + 1),
      currentPhotoId: photos[index].id,
      hasNewerQueuedPhoto: index < 3,
      now: new Date(1_000 + index),
    });
    previous = planned.state;
    if (planned.shouldOffer) offers++;
  }
  assertEquals(previous?.photos.length, 4);
  assertEquals(previous?.stage, "offered");
  assertEquals(offers, 1);

  const afterOffer = planVehiclePhotoBatch({
    previous,
    recentPhotos: photos.slice(0, 5),
    currentPhotoId: photos[4].id,
  });
  assertEquals(afterOffer.shouldOffer, false);
});

Deno.test("botão do lote transfere exatamente as fotos para o carrossel", () => {
  const batch = planVehiclePhotoBatch({
    recentPhotos: photos.slice(0, 4),
    currentEventId: "wamid-final",
  }).state;
  const carousel = vehicleCarouselStartState(batch.photos);
  assertEquals(
    carousel.photos.map((photo) => photo.id),
    batch.photos.map((photo) => photo.id),
  );
  assertEquals(carousel.photos.length, 4);
  assert(hasEnoughVehicleCarouselPhotos(carousel.photos.length));
});

Deno.test("carrossel aceita duas fotos e oferece adicionar quando faltar", () => {
  assert(hasEnoughVehicleCarouselPhotos(2));
  assert(!hasEnoughVehicleCarouselPhotos(1));
  const prompt = vehicleCarouselNeedMoreButtons(1);
  assertEquals(
    prompt.body,
    "Preciso de pelo menos 2 fotos. Recebi 1 até agora.",
  );
  assertEquals(prompt.buttons.map((button) => button.title), [
    "Adicionar fotos",
    "Cancelar",
  ]);
});

Deno.test("cinco fotos repetidas entram no lote e geram uma única mensagem", () => {
  let previous: ReturnType<typeof planVehiclePhotoBatch>["state"] | null = null;
  let offers = 0;
  for (let index = 0; index < 5; index++) {
    const photo = photos[index];
    const planned = planVehiclePhotoBatch({
      previous,
      recentPhotos: [],
      incomingPhotos: [photo],
      currentEventId: `wamid-${index}`,
      reusedPhotoIds: [photo.id],
      hasNewerQueuedPhoto: index < 4,
      now: new Date(2_000 + index),
    });
    previous = planned.state;
    if (planned.shouldOffer) offers++;
  }
  assertEquals(previous?.photos.length, 5);
  assertEquals(previous?.reused_photo_ids?.length, 5);
  assertEquals(offers, 1);
  assertStringIncludes(
    vehiclePhotoBatchOfferMessage(previous!),
    "Recebi 5 fotos. O que quer fazer?",
  );
});

Deno.test("lote misto informa somente as duas fotos repetidas", () => {
  const planned = planVehiclePhotoBatch({
    recentPhotos: photos.slice(0, 3),
    incomingPhotos: photos.slice(3, 5),
    currentEventId: "wamid-final",
    reusedPhotoIds: photos.slice(3, 5).map((photo) => photo.id),
  });
  assertEquals(planned.state.photos.length, 5);
  assertStringIncludes(
    vehiclePhotoBatchOfferMessage(planned.state),
    "(2 delas você já tinha me mandado antes.)",
  );
});

Deno.test("foto única repetida usa aviso correto e três botões", () => {
  const planned = planVehiclePhotoBatch({
    recentPhotos: [],
    incomingPhotos: [photos[0]],
    currentEventId: "wamid-single",
    reusedPhotoIds: [photos[0].id],
  });
  assertEquals(planned.shouldOffer, false);
  assertEquals(planned.state.reused_photo_ids, ["photo-1"]);
  assertEquals(
    SINGLE_REPEATED_VEHICLE_PHOTO_MESSAGE,
    "Essa foto você já tinha me mandado. Quer usar ela agora?",
  );
  assertEquals(
    vehicleSingleRepeatedPhotoButtons().buttons.map((button) => button.title),
    ["Anúncio", "Carrossel", "Nada agora"],
  );
});

Deno.test("post de anúncio antigo não bloqueia lote e é descartado ao oferecer", () => {
  const now = Date.parse("2026-10-06T14:30:00.000Z");
  const state = {
    pending_anuncio_post: {
      stage: "action",
      created_at: "2026-10-06T14:15:00.000Z",
    },
  };
  assertEquals(blockingVehiclePhotoFlow(state, now), null);
  assertEquals(vehicleCarouselAdStateReset().pending_anuncio_post, null);
  assertEquals(
    vehiclePhotoBatchNewTopicReset().pending_carrossel_veiculo,
    null,
  );
  assertEquals(expiredAnuncioPendingPatch(state, now), {});
  assertEquals(
    expiredAnuncioPendingPatch({
      pending_anuncio_post: {
        stage: "action",
        created_at: "2026-10-06T13:59:00.000Z",
      },
    }, now),
    { pending_anuncio_post: null },
  );
});

Deno.test("somente fluxos recentes que esperam mídia bloqueiam o lote", () => {
  const now = Date.parse("2026-10-06T14:30:00.000Z");
  assertEquals(
    blockingVehiclePhotoFlow({
      pending_carrossel_veiculo: {
        stage: "collecting",
        photos: [],
        format: "portrait",
        created_at: "2026-10-06T14:25:00.000Z",
      },
    }, now),
    "pending_carrossel_veiculo",
  );
  assertEquals(
    blockingVehiclePhotoFlow({
      pending_carrossel_veiculo: {
        stage: "collecting",
        photos: [],
        format: "portrait",
        created_at: "2026-10-06T14:19:00.000Z",
      },
    }, now),
    null,
  );
  assertEquals(
    blockingVehiclePhotoFlow({
      pending_client_logo_intent: {
        created_at: "2026-10-06T14:25:00.000Z",
      },
    }, now),
    "pending_client_logo",
  );
  assertEquals(
    blockingVehiclePhotoFlow({
      pending_fipe: {
        created_at: "2026-10-06T14:29:00.000Z",
      },
    }, now),
    null,
  );
});
