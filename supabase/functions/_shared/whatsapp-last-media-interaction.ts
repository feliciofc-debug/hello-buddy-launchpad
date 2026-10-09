import { deliveredMediaState } from "./ready-media-actions.ts";

export async function rememberDeliveredMediaInteraction(
  supabase: any,
  input: {
    userId: string;
    contactNumber: string;
    mediaId: string;
    at?: string;
  },
): Promise<boolean> {
  const { data: conversation, error: loadError } = await supabase
    .from("whatsapp_cloud_conversations")
    .select("id, agent_state")
    .eq("user_id", input.userId)
    .eq("contact_number", input.contactNumber)
    .order("last_message_at", { ascending: false })
    .limit(1)
    .maybeSingle();
  if (loadError || !conversation?.id) return false;

  const current = conversation.agent_state &&
      typeof conversation.agent_state === "object"
    ? conversation.agent_state
    : {};
  const delivered = deliveredMediaState(
    current,
    input.mediaId,
    input.at || new Date().toISOString(),
  );
  const { error: updateError } = await supabase
    .from("whatsapp_cloud_conversations")
    .update({
      agent_state: delivered.state,
    })
    .eq("id", conversation.id)
    .eq("user_id", input.userId)
    .eq("contact_number", input.contactNumber);
  if (updateError) return false;

  if (delivered.cancelledCarouselToken) {
    const { error: cancelError } = await supabase
      .from("social_posts_queue")
      .update({
        status: "cancelado",
        error_message: "cancelado_por_video_entregue",
        updated_at: new Date().toISOString(),
      })
      .eq("user_id", input.userId)
      .eq("approval_token", delivered.cancelledCarouselToken)
      .eq("status", "aguardando_confirmacao");
    if (cancelError) {
      console.warn(
        "[last-media-interaction] não cancelou preview de carrossel anterior:",
        cancelError.message,
      );
    }
  }
  return true;
}
