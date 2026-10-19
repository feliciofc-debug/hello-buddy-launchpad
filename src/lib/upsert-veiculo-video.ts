import type { SupabaseClient } from "@supabase/supabase-js";

export type VeiculoVideoUpsertRow = {
  user_id: string;
  veiculo_id: string;
  video_url: string;
  thumbnail_url?: string | null;
  titulo?: string | null;
  legenda?: string | null;
  duracao_segundos?: number | null;
  tamanho_bytes?: number | null;
  status?: string | null;
  id?: string;
};

/** Dedupe pela URL pública (mesmo índice único do servidor). */
export async function upsertVeiculoVideoByUrl(
  supabase: SupabaseClient,
  row: VeiculoVideoUpsertRow,
): Promise<{ created: boolean }> {
  const { data: existente } = await supabase
    .from("veiculo_videos" as never)
    .select("id")
    .eq("video_url", row.video_url)
    .maybeSingle();

  if (existente?.id) {
    const { error } = await supabase
      .from("veiculo_videos" as never)
      .update({
        titulo: row.titulo,
        legenda: row.legenda,
        duracao_segundos: row.duracao_segundos,
        tamanho_bytes: row.tamanho_bytes,
        thumbnail_url: row.thumbnail_url,
        status: row.status ?? "pronto",
      } as never)
      .eq("id", existente.id);
    if (error) throw error;
    return { created: false };
  }

  const { error } = await supabase.from("veiculo_videos" as never).insert({
    ...row,
    status: row.status ?? "pronto",
  } as never);
  if (error?.code === "23505") return { created: false };
  if (error) throw error;
  return { created: true };
}
