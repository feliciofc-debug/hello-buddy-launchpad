import { assertEquals } from "https://deno.land/std@0.224.0/assert/mod.ts";
import {
  isLiteralMetaAdsApproval,
  latestMetaAdsWhatsappApproval,
  type MetaAdsApprovalDraft,
} from "./meta-ads-whatsapp-approval.ts";

const now = new Date("2026-10-02T18:00:00.000Z");
const equivalent = (left: string, right: string) =>
  left.replace(/\D/g, "").slice(-10) === right.replace(/\D/g, "").slice(-10);

function draft(
  id: string,
  created: string,
  conversation = "conversation-1",
  phone = "+55 11 99999-9999",
): MetaAdsApprovalDraft {
  return {
    id,
    status: "rascunho",
    aprovado_em: null,
    criado_em: created,
    rascunho: {
      conversation_id: conversation,
      solicitante_telefone: phone,
    },
  };
}

Deno.test("aceita somente SIM literal normalizado", () => {
  for (const value of ["SIM", " sim ", "Sim"]) {
    assertEquals(isLiteralMetaAdsApproval(value), true);
  }
  for (const value of ["SIM!", "sim por favor", "", null, 1]) {
    assertEquals(isLiteralMetaAdsApproval(value), false);
  }
});

Deno.test("aprovação escolhe deterministicamente o rascunho mais recente", () => {
  const selected = latestMetaAdsWhatsappApproval({
    message: " sim ",
    isOwner: true,
    ownerPhone: "11999999999",
    conversationId: "conversation-1",
    drafts: [
      draft("older", "2026-10-02T16:00:00.000Z"),
      draft(
        "latest",
        "2026-10-02T17:00:00.000Z",
        "conversation-1",
        "5511999999999",
      ),
    ],
    phonesEquivalent: equivalent,
    now,
  });
  assertEquals(selected?.id, "latest");
});

Deno.test("bloqueia não dono, outra conversa, outro telefone e mais de 24h", () => {
  const base = {
    message: "SIM",
    ownerPhone: "11999999999",
    conversationId: "conversation-1",
    phonesEquivalent: equivalent,
    now,
  };
  assertEquals(
    latestMetaAdsWhatsappApproval({
      ...base,
      isOwner: false,
      drafts: [draft("valid", "2026-10-02T17:00:00.000Z")],
    }),
    null,
  );
  assertEquals(
    latestMetaAdsWhatsappApproval({
      ...base,
      isOwner: true,
      drafts: [
        draft("old", "2026-10-01T17:59:59.000Z"),
        draft("conversation", "2026-10-02T17:00:00.000Z", "conversation-2"),
        draft(
          "phone",
          "2026-10-02T17:30:00.000Z",
          "conversation-1",
          "5511888888888",
        ),
      ],
    }),
    null,
  );
});
