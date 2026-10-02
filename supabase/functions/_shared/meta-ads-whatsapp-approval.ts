export const META_ADS_APPROVAL_TTL_MS = 24 * 60 * 60 * 1000;

export type MetaAdsApprovalContext = {
  owner_phone: string;
  conversation_id: string;
};

export function metaAdsApprovalContext(
  fromNumber: string,
  conversationId?: string,
): MetaAdsApprovalContext {
  return {
    owner_phone: String(fromNumber || "").replace(/\D/g, ""),
    conversation_id: String(conversationId || ""),
  };
}

export function isExactMetaAdsApproval(
  text: unknown,
  senderIsOwner: boolean,
): boolean {
  return senderIsOwner && text === "SIM";
}

export function metaAdsDraftMatchesApproval(
  row: {
    created_at?: string;
    draft_json?: { _whatsapp_approval?: Partial<MetaAdsApprovalContext> };
  },
  expected: MetaAdsApprovalContext,
  now = Date.now(),
): boolean {
  const createdAt = Date.parse(String(row?.created_at || ""));
  const approval = row?.draft_json?._whatsapp_approval;
  return Boolean(
    expected.owner_phone &&
      expected.conversation_id &&
      Number.isFinite(createdAt) &&
      createdAt >= now - META_ADS_APPROVAL_TTL_MS &&
      createdAt <= now &&
      approval?.owner_phone === expected.owner_phone &&
      approval?.conversation_id === expected.conversation_id,
  );
}
