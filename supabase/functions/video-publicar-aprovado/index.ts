// ============================================================
// video-publicar-aprovado
// Publica um job de vídeo que JÁ foi renderizado e APROVADO pelo dono.
// Só roda depois de uma aprovação explícita no WhatsApp.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  friendlyMetaVideoPublishError,
  renderedMetaVideoFormat,
  shouldNotifyVideoPublishCaller,
  validateMetaVideoForPublishing,
} from "../_shared/meta-video-requirements.ts";
import { readyVideoRerenderButtons } from "../_shared/ready-media-actions.ts";
import { formatVideoPublishMessage } from "../_shared/video-publish-message.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

function resp(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...cors, "Content-Type": "application/json" },
  });
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  try {
    const { job_id, notify_whatsapp = true } = await req.json();
    if (!job_id) throw new Error("job_id obrigatório");

    const { data: job } = await supabase
      .from("video_render_jobs")
      .select("*")
      .eq("id", job_id)
      .maybeSingle();
    if (!job) throw new Error("job não encontrado");
    if (
      !["aguardando_aprovacao", "aprovado", "erro_publicacao"].includes(
        job.status,
      )
    ) {
      throw new Error(`job em status inválido para publicar: ${job.status}`);
    }

    // 🚫 NUNCA publicar o vídeo de entrada (video_bucket/video_path).
    // Só o resultado do encode (com legenda queimada) pode ir ao ar.
    if (!job.resultado_path || !job.resultado_bucket) {
      await supabase
        .from("video_render_jobs")
        .update({
          status: "erro_publicacao",
          erro_mensagem:
            "sem vídeo legendado (resultado_bucket/resultado_path nulos) — publicação bloqueada",
        })
        .eq("id", job.id);
      return resp({
        success: false,
        error: "job sem vídeo legendado — nada foi publicado",
      });
    }

    const bucket = job.resultado_bucket;
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(
      job.resultado_path,
    );
    const videoUrl = pub?.publicUrl;
    if (!videoUrl) {
      throw new Error("URL pública do vídeo legendado indisponível");
    }
    console.log(
      `[video-publicar-aprovado] publicando LEGENDADO ${bucket}/${job.resultado_path}`,
    );

    // Destino resolvido: só publica onde foi pedido.
    const pedidas: string[] = Array.isArray(job.metadata?.plataformas_pedidas)
      ? job.metadata.plataformas_pedidas
      : [];
    const plataformas: string[] = pedidas.length
      ? pedidas
      : (Array.isArray(job.plataformas) && job.plataformas.length
        ? job.plataformas
        : ["instagram", "facebook"]);

    const formato = renderedMetaVideoFormat(
      job.formato,
      job.metadata?.video_output,
    );
    const ehStory = formato === "story";
    console.log(
      `[video-publicar-aprovado] formato=${formato} plataformas=${
        plataformas.join(",")
      }`,
    );

    let sizeBytes = Number(job.metadata?.video_output?.size_bytes);
    if (!Number.isFinite(sizeBytes) || sizeBytes <= 0) {
      try {
        const head = await fetch(videoUrl, { method: "HEAD" });
        sizeBytes = Number(head.headers.get("content-length"));
      } catch {
        sizeBytes = Number.NaN;
      }
    }
    const validation = validateMetaVideoForPublishing({
      format: formato,
      path: job.resultado_path,
      durationSeconds: job.duracao_segundos,
      output: job.metadata?.video_output,
      sizeBytes,
    });
    if (!validation.ok) {
      const message = `Não publiquei o vídeo: ${validation.message}`;
      await supabase.from("video_render_jobs").update({
        status: "erro_publicacao",
        erro_mensagem: validation.message,
        formato,
      }).eq("id", job.id);
      if (job.telefone && shouldNotifyVideoPublishCaller(notify_whatsapp)) {
        const { data: renderedMedia } = await supabase
          .from("midias_whatsapp")
          .select("id")
          .eq("user_id", job.user_id)
          .eq("midia_url", videoUrl)
          .limit(1)
          .maybeSingle();
        await supabase.functions.invoke("whatsapp-send-message", {
          body: {
            user_id: job.user_id,
            to: job.telefone,
            message,
            ...(renderedMedia?.id
              ? {
                interactive_buttons: readyVideoRerenderButtons(
                  renderedMedia.id,
                ),
              }
              : {}),
          },
        });
      }
      return resp({
        success: false,
        error: validation.message,
        validation_error: true,
      });
    }

    const publicados: string[] = [];
    const erros: string[] = [];
    const links: Array<{ plataforma: string; url: string }> = [];

    if (ehStory) {
      // STORY: função dedicada, aceita os dois canais de uma vez.
      try {
        const { data: res, error: sErr } = await supabase.functions.invoke(
          "meta-publish-story",
          {
            body: {
              video_url: videoUrl,
              user_id: job.user_id,
              canais: plataformas,
            },
          },
        );
        if (sErr) throw sErr;
        for (const plataforma of plataformas) {
          const r = res?.[plataforma];
          if (r?.ok) publicados.push(plataforma);
          else {
            erros.push(
              friendlyMetaVideoPublishError(
                plataforma,
                r?.error || res?.error || "falhou",
              ),
            );
          }
        }
      } catch (e) {
        erros.push(friendlyMetaVideoPublishError("story", e));
      }
    } else {
      for (const plataforma of plataformas) {
        try {
          const functionName = formato === "feed"
            ? plataforma === "facebook"
              ? "meta-publish-post"
              : "meta-publish-instagram"
            : "meta-publish-reels";
          const body = formato === "feed"
            ? plataforma === "facebook"
              ? {
                message: job.copy_escolhida || job.caption || " ",
                video_url: videoUrl,
                user_id: job.user_id,
                preserve_caption: true,
              }
              : {
                caption: job.copy_escolhida || job.caption || " ",
                video_url: videoUrl,
                user_id: job.user_id,
                preserve_caption: true,
              }
            : {
              platform: plataforma,
              video_url: videoUrl,
              caption: job.copy_escolhida || job.caption || " ",
              user_id: job.user_id,
              preserve_caption: true,
            };
          const { data: res, error: pErr } = await supabase.functions.invoke(
            functionName,
            { body },
          );
          if (pErr) throw pErr;
          if (res?.success) {
            publicados.push(plataforma);
            if (typeof res?.post_url === "string" && res.post_url) {
              links.push({ plataforma, url: res.post_url });
            }
          } else {
            erros.push(
              friendlyMetaVideoPublishError(
                plataforma,
                res?.error || "falhou",
              ),
            );
          }
        } catch (e) {
          erros.push(friendlyMetaVideoPublishError(plataforma, e));
        }
      }
    }

    await supabase
      .from("video_render_jobs")
      .update({
        status: erros.length === 0 && publicados.length === plataformas.length
          ? "publicado"
          : "erro_publicacao",
        erro_mensagem: erros.length ? erros.join(" | ") : null,
      })
      .eq("id", job.id);

    if (job.telefone && shouldNotifyVideoPublishCaller(notify_whatsapp)) {
      const msg = formatVideoPublishMessage({
        published: publicados,
        links,
        errors: erros,
      });
      try {
        await supabase.functions.invoke("whatsapp-send-message", {
          body: { user_id: job.user_id, to: job.telefone, message: msg },
        });
      } catch (e) {
        console.error("[video-publicar-aprovado] aviso falhou:", e);
      }
    }

    return resp({
      success: erros.length === 0 && publicados.length === plataformas.length,
      plataformas: publicados,
      erros,
      links,
    });
  } catch (e) {
    console.error("[video-publicar-aprovado] erro:", e);
    return resp({ success: false, error: (e as Error)?.message || "erro" });
  }
});
