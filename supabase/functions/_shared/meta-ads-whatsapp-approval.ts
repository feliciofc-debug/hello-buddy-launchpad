export type MetaAdsApprovalDraft = {
  id: string;
  status?: string | null;
  aprovado_em?: string | null;
  criado_em: string;
  rascunho?: {
    conversation_id?: string | null;
    solicitante_telefone?: string | null;
  } | null;
};

export type PhonesEquivalent = (
  ownerPhone: string,
  candidatePhone: string,
) => boolean;

export const META_ADS_APPROVAL_MAX_AGE_MS = 24 * 60 * 60 * 1000;

export function isLiteralMetaAdsApproval(message: unknown): boolean {
  return typeof message === "string" &&
    message.trim().toUpperCase() === "SIM";
}

export function latestMetaAdsWhatsappApproval(input: {
  message: unknown;
  isOwner: boolean;
  ownerPhone: string;
  conversationId?: string | null;
  drafts: MetaAdsApprovalDraft[];
  phonesEquivalent: PhonesEquivalent;
  now?: Date;
  maxAgeMs?: number;
}): MetaAdsApprovalDraft | null {
  if (
    !input.isOwner ||
    !isLiteralMetaAdsApproval(input.message) ||
    !input.ownerPhone ||
    !input.conversationId
  ) return null;

  const nowMs = (input.now ?? new Date()).getTime();
  const oldestMs = nowMs -
    (input.maxAgeMs ?? META_ADS_APPROVAL_MAX_AGE_MS);

  return input.drafts
    .filter((draft) => {
      const createdMs = Date.parse(draft.criado_em);
      const draftPhone = String(
        draft.rascunho?.solicitante_telefone ?? "",
      );
      return draft.status === "rascunho" &&
        !draft.aprovado_em &&
        draft.rascunho?.conversation_id === input.conversationId &&
        Boolean(draftPhone) &&
        input.phonesEquivalent(input.ownerPhone, draftPhone) &&
        Number.isFinite(createdMs) &&
        createdMs >= oldestMs &&
        createdMs <= nowMs;
    })
    .sort((left, right) => {
      const byCreated = Date.parse(right.criado_em) -
        Date.parse(left.criado_em);
      return byCreated || right.id.localeCompare(left.id);
    })[0] ?? null;
}
