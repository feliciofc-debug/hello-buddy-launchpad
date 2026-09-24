type SupabaseClientLike = {
  from: (table: string) => any;
};

type SyncProdutoVideoResult = {
  id: string | null;
  created: boolean;
};

function tituloPorOrigem(origem: string | null): string {
  if (origem === "ia_video_motion") return "Vídeo animado pelo Jarvis";
  if (origem === "video_legendado") return "Vídeo legendado pelo Jarvis";
  if (origem === "whatsapp") return "Vídeo recebido pelo WhatsApp";
  return "Vídeo";
}

/**
 * Projeta um vídeo de midias_whatsapp na biblioteca canônica produto_videos.
 * O arquivo não é copiado: as duas tabelas apontam para a mesma URL.
 */
export async function syncProdutoVideoFromMidia(
  supabase: SupabaseClientLike,
  midiaWhatsappId: string,
): Promise<SyncProdutoVideoResult> {
  const { data: midia, error: midiaError } = await supabase
    .from("midias_whatsapp")
    .select(
      "id, user_id, origem, tipo, midia_url, thumbnail_url, contexto_original, duracao_segundos, tamanho_bytes, created_at",
    )
    .eq("id", midiaWhatsappId)
    .single();

  if (midiaError || !midia) {
    throw new Error(
      `não consegui carregar midias_whatsapp/${midiaWhatsappId}: ${midiaError?.message || "registro ausente"}`,
    );
  }
  if (midia.tipo !== "video" || !midia.midia_url) {
    throw new Error(`midias_whatsapp/${midiaWhatsappId} não é um vídeo válido`);
  }

  const { data: existente, error: existenteError } = await supabase
    .from("produto_videos")
    .select("id")
    .eq("user_id", midia.user_id)
    .eq("midia_whatsapp_id", midia.id)
    .limit(1)
    .maybeSingle();
  if (existenteError) {
    throw new Error(`falha ao consultar produto_videos: ${existenteError.message}`);
  }
  if (existente?.id) return { id: existente.id, created: false };

  const { data: criado, error: insertError } = await supabase
    .from("produto_videos")
    .insert({
      user_id: midia.user_id,
      video_url: midia.midia_url,
      thumbnail_url: midia.thumbnail_url || null,
      titulo: tituloPorOrigem(midia.origem),
      legenda: midia.contexto_original || null,
      duracao_segundos: midia.duracao_segundos ?? null,
      tamanho_bytes: midia.tamanho_bytes ?? null,
      status: "pronto",
      criado_em: midia.created_at,
      origem: midia.origem || "whatsapp",
      midia_whatsapp_id: midia.id,
    })
    .select("id")
    .single();

  // A consulta e o insert podem correr em paralelo em duas entregas. O índice
  // parcial único resolve a corrida; nesse caso o objetivo já foi alcançado.
  if (insertError?.code === "23505") {
    const { data: concorrente } = await supabase
      .from("produto_videos")
      .select("id")
      .eq("user_id", midia.user_id)
      .eq("midia_whatsapp_id", midia.id)
      .limit(1)
      .maybeSingle();
    return { id: concorrente?.id ?? null, created: false };
  }
  if (insertError || !criado?.id) {
    throw new Error(`falha ao inserir produto_videos: ${insertError?.message || "id ausente"}`);
  }

  return { id: criado.id, created: true };
}
