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
  const { error: updateError } = await supabase
    .from("whatsapp_cloud_conversations")
    .update({
      agent_state: {
        ...current,
        last_media_interaction: {
          media_id: input.mediaId,
          at: input.at || new Date().toISOString(),
        },
      },
    })
    .eq("id", conversation.id)
    .eq("user_id", input.userId)
    .eq("contact_number", input.contactNumber);
  return !updateError;
}
