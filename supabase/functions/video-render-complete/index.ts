// ============================================================
// video-render-complete
// O worker da VPS avisa o fim do encode (sucesso ou erro).
// Em caso de sucesso: publica nas redes e avisa o cliente no WhatsApp.
// Em caso de erro: retenta até 3 vezes; depois avisa o cliente com a
// opção de publicar sem legenda.
//
// Auth: header `x-render-token` = secret VPS_RENDER_TOKEN.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { autorizarWorker, renderCors, respJson } from "../_shared/render-auth.ts";

const MAX_TENTATIVAS = 3;

async function avisarCliente(
  supabase: any,
  job: any,
  message: string,
) {
  if (!job.telefone) return;
  try {
    await supabase.functions.invoke("whatsapp-send-message", {
      body: { user_id: job.user_id, to: job.telefone, message },
    });
  } catch (e) {
    console.error("[video-render-complete] aviso WhatsApp falhou:", e);
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
    const {
      job_id,
      success: encodeOk,
      resultado_bucket,
      resultado_path,
      duracao_segundos,
      erro,
    } = body || {};

    if (!job_id) throw new Error("job_id obrigatório");

    const { data: job, error: jErr } = await supabase
      .from("video_render_jobs")
      .select("*")
      .eq("id", job_id)
      .maybeSingle();
    if (jErr || !job) throw new Error("job não encontrado");

    // ---------- FALHA NO ENCODE ----------
    if (!encodeOk) {
      const tentativas = (job.tentativas || 0) + 1;
      const definitivo = tentativas >= MAX_TENTATIVAS;

      await supabase
        .from("video_render_jobs")
        .update({
          status: definitivo ? "falha_definitiva" : "pendente",
          tentativas,
          claimed_at: null,
          erro_mensagem: String(erro || "erro no encode"),
        })
        .eq("id", job.id);

      if (definitivo) {
        await avisarCliente(
          supabase,
          job,
          "Não consegui gerar a legenda no seu vídeo desta vez. 😕\n\nQuer que eu publique o vídeo *sem legenda*? Responda *SIM* para publicar assim, ou envie o vídeo novamente para eu tentar de novo.",
        );
      }

      return respJson({ success: true, retentativa: !definitivo });
    }

    // ---------- SUCESSO ----------
    if (!resultado_path) throw new Error("resultado_path obrigatório no sucesso");
    const bucket = resultado_bucket || "videos";

    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(resultado_path);
    const videoUrl = pub?.publicUrl;
    if (!videoUrl) throw new Error("não consegui montar a URL pública do vídeo");

    const plataformas: string[] = Array.isArray(job.plataformas)
      ? job.plataformas
      : ["instagram", "facebook"];
    const publicados: string[] = [];
    const erros: string[] = [];

    for (const plataforma of plataformas) {
      try {
        const { data: res, error: pErr } = await supabase.functions.invoke(
          "meta-publish-reels",
          {
            body: {
              platform: plataforma,
              video_url: videoUrl,
              caption: job.caption || " ",
              user_id: job.user_id,
            },
          },
        );
        if (pErr) throw pErr;
        if (res?.success) publicados.push(plataforma);
        else erros.push(`${plataforma}: ${res?.error || "falhou"}`);
      } catch (e: any) {
        console.error(`[video-render-complete] ${plataforma} erro:`, e);
        erros.push(`${plataforma}: ${e?.message || "erro"}`);
      }
    }

    await supabase
      .from("video_render_jobs")
      .update({
        status:
          plataformas.length === 0
            ? "concluido"
            : publicados.length > 0
              ? "publicado"
              : "erro_publicacao",
        resultado_bucket: bucket,
        resultado_path,
        duracao_segundos: duracao_segundos ?? null,
        concluido_at: new Date().toISOString(),
        erro_mensagem: erros.length ? erros.join(" | ") : null,
      })
      .eq("id", job.id);

    await avisarCliente(
      supabase,
      job,
      publicados.length > 0
        ? `✅ Seu vídeo foi publicado com a legenda na tela em: ${publicados
            .map((p) => (p === "instagram" ? "Instagram" : "Facebook"))
            .join(" e ")}.`
        : `Consegui gerar a legenda no vídeo, mas a publicação falhou: ${erros.join(
            " | ",
          )}\n\nMe avise que eu tento publicar novamente.`,
    );

    return respJson({
      success: publicados.length > 0,
      plataformas: publicados,
      erros: erros.length ? erros : undefined,
      video_url: videoUrl,
    });
  } catch (e) {
    console.error("[video-render-complete] erro:", e);
    return respJson({
      success: false,
      error: e instanceof Error ? e.message : "erro desconhecido",
    });
  }
});
