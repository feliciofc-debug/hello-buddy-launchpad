// ============================================================
// cloud-log.ts — registra mensagens OUTBOUND no monitor de conversas
// (whatsapp_cloud_conversations + whatsapp_cloud_messages).
// Usado por whatsapp-send-message e whatsapp-cloud-send-template
// para que campanhas apareçam no Atendimento/Monitor em tempo real.
// Nunca lança erro: log é auditoria, não pode derrubar o envio.
// ============================================================

export function normalizePhoneBR(raw: string): string {
  const only = String(raw || "").replace(/\D/g, "");
  if (!only) return "";
  return only.startsWith("55") ? only : `55${only}`;
}

export async function logOutboundMessage(
  sb: any,
  params: {
    userId: string;
    phone: string;
    content: string;
    messageType?: string;   // text | image | document | template | contacts
    wamid?: string | null;
    sender?: string;        // agent | campanha
    contactName?: string | null;
  }
): Promise<void> {
  try {
    const phone = normalizePhoneBR(params.phone);
    if (!params.userId || !phone) return;

    const now = new Date().toISOString();

    const { data: existing } = await sb
      .from("whatsapp_cloud_conversations")
      .select("id")
      .eq("user_id", params.userId)
      .eq("contact_number", phone)
      .maybeSingle();

    let conversationId = existing?.id as string | undefined;

    if (!conversationId) {
      const { data: created } = await sb
        .from("whatsapp_cloud_conversations")
        .insert({
          user_id: params.userId,
          contact_number: phone,
          contact_name: params.contactName || null,
          status: "active",
          last_message_at: now,
        })
        .select("id")
        .single();
      conversationId = created?.id;
    }

    if (!conversationId) return;

    await sb.from("whatsapp_cloud_messages").insert({
      conversation_id: conversationId,
      user_id: params.userId,
      direction: "outbound",
      sender: params.sender || "campanha",
      content: params.content || "",
      message_type: params.messageType || "text",
      wamid: params.wamid ?? null,
    });

    await sb
      .from("whatsapp_cloud_conversations")
      .update({ last_message_at: now })
      .eq("id", conversationId);
  } catch (e) {
    console.error("[cloud-log] falhou:", (e as Error).message);
  }
}
