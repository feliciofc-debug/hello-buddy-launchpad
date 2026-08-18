// ============================================================
// video-publicar-aprovado
// Publica um job de vídeo que JÁ foi renderizado e APROVADO pelo dono.
// Só roda depois de uma aprovação explícita no WhatsApp.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
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
    const { job_id } = await req.json();
    if (!job_id) throw new Error("job_id obrigatório");

    const { data: job } = await supabase
      .from("video_render_jobs")
      .select("*")
      .eq("id", job_id)
      .maybeSingle();
    if (!job) throw new Error("job não encontrado");
    if (!["aguardando_aprovacao", "aprovado", "erro_publicacao"].includes(job.status)) {
      throw new Error(`job em status inválido para publicar: ${job.status}`);
    }

    // 🚫 NUNCA publicar o vídeo de entrada (video_bucket/video_path).
    // Só o resultado do encode (com legenda queimada) pode ir ao ar.
    if (!job.resultado_path || !job.resultado_bucket) {
      await supabase
        .from("video_render_jobs")
        .update({
          status: "erro_publicacao",
          erro_mensagem: "sem vídeo legendado (resultado_bucket/resultado_path nulos) — publicação bloqueada",
        })
        .eq("id", job.id);
      return resp({ success: false, error: "job sem vídeo legendado — nada foi publicado" });
    }

    const bucket = job.resultado_bucket;
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(job.resultado_path);
    const videoUrl = pub?.publicUrl;
    if (!videoUrl) throw new Error("URL pública do vídeo legendado indisponível");
    console.log(`[video-publicar-aprovado] publicando LEGENDADO ${bucket}/${job.resultado_path}`);

    const plataformas: string[] = Array.isArray(job.plataformas) && job.plataformas.length
      ? job.plataformas
      : ["instagram", "facebook"];

    const publicados: string[] = [];
    const erros: string[] = [];

    for (const plataforma of plataformas) {
      try {
        const { data: res, error: pErr } = await supabase.functions.invoke("meta-publish-reels", {
          body: {
            platform: plataforma,
            video_url: videoUrl,
            caption: job.copy_escolhida || job.caption || " ",
            user_id: job.user_id,
          },
        });
        if (pErr) throw pErr;
        if (res?.success) publicados.push(plataforma);
        else erros.push(`${plataforma}: ${res?.error || "falhou"}`);
      } catch (e) {
        erros.push(`${plataforma}: ${(e as Error)?.message || "erro"}`);
      }
    }

    await supabase
      .from("video_render_jobs")
      .update({
        status: publicados.length > 0 ? "publicado" : "erro_publicacao",
        erro_mensagem: erros.length ? erros.join(" | ") : null,
      })
      .eq("id", job.id);

    if (job.telefone) {
      const msg = publicados.length > 0
        ? `✅ Publicado com a legenda na tela em: ${publicados
            .map((p) => (p === "instagram" ? "Instagram" : "Facebook"))
            .join(" e ")}.`
        : `A publicação falhou: ${erros.join(" | ")}\n\nMe responda *APROVAR* que eu tento de novo.`;
      try {
        await supabase.functions.invoke("whatsapp-send-message", {
          body: { user_id: job.user_id, to: job.telefone, message: msg },
        });
      } catch (e) {
        console.error("[video-publicar-aprovado] aviso falhou:", e);
      }
    }

    return resp({ success: publicados.length > 0, plataformas: publicados, erros });
  } catch (e) {
    console.error("[video-publicar-aprovado] erro:", e);
    return resp({ success: false, error: (e as Error)?.message || "erro" });
  }
});
