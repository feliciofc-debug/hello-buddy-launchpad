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
  // Tamanho deliberadamente contido: em 1080px resulta em 38px. O valor
  // anterior (5,2% = 56px) ficava publicitário demais e ampliava a caixa.
  fontsize_ratio: 0.035, // sobre a largura do vídeo
  fontsize_min: 22,
  cor_texto: "#FFFFFF",
  contorno: "#000000",
  contorno_ratio: 0.07,
  caixa: true,
  caixa_cor: "black@0.62",
  caixa_padding_ratio: 0.2,
  pos_y_ratio: 0.8, // centro do bloco a 80% da altura
  max_linhas: 3,
  // Limite conservador que também protege workers antigos, ainda sem medição
  // real por Pillow, contra palavras largas e caixas fora do quadro.
  max_chars_linha: 24,
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

    // 1+2+3. Reciclagem de travados + escolha do próximo job + claim atômico.
    // A ordem é JUSTA entre clientes (round-robin por user_id): um tenant que
    // manda 5 vídeos não empurra os outros para o fim da fila.
    const { data: claimed, error: claimErr } = await supabase
      .rpc("claim_video_render_job", { p_stale_minutos: STALE_MINUTOS })
      .maybeSingle();

    if (claimErr) throw claimErr;
    if (!claimed || !(claimed as any).id) return respJson({ success: true, job: null });

    const job = claimed as any;


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
