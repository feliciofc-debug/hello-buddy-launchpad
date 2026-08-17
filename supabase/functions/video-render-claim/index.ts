// ============================================================
// video-render-claim
// O worker da VPS chama este endpoint em loop (polling).
// Devolve no máximo 1 job pendente com:
//   - URL assinada para BAIXAR o vídeo original
//   - URL assinada para SUBIR o MP4 legendado
//   - os segmentos de legenda e o estilo de renderização
//
// Auth: header `x-render-token` = secret VPS_RENDER_TOKEN.
// Nenhuma porta é exposta na VPS: só chamadas de saída.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { autorizarWorker, renderCors, respJson } from "../_shared/render-auth.ts";

const BUCKET_SAIDA = "videos";
const STALE_MINUTOS = 15;

/** Estilo da legenda queimada — equivalente ao Canvas do navegador. */
const ESTILO_LEGENDA = {
  // Fonte livre (Bitstream Vera/DejaVu) — redistribuível em imagem Docker e
  // com acentuação completa do português (á à ã â é ê í ó õ ô ú ç).
  font: "DejaVu Sans",
  fontfile: "/usr/share/fonts/truetype/dejavu/DejaVuSans-Bold.ttf",
  bold: true,
  fontsize_ratio: 0.052, // sobre a largura do vídeo
  fontsize_min: 28,
  cor_texto: "#FFFFFF",
  contorno: "#000000",
  contorno_ratio: 0.11,
  caixa: true,
  caixa_cor: "black@0.62",
  caixa_padding_ratio: 0.35,
  pos_y_ratio: 0.8, // centro do bloco a 80% da altura
  max_linhas: 3,
  max_chars_linha: 42,
  // Teto de núcleos do encode — a VPS roda outros dois projetos em produção.
  threads: 3,
};


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: renderCors });

  const auth = autorizarWorker(req);
  if (!auth.ok) return respJson({ success: false, error: auth.motivo }, 401);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // 1. Recicla jobs travados (worker morreu no meio do encode)
    const limite = new Date(Date.now() - STALE_MINUTOS * 60_000).toISOString();
    await supabase
      .from("video_render_jobs")
      .update({ status: "pendente", claimed_at: null })
      .eq("status", "processando")
      .lt("claimed_at", limite);

    // 2. Pega o próximo pendente (FIFO)
    const { data: candidatos, error: selErr } = await supabase
      .from("video_render_jobs")
      .select("*")
      .eq("status", "pendente")
      .lt("tentativas", 3)
      .order("created_at", { ascending: true })
      .limit(1);

    if (selErr) throw selErr;
    if (!candidatos || candidatos.length === 0) {
      return respJson({ success: true, job: null });
    }

    const job = candidatos[0];

    // 3. Claim otimista (só assume se ainda estiver pendente)
    const { data: claimed, error: upErr } = await supabase
      .from("video_render_jobs")
      .update({ status: "processando", claimed_at: new Date().toISOString() })
      .eq("id", job.id)
      .eq("status", "pendente")
      .select()
      .maybeSingle();

    if (upErr) throw upErr;
    if (!claimed) return respJson({ success: true, job: null }); // outro claim ganhou

    // 4. URL assinada de download do original
    const { data: dl, error: dlErr } = await supabase.storage
      .from(job.video_bucket)
      .createSignedUrl(job.video_path, 3600);
    if (dlErr || !dl?.signedUrl) {
      await supabase
        .from("video_render_jobs")
        .update({
          status: "falha_definitiva",
          erro_mensagem: `Não consegui gerar URL do vídeo original: ${dlErr?.message || "desconhecido"}`,
        })
        .eq("id", job.id);
      return respJson({ success: true, job: null });
    }

    // 5. URL assinada de upload do resultado
    const nome = `legendados/${job.user_id}/${job.id}.mp4`;
    const { data: up, error: upSignErr } = await supabase.storage
      .from(BUCKET_SAIDA)
      // upsert: retentativa após o worker morrer entre o upload e o /complete
      // reencontraria o objeto já existente e a URL falharia sem isto.
      .createSignedUploadUrl(nome, { upsert: true });
    if (upSignErr || !up?.signedUrl) throw upSignErr || new Error("upload url falhou");

    return respJson({
      success: true,
      job: {
        id: job.id,
        video_download_url: dl.signedUrl,
        upload: {
          url: up.signedUrl,
          token: up.token,
          bucket: BUCKET_SAIDA,
          path: nome,
          content_type: "video/mp4",
        },
        segmentos: job.segmentos || [],
        formato: job.formato,
        estilo: ESTILO_LEGENDA,
        tentativa: (job.tentativas || 0) + 1,
      },
    });
  } catch (e) {
    console.error("[video-render-claim] erro:", e);
    return respJson({
      success: false,
      error: e instanceof Error ? e.message : "erro desconhecido",
    });
  }
});
