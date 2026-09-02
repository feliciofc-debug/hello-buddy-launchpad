// ============================================================
// video-motion-claim
// O worker Remotion da VPS chama este endpoint em polling.
// Devolve no máximo 1 job pendente com:
//   - template + props (para `remotion render`)
//   - URL assinada para SUBIR o MP4 renderizado
//
// Auth: header `x-render-token` = secret VPS_RENDER_TOKEN.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { autorizarWorker, renderCors, respJson } from "../_shared/render-auth.ts";

const BUCKET_SAIDA = "videos";
const STALE_MINUTOS = 20;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: renderCors });

  const auth = autorizarWorker(req);
  if (!auth.ok) return respJson({ success: false, error: auth.motivo }, 401);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: claimed, error: claimErr } = await supabase
      .rpc("claim_video_motion_job", { p_stale_minutos: STALE_MINUTOS })
      .maybeSingle();

    if (claimErr) throw claimErr;
    if (!claimed || !(claimed as any).id) return respJson({ success: true, job: null });

    const job = claimed as any;
    const props = { ...(job.props || {}) };
    const logoPath = typeof props.logo_path === "string" ? props.logo_path : "";
    if (logoPath.startsWith(`${job.user_id}/`)) {
      const { data: logo } = await supabase.storage.from("tenant-logos").createSignedUrl(logoPath, 3600);
      if (logo?.signedUrl) props.logoUrl = logo.signedUrl;
    }
    delete props.logo_path;

    const nome = `motion/${job.user_id}/${job.id}.mp4`;
    const { data: up, error: upErr } = await supabase.storage
      .from(BUCKET_SAIDA)
      .createSignedUploadUrl(nome, { upsert: true });
    if (upErr || !up?.signedUrl) throw upErr || new Error("upload url falhou");

    return respJson({
      success: true,
      job: {
        id: job.id,
        template: job.template || "template-agente",
        props,
        upload: {
          url: up.signedUrl,
          token: up.token,
          bucket: BUCKET_SAIDA,
          path: nome,
          content_type: "video/mp4",
        },
        tentativa: (job.tentativas || 0) + 1,
      },
    });
  } catch (e) {
    console.error("[video-motion-claim] erro:", e);
    return respJson({
      success: false,
      error: e instanceof Error ? e.message : "erro desconhecido",
    });
  }
});
