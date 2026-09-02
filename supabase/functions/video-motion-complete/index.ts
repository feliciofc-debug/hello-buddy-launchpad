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
    const { job_id, success: renderOk, resultado_bucket, resultado_path, duracao_segundos, erro } =
      body || {};
    if (!job_id) throw new Error("job_id obrigatório");

    const { data: job, error: jErr } = await supabase
      .from("video_motion_jobs")
      .select("*")
      .eq("id", job_id)
      .maybeSingle();
    if (jErr || !job) throw new Error("job não encontrado");

    // ---------- FALHA ----------
    if (!renderOk) {
      const tentativas = (job.tentativas || 0) + 1;
      const definitivo = tentativas >= MAX_TENTATIVAS;

      await supabase
        .from("video_motion_jobs")
        .update({
          status: definitivo ? "falha_definitiva" : "pendente",
          tentativas,
          claimed_at: null,
          erro_mensagem: String(erro || "erro no render"),
        })
        .eq("id", job.id);

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

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(resultado_path);
    const videoUrl = pub?.publicUrl;
    if (!videoUrl) throw new Error("não consegui montar a URL do vídeo");

    const plataformas: string[] = Array.isArray(job.plataformas) ? job.plataformas : [];
    const querPublicar = plataformas.length > 0;

    await supabase
      .from("video_motion_jobs")
      .update({
        status: querPublicar ? "aguardando_aprovacao" : "concluido",
        resultado_bucket: bucket,
        resultado_path,
        duracao_segundos: duracao_segundos ?? null,
        concluido_at: new Date().toISOString(),
        erro_mensagem: null,
      })
      .eq("id", job.id);

    if (job.origem === "whatsapp" && job.telefone) {
      const blocoLegenda = job.legenda_post ? `\n\n*Legenda sugerida:*\n${job.legenda_post}` : "";
      if (!querPublicar) {
        await avisarCliente(
          supabase,
          job,
          `🎬 Seu vídeo animado ficou pronto. *Não publiquei em lugar nenhum.*${blocoLegenda}`,
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
          `🎬 Vídeo animado pronto. *Ainda não publiquei nada.*${blocoLegenda}\n\nResponda *APROVAR* que eu publico como *${nomeFormato}* no ${nomes}, ou *CANCELAR* e nada vai ao ar.`,
          videoUrl,
        );
      }
    }

    return respJson({ success: true, aguardando_aprovacao: querPublicar, video_url: videoUrl });
  } catch (e) {
    console.error("[video-motion-complete] erro:", e);
    return respJson({
      success: false,
      error: e instanceof Error ? e.message : "erro desconhecido",
    });
  }
});
