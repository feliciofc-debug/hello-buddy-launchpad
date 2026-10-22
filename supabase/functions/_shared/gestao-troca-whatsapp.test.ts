import {
  assert,
  assertEquals,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  buildGestaoTrocaWaListInteractive,
  classifyGestaoTrocaWhatsAppIntent,
  gestaoTrocaWaInteractiveId,
  gestaoTrocaWaNeutralReply,
  parseGestaoTrocaWaInteractiveId,
  pdfLinesFromTroca,
} from "./gestao-troca-whatsapp.ts";
import {
  gestaoTrocaFotoIsCrlv,
  GESTAO_TROCA_FOTO_ETIQUETA_CRLV,
  normalizeGestaoTrocaFotos,
} from "./gestao-troca-fotos.ts";
import { vehiclePhotoDirectMenuBody } from "./vehicle-photo-direct-menu.ts";
import { parseVehicleIdentification } from "./vehicle-identification.ts";

Deno.test("TROCA-WPP-1 — intenção de trocas avaliadas", () => {
  assert(classifyGestaoTrocaWhatsAppIntent("quais trocas avaliadas?").matches);
  assert(
    classifyGestaoTrocaWhatsAppIntent("veículo analisado na troca").matches,
  );
  const placa = classifyGestaoTrocaWhatsAppIntent("laudo da placa ABC1D23");
  assert(placa.matches);
  assertEquals(placa.filter.placa, "ABC1D23");
});

Deno.test("TROCA-WPP-1 — cliente recebe resposta neutra (sem vazar handler)", () => {
  const neutral = gestaoTrocaWaNeutralReply();
  assert(!neutral.toLowerCase().includes("troca"));
  assert(!neutral.toLowerCase().includes("laudo"));
});

Deno.test("TROCA-WPP-1 — lista interativa com modelo e placa", () => {
  const list = buildGestaoTrocaWaListInteractive([{
    id: "t1",
    marca: "BMW",
    modelo: "320i",
    ano_modelo: 2019,
    placa: "ABC1D23",
    semaforo: "verde",
    laudo_status: "finalizado",
    updated_at: "2026-10-20T12:00:00Z",
  }]);
  assert(list);
  assertEquals(list!.rows[0].title.includes("BMW"), true);
  assert(list!.rows[0].description.includes("ABC1D23"));
  assert(parseGestaoTrocaWaInteractiveId(
    `<<INTERACTIVE_ID:${gestaoTrocaWaInteractiveId("pick:t1")}>>`,
  )?.startsWith("pick:"));
});

Deno.test("TROCA-WPP-1 — CRLV nunca entra nas fotos para WhatsApp", () => {
  const fotos = normalizeGestaoTrocaFotos([
    { path: "a.jpg", etiqueta: "Frente" },
    { path: "crlv.jpg", etiqueta: GESTAO_TROCA_FOTO_ETIQUETA_CRLV },
  ]);
  const picked = fotos.filter((f) => !gestaoTrocaFotoIsCrlv(f));
  assertEquals(picked.some((f) => f.path === "crlv.jpg"), false);
});

Deno.test("TROCA-WPP-1.1 — PDF sem valor_sugerido/teto não mostra R$ 0,00", () => {
  const lines = pdfLinesFromTroca({
    marca: "Ford",
    modelo: "Ka",
    semaforo: "verde",
    valor_sugerido: null,
    teto: null,
  }, [], null);
  const blob = lines.join("\n");
  assert(!blob.includes("R$ 0,00"));
  assert(!blob.includes("Valor sugerido"));
  assert(!blob.includes("Teto:"));
});

Deno.test("TROCA-WPP-1 — descrição da foto não corta palavra no meio", () => {
  const id = parseVehicleIdentification(JSON.stringify({
    marca: "Honda",
    modelo: "City",
    cor: "cinza",
    confianca: "alta",
    pistas_visuais: [
      "Emblema CITY escrito na lateral da porta dianteira do veículo",
    ],
  }));
  const body = vehiclePhotoDirectMenuBody({ identification: id });
  assert(!/\w\.\.\./.test(body), "reticências no meio de palavra");
  assert(!body.endsWith("diant."), "não termina com palavra cortada");
});
