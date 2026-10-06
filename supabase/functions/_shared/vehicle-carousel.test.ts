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
  buildVehicleCarouselSlides,
  hasVehicleCarouselData,
  isVehiclePhotoCarouselRequest,
  parseVehicleCarouselData,
  validPendingVehicleCarousel,
  vehicleCarouselCollectionButtons,
  vehicleCarouselDeliveryButtons,
  vehicleCarouselDimensions,
  vehicleCarouselLayout,
  vehiclePhotoCaption,
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
  assert(isVehiclePhotoCarouselRequest("quero um carrossel de fotos do carro"));
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
});
