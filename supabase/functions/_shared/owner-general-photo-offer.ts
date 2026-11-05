import { ownerPhotoReceivedReply } from "./media-received-copy.ts";
import {
  ownerPhotoItemSummary,
  ownerProductPhotoReceivedMessage,
} from "./owner-photo-confirm.ts";
import { singlePhotoActionButtons } from "./single-photo-flow.ts";

/** Comportamento BASE 61ecb57b — tenant não automotivo (AMZ tradicional). */
export const TRADITIONAL_GENERAL_SINGLE_PHOTO_STAGE = "actions" as const;

export function traditionalGeneralSinglePhotoSnapshot(description: string) {
  return {
    stage: TRADITIONAL_GENERAL_SINGLE_PHOTO_STAGE,
    text: ownerPhotoReceivedReply(description),
    buttonIds: singlePhotoActionButtons().buttons.map((button) => button.id),
    buttonTitles: singlePhotoActionButtons().buttons.map((button) =>
      button.title
    ),
  };
}

export function automotiveProductPhotoButtons() {
  return {
    body: "Escolha o que fazer com esta foto.",
    buttons: [
      { id: "single_photo:post", title: "Postar nas redes" },
      { id: "single_photo:edit", title: "Editar foto" },
      { id: "single_photo:ad", title: "Criar anúncio" },
    ],
  };
}

/** Revenda automotiva — visão clara de produto segue direto para ações. */
export function automotiveProductSinglePhotoSnapshot(
  description: string,
  _repeated: boolean,
) {
  const buttons = automotiveProductPhotoButtons();
  return {
    stage: "actions" as const,
    text: ownerProductPhotoReceivedMessage(description),
    confirmedProductTitle: ownerPhotoItemSummary(description),
    buttonIds: buttons.buttons.map((button) => button.id),
    buttonTitles: buttons.buttons.map((button) => button.title),
  };
}
