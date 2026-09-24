// ============================================================
// video-motion-complete
// O worker Remotion da VPS avisa o fim do render (sucesso ou erro).
// Sucesso: guarda o MP4, entrega no WhatsApp quando o pedido veio de lá
// e deixa AGUARDANDO APROVAÇÃO se o cliente escolheu plataformas.
// Nunca publica automaticamente.
//
// Auth: header `x-render-token` = secret VPS_RENDER_TOKEN.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { autorizarWorker, renderCors, respJson } from "../_shared/render-auth.ts";
import { linhaCodigoMidia } from "../_shared/publicacao-por-id.ts";
import { syncProdutoVideoFromMidia } from "../_shared/sync-produto-video.ts";

const MAX_TENTATIVAS = 3;

async function avisarCliente(supabase: any, job: any, message: string, videoUrl?: string) {
  if (!job.telefone) return;
  try {
    await supabase.functions.invoke("whatsapp-send-message", {
      body: {
        user_id: job.user_id,
        to: job.telefone,
        message,
        ...(videoUrl ? { video_url: videoUrl } : {}),
      },
    });
  } catch (e) {
    console.error("[video-motion-complete] aviso WhatsApp falhou:", e);
  }
}

async function registrarVideoNaBiblioteca(supabase: any, job: any, videoUrl: string, duracao?: number | null): Promise<string> {
  const { data: existente } = await supabase
    .from("midias_whatsapp")
    .select("id")
    .eq("user_id", job.user_id)
    .eq("midia_url", videoUrl)
    .limit(1)
    .maybeSingle();
  if (existente?.id) return existente.id;

  const contexto = [job.titulo, job.legenda_post].filter(Boolean).join("\n\n").slice(0, 1500);
  const duracaoNumero = duracao == null ? Number.NaN : Number(duracao);
  const duracaoInteira = Number.isFinite(duracaoNumero) ? Math.round(duracaoNumero) : null;
  const { data, error } = await supabase
    .from("midias_whatsapp")
    .insert({
      user_id: job.user_id,
      origem: "ia_video_motion",
      telefone_origem: job.telefone || null,
      tipo: "video",
      midia_url: videoUrl,
      mime_type: "video/mp4",
      duracao_segundos: duracaoInteira,
      contexto_original: contexto || "Vídeo animado",
      status: "pendente",
    })
    .select("id")
    .single();
  if (error || !data?.id) throw new Error(`não consegui registrar o vídeo animado em /midias: ${error?.message || "id ausente"}`);
  return data.id;
}

