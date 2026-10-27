import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  bindAnuncioMediaToArgs,
  resolveAnuncioMediaId,
  staleVehicleMediaContextPatch,
  vehicleIdentificationBundleForMedia,
} from "./anuncio-media-context.ts";
import {
  parseVehiclePhotoActionInteractive,
  vehiclePhotoActionId,
  vehiclePhotoDirectActionList,
} from "./vehicle-photo-direct-menu.ts";
import { vehiclePhotoAdMediaId } from "./vehicle-photo-ad-wa.ts";
import { resolveVehiclePhotoActionContext } from "./vehicle-photo-action-context.ts";
import { parseVehicleIdentification } from "./vehicle-identification.ts";

const MEDIA_A = "11111111-1111-4111-8111-111111111111";
const MEDIA_B = "22222222-2222-4222-8222-222222222222";
const NOW = Date.parse("2026-10-27T16:00:00.000Z");

const hondaId = parseVehicleIdentification(JSON.stringify({
  marca: "Honda",
  modelo: "City",
  confianca: "alta",
}))!;
const kwidId = parseVehicleIdentification(JSON.stringify({
  marca: "Renault",
  modelo: "Kwid",
  confianca: "alta",
}))!;

Deno.test("ANUNCIO-1 — pending velho (Honda) não vence Kwid explícito", () => {
  const agentState = {
    pending_vehicle_identification: {
      identification: hondaId,
      media_ids: [MEDIA_A],
      target: "single_ad" as const,
      confirmed: true,
      confirmed_title: "Honda City",
      created_at: "2026-10-20T12:00:00.000Z",
    },
    last_vehicle_photo_context: {
      identification: hondaId,
      media_ids: [MEDIA_A],
      target: "single_ad" as const,
      created_at: "2026-10-20T12:00:00.000Z",
    },
    last_media_interaction: {
      media_id: MEDIA_B,
      at: "2026-10-27T15:55:00.000Z",
    },
  };
  assertEquals(
    resolveAnuncioMediaId({
      agentState,
      explicitMediaId: MEDIA_B,
      nowMs: NOW,
    }),
    MEDIA_B,
  );
  const bundle = vehicleIdentificationBundleForMedia({
    agentState: {
      ...agentState,
      vertical_router: {
        media_routes: {
          [MEDIA_B]: {
            vehicle_identification: kwidId,
            vehicle_media_ids: [MEDIA_B],
            confirmed: true,
            confirmed_product_title: "Renault Kwid",
          },
        },
      },
    },
    mediaId: MEDIA_B,
    nowMs: NOW,
  });
  assertEquals(bundle?.confirmed_title, "Renault Kwid");
  assertEquals(
    vehiclePhotoAdMediaId(agentState, MEDIA_B),
    MEDIA_B,
  );
});

Deno.test("ANUNCIO-1 — botão da lista carrega media_id no ID interativo", () => {
  const list = vehiclePhotoDirectActionList(kwidId, { mediaId: MEDIA_A });
  const adRow = list.rows.find((row) =>
    row.id.startsWith("vehicle_photo_action:ad:")
  )!;
  assertEquals(adRow.id, vehiclePhotoActionId("ad", MEDIA_A));
  const parsed = parseVehiclePhotoActionInteractive(
    `Tap\n<<INTERACTIVE_ID:${adRow.id}>>`,
  );
  assertEquals(parsed, { action: "ad", mediaId: MEDIA_A });
});

Deno.test("ANUNCIO-1 — contexto salvo sem TTL não recupera Honda antigo", () => {
  const context = resolveVehiclePhotoActionContext({
    pending: null,
    saved: {
      identification: hondaId,
      media_ids: [MEDIA_A],
      target: "single_ad",
      created_at: "2026-10-20T12:00:00.000Z",
    },
    lastMediaId: MEDIA_A,
    lastMediaInteraction: {
      media_id: MEDIA_A,
      at: "2026-10-20T12:00:00.000Z",
    },
    nowMs: NOW,
  });
  assertEquals(context, null);
});

Deno.test("ANUNCIO-1 — saneamento limpa estado vencido no turno", () => {
  const patch = staleVehicleMediaContextPatch({
    pending_vehicle_identification: {
      created_at: "2026-10-20T12:00:00.000Z",
    },
    last_media_interaction: {
      media_id: MEDIA_A,
      at: "2026-10-20T12:00:00.000Z",
    },
  }, NOW);
  assertEquals(patch.pending_vehicle_identification, null);
  assertEquals(patch.last_media_interaction, null);
});

Deno.test("ANUNCIO-1 — bindAnuncioMediaToArgs fixa mídia no pending", () => {
  assertEquals(
    bindAnuncioMediaToArgs({ titulo: "Kwid", preco: "45900" }, MEDIA_B)
      ._anuncio_media_id,
    MEDIA_B,
  );
});
