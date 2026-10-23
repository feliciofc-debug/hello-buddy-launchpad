import { ownerPhotoConfirmedProductTitle } from "./owner-photo-confirm.ts";
import type { OwnerMediaVerticalRoute } from "./owner-media-route.ts";
import { productAdDataPrompt } from "./owner-photo-confirm.ts";

export type OwnerProductPhotoPending = {
  media_id: string;
  stage: "confirm_vision" | "actions" | "ad_data";
  vision_description?: string;
  confirmed_product_title?: string;
  awaiting_correction?: boolean;
  created_at: string;
};

export function ownerProductPhotoPendingFromRoute(input: {
  mediaId: string;
  visionDescription?: string;
  stage: "confirm_vision" | "actions" | "ad_data";
  confirmed?: boolean;
  nowIso?: string;
}): OwnerProductPhotoPending {
  const vision = String(input.visionDescription || "").trim();
  const confirmedTitle = input.confirmed
    ? ownerPhotoConfirmedProductTitle(vision)
    : undefined;
  return {
    media_id: input.mediaId,
    stage: input.stage,
    vision_description: vision || undefined,
    confirmed_product_title: confirmedTitle,
    created_at: input.nowIso ?? new Date().toISOString(),
  };
}

export function ownerProductAdDataReply(
  pending: Pick<
    OwnerProductPhotoPending,
    "confirmed_product_title" | "vision_description"
  >,
): string {
  return productAdDataPrompt(
    pending.confirmed_product_title || pending.vision_description || "",
  );
}

export function ownerMediaRouteLabel(route: OwnerMediaVerticalRoute): string {
  return route;
}