async function sincronizarAreaDeVideos(supabase: any, midiaId: string): Promise<void> {
  try {
    await syncProdutoVideoFromMidia(supabase, midiaId);
  } catch (e) {
    console.error(
      "[video-motion-complete] sincronização com produto_videos falhou; mantendo vídeo concluído:",
      e instanceof Error ? e.message : String(e),
    );
  }
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: renderCors });

  const auth = autorizarWorker(req);
  if (!auth.ok) return respJson({ success: false, error: auth.motivo }, 401);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const body = await req.json();
    const { job_id, success: renderOk, resultado_bucket, resultado_path, duracao_segundos, erro, redeliver } =
      body || {};
    if (!job_id) throw new Error("job_id obrigatório");

    const { data: job, error: jErr } = await supabase
      .from("video_motion_jobs")
      .select("*")
      .eq("id", job_id)
      .maybeSingle();
    if (jErr || !job) throw new Error("job não encontrado");

    // Um cancelamento feito pelo cliente sempre vence uma conclusão tardia do worker.
    if (job.status === "cancelado") {
      if (renderOk && resultado_path) {
        await supabase.storage.from(resultado_bucket || "videos").remove([resultado_path]);
      }
      return respJson({ success: true, cancelado: true });
    }

    // Reentrega idempotente de um job já concluído: não renderiza, não altera status
    // e usa o resultado_path persistido no próprio job.
    if (redeliver === true) {
      if (!job.resultado_path) throw new Error("job concluído sem resultado_path");
      const bucketReentrega = job.resultado_bucket || "videos";
      const { data: pub } = supabase.storage.from(bucketReentrega).getPublicUrl(job.resultado_path);
      const videoUrl = pub?.publicUrl;
      if (!videoUrl) throw new Error("não consegui montar a URL do vídeo para reentrega");

      let midiaId: string | null = null;
      let codigoMidia = "";
      let bibliotecaErro: string | null = null;
      try {
        midiaId = await registrarVideoNaBiblioteca(supabase, job, videoUrl, job.duracao_segundos ?? null);
        codigoMidia = linhaCodigoMidia(midiaId, "video");
        await sincronizarAreaDeVideos(supabase, midiaId);
      } catch (e) {
        bibliotecaErro = e instanceof Error ? e.message : String(e);
        console.error("[video-motion-complete] registro em /midias falhou na reentrega; entregando MP4 mesmo assim:", bibliotecaErro);
      }

      const plataformas: string[] = Array.isArray(job.plataformas) ? job.plataformas : [];
      const querPublicar = plataformas.length > 0;
      const blocoCodigo = codigoMidia ? `\n\n${codigoMidia}` : "";
      const blocoLegenda = job.legenda_post ? `\n\n*Legenda sugerida:*\n${job.legenda_post}` : "";
      if (!querPublicar) {
        await avisarCliente(
          supabase,
          job,
          `🎬 Seu vídeo animado ficou pronto. *Não publiquei em lugar nenhum.*${blocoCodigo}${blocoLegenda}`,
          videoUrl,
        );
      } else {
        const nomes = plataformas
          .map((p) => p === "instagram" ? "Instagram" : p === "facebook" ? "Facebook" : p === "linkedin" ? "LinkedIn" : p)
          .join(" e ");
        const fmt = String(job.formato || "reels").toLowerCase();
        const nomeFormato = fmt === "story" ? "STORY" : fmt === "feed" ? "FEED" : "REELS";
        await avisarCliente(
          supabase,
          job,
          `🎬 Vídeo animado pronto. *Ainda não publiquei nada.*${blocoCodigo}${blocoLegenda}\n\nResponda *APROVAR* que eu publico como *${nomeFormato}* no ${nomes}, ou *CANCELAR* e nada vai ao ar.`,
          videoUrl,
        );
      }
      return respJson({
        success: true,
        redelivered: true,
        video_url: videoUrl,
        midia_id: midiaId,
        biblioteca_erro: bibliotecaErro,
      });
    }

    // ---------- FALHA ----------
    if (!renderOk) {
      const tentativas = (job.tentativas || 0) + 1;
      const definitivo = tentativas >= MAX_TENTATIVAS;

      const { data: falhaRegistrada } = await supabase
        .from("video_motion_jobs")
        .update({
          status: definitivo ? "falha_definitiva" : "pendente",
          tentativas,
          claimed_at: null,
          erro_mensagem: String(erro || "erro no render"),
        })
        .eq("id", job.id)
        .eq("status", "processando")
        .select("id")
        .maybeSingle();

      if (!falhaRegistrada) {
        return respJson({ success: true, cancelado: true });
      }

      if (definitivo) {
        await avisarCliente(
          supabase,
          job,
          "Não consegui montar o vídeo animado desta vez. 😕 Pode tentar de novo com um tema um pouco mais curto?",
        );
      }
      return respJson({ success: true, retentativa: !definitivo });
    }

    // ---------- SUCESSO ----------
    if (!resultado_path) throw new Error("resultado_path obrigatório no sucesso");
    const bucket = resultado_bucket || "videos";

    // O worker pode avisar sucesso mesmo quando o upload do MP4 não chegou.
    // Sem arquivo no Storage o cliente vê um vídeo que não abre — então isso é falha.
    const barra = resultado_path.lastIndexOf("/");
    const pasta = barra > 0 ? resultado_path.slice(0, barra) : "";
    const arquivo = barra > 0 ? resultado_path.slice(barra + 1) : resultado_path;
    const { data: encontrados } = await supabase.storage
      .from(bucket)
      .list(pasta, { search: arquivo, limit: 100 });
    const objeto = (encontrados || []).find((o: any) => o.name === arquivo);
    const tamanho = Number(objeto?.metadata?.size || 0);

    if (!objeto || tamanho < 1024) {
      const tentativas = (job.tentativas || 0) + 1;
      const definitivo = tentativas >= MAX_TENTATIVAS;
      await supabase
        .from("video_motion_jobs")
        .update({
          status: definitivo ? "falha_definitiva" : "pendente",
          tentativas,
          claimed_at: null,
          erro_mensagem: "arquivo do vídeo não chegou ao armazenamento (upload falhou na VPS)",
        })
        .eq("id", job.id)
        .eq("status", "processando");
      return respJson({
        success: false,
        error: "arquivo não encontrado no storage",
        retentativa: !definitivo,
      });
    }

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(resultado_path);
    const videoUrl = pub?.publicUrl;
    if (!videoUrl) throw new Error("não consegui montar a URL do vídeo");


    const plataformas: string[] = Array.isArray(job.plataformas) ? job.plataformas : [];
    const querPublicar = plataformas.length > 0;

    const { data: concluido } = await supabase
      .from("video_motion_jobs")
      .update({
        status: querPublicar ? "aguardando_aprovacao" : "concluido",
        resultado_bucket: bucket,
        resultado_path,
        duracao_segundos: duracao_segundos ?? null,
        concluido_at: new Date().toISOString(),
        erro_mensagem: null,
      })
      .eq("id", job.id)
      .eq("status", "processando")
      .select("id")
      .maybeSingle();

    // O cliente pode cancelar enquanto o worker está enviando o arquivo.
    if (!concluido) {
      await supabase.storage.from(bucket).remove([resultado_path]);
      return respJson({ success: true, cancelado: true });
    }

    let midiaId: string | null = null;
    let codigoMidia = "";
    let bibliotecaErro: string | null = null;
    try {
      midiaId = await registrarVideoNaBiblioteca(supabase, job, videoUrl, duracao_segundos ?? null);
      codigoMidia = linhaCodigoMidia(midiaId, "video");
      await sincronizarAreaDeVideos(supabase, midiaId);
    } catch (e) {
      bibliotecaErro = e instanceof Error ? e.message : String(e);
      console.error("[video-motion-complete] registro em /midias falhou; entregando MP4 mesmo assim:", bibliotecaErro);
    }

    if (job.origem === "whatsapp" && job.telefone) {
      const blocoCodigo = codigoMidia ? `\n\n${codigoMidia}` : "";
      const blocoLegenda = job.legenda_post ? `\n\n*Legenda sugerida:*\n${job.legenda_post}` : "";
      if (!querPublicar) {
        await avisarCliente(
          supabase,
          job,
          `🎬 Seu vídeo animado ficou pronto. *Não publiquei em lugar nenhum.*${blocoCodigo}${blocoLegenda}`,
          videoUrl,
        );
      } else {
        const nomes = plataformas
          .map((p) =>
            p === "instagram" ? "Instagram" : p === "facebook" ? "Facebook" : p === "linkedin" ? "LinkedIn" : p,
          )
          .join(" e ");
        const fmt = String(job.formato || "reels").toLowerCase();
        const nomeFormato = fmt === "story" ? "STORY" : fmt === "feed" ? "FEED" : "REELS";
        await avisarCliente(
          supabase,
          job,
          `🎬 Vídeo animado pronto. *Ainda não publiquei nada.*${blocoCodigo}${blocoLegenda}\n\nResponda *APROVAR* que eu publico como *${nomeFormato}* no ${nomes}, ou *CANCELAR* e nada vai ao ar.`,
          videoUrl,
        );
      }
    }

    return respJson({
      success: true,
      aguardando_aprovacao: querPublicar,
      video_url: videoUrl,
      midia_id: midiaId,
      biblioteca_erro: bibliotecaErro,
    });
  } catch (e) {
    console.error("[video-motion-complete] erro:", e);
    return respJson({
      success: false,
      error: e instanceof Error ? e.message : "erro desconhecido",
    });
  }
});
