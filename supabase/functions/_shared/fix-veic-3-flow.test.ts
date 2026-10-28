import { assert, assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import { anuncioPostDestinationList } from "./anuncio-social-flow.ts";
import {
  inboundHasInteractiveId,
  shouldSkipOwnerMediaTextHeuristics,
} from "./vehicle-flow-interactive-guard.ts";
import { isMetaAdsQuestionarioCancel } from "./meta-ads-questionario.ts";
import { vehiclePhotoActionId } from "./vehicle-photo-direct-menu.ts";
import { blockGerarImagemForVehiclePhotoFlow } from "./vehicle-photo-ad-wa.ts";

Deno.test("FIX-VEIC-3 B1 — toque em vehicle_photo_action pula heurísticas", () => {
  const tap =
    `Criar arte\n<<INTERACTIVE_ID:${vehiclePhotoActionId("ad")}>>`;
  assert(inboundHasInteractiveId(tap));
  assert(shouldSkipOwnerMediaTextHeuristics(tap));
});

Deno.test("FIX-VEIC-3 B3 — destinos de FOTO não incluem TikTok", () => {
  const list = anuncioPostDestinationList({
    mediaType: "foto",
    connected: ["facebook", "instagram", "linkedin", "tiktok"],
  });
  const ids = list.rows.map((r) => r.id);
  assertEquals(ids.some((id) => id.includes("tiktok")), false);
});

Deno.test("FIX-VEIC-3 B4 — cancelar campanha no questionário", () => {
  assert(isMetaAdsQuestionarioCancel("cancelar campanha"));
});

Deno.test("FIX-VEIC-3 B2 — gerar_imagem bloqueado no fluxo foto veículo", () => {
  assert(blockGerarImagemForVehiclePhotoFlow({
    pending_vehicle_identification: {
      media_ids: ["m1"],
      created_at: new Date().toISOString(),
    },
  }));
});
