import { supabase } from "@/integrations/supabase/client";
import type { Database } from "@/integrations/supabase/types";

type QueueInsert = Database["public"]["Tables"]["social_posts_queue"]["Insert"];

export async function createSocialPostQueueEntry(
  payload: Omit<QueueInsert, "status">,
  publishNow: boolean,
): Promise<string> {
  const { data, error } = await supabase
    .from("social_posts_queue")
    .insert({
      ...payload,
      // O executor só consome "pendente". Publicação direta nasce protegida
      // contra republicação, mesmo se o navegador fechar durante a chamada.
      status: publishNow ? "publicando" : "pendente",
    })
    .select("id")
    .single();
  if (error) throw error;
  return data.id;
}

export async function markSocialPostPublished(
  queueId: string,
  externalPostId?: string | null,
): Promise<void> {
  const { error } = await supabase
    .from("social_posts_queue")
    .update({
      status: "publicado",
      published_at: new Date().toISOString(),
      error_message: null,
      ...(externalPostId ? { fb_post_id: externalPostId } : {}),
    })
    .eq("id", queueId);
  if (error) throw error;
}

export async function markSocialPostFailed(queueId: string, cause: unknown): Promise<void> {
  const message = cause instanceof Error ? cause.message : String(cause || "Erro ao publicar");
  const { error } = await supabase
    .from("social_posts_queue")
    .update({
      status: "erro",
      error_message: message.slice(0, 1000),
    })
    .eq("id", queueId);
  if (error) {
    console.error("[social-post-queue] falha ao registrar erro", { queueId, error });
  }
}
