import { ownerPhotoReceivedReply } from "./media-received-copy.ts";
import {
  ownerPhotoConfirmButtons,
  ownerProductVisionConfirmMessage,
  ownerRepeatedVisionConfirmMessage,
} from "./owner-photo-confirm.ts";
import { singlePhotoActionButtons } from "./single-photo-flow.ts";

/** Comportamento BASE 61ecb57b — tenant não automotivo (AMZ tradicional). */
export const TRADITIONAL_GENERAL_SINGLE_PHOTO_STAGE = "actions" as const;

export function traditionalGeneralSinglePhotoSnapshot(description: string) {
  return {
    stage: TRADITIONAL_GENERAL_SINGLE_PHOTO_STAGE,
    text: ownerPhotoReceivedReply(description),
    buttonIds: singlePhotoActionButtons().buttons.map((button) => button.id),
    buttonTitles: singlePhotoActionButtons().buttons.map((button) => button.title),
  };
}

/** Revenda automotiva — produto com confirmação (FIX-PUB-1.2). */
export function automotiveProductSinglePhotoSnapshot(
  description: string,
  repeated: boolean,
) {
  return {
    stage: "confirm_vision" as const,
    text: repeated
      ? ownerRepeatedVisionConfirmMessage(description, "produto")
      : ownerProductVisionConfirmMessage(description),
    buttonIds: ownerPhotoConfirmButtons().buttons.map((button) => button.id),
    buttonTitles: ownerPhotoConfirmButtons().buttons.map((button) => button.title),
  };
}
