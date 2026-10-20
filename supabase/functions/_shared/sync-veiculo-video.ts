type SupabaseClientLike = {
  from: (table: string) => any;
};

export type SyncVeiculoVideoInput = {
  userId: string;
  veiculoId: string;
  videoUrl: string;
  titulo?: string | null;
  legenda?: string | null;
  duracaoSegundos?: number | null;
  tamanhoBytes?: number | null;
  thumbnailUrl?: string | null;
};

export type SyncVeiculoVideoResult = {
  id: string | null;
  created: boolean;
};

/**
 * Projeta um MP4 concluído na biblioteca veiculo_videos (dedupe por video_url).
 * Não toca produto_videos nem midias_whatsapp.
 */
export async function syncVeiculoVideoFromUrl(
  supabase: SupabaseClientLike,
  input: SyncVeiculoVideoInput,
): Promise<SyncVeiculoVideoResult> {
  const videoUrl = String(input.videoUrl || "").trim();
  if (!videoUrl) throw new Error("video_url obrigatório");

  const { data: existente, error: existenteError } = await supabase
    .from("veiculo_videos")
    .select("id")
    .eq("video_url", videoUrl)
    .limit(1)
    .maybeSingle();
  if (existenteError) {
    throw new Error(`falha ao consultar veiculo_videos: ${existenteError.message}`);
  }
  if (existente?.id) return { id: existente.id, created: false };

  const duracaoNumero = input.duracaoSegundos == null
    ? null
    : Number(input.duracaoSegundos);
  const duracaoInteira = duracaoNumero != null && Number.isFinite(duracaoNumero)
    ? Math.round(duracaoNumero)
    : null;

  const row = {
    user_id: input.userId,
    veiculo_id: input.veiculoId,
    video_url: videoUrl,
    thumbnail_url: input.thumbnailUrl ?? null,
    titulo: input.titulo?.trim() || "Vídeo do veículo",
    legenda: input.legenda?.trim() || null,
    duracao_segundos: duracaoInteira,
    tamanho_bytes: input.tamanhoBytes ?? null,
    status: "pronto",
  };

  const { data: criado, error: insertError } = await supabase
    .from("veiculo_videos")
    .insert(row)
    .select("id")
    .single();

  if (insertError?.code === "23505") {
    const { data: concorrente } = await supabase
      .from("veiculo_videos")
      .select("id")
      .eq("video_url", videoUrl)
      .limit(1)
      .maybeSingle();
    return { id: concorrente?.id ?? null, created: false };
  }
  if (insertError || !criado?.id) {
    throw new Error(
      `falha ao inserir veiculo_videos: ${insertError?.message || "id ausente"}`,
    );
  }
  return { id: criado.id, created: true };
}
