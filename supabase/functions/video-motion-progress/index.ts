// Worker VPS reporta progresso do Remotion (onProgress ~10%) e etapas do pipeline.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { autorizarWorker, renderCors, respJson } from "../_shared/render-auth.ts";
import {
  clampProgressoPct,
  normalizarEtapaMotion,
} from "../_shared/video-motion-etapa.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: renderCors });

  const auth = autorizarWorker(req);
  if (!auth.ok) return respJson({ success: false, error: auth.motivo }, 401);

  try {
    const body = await req.json().catch(() => ({}));
    const jobId = String(body?.job_id ?? "").trim();
    if (!jobId) return respJson({ success: false, error: "job_id obrigatório" }, 400);

    const etapa = normalizarEtapaMotion(body?.etapa);
    const progresso_pct = clampProgressoPct(body?.progresso_pct);
    if (!etapa) return respJson({ success: false, error: "etapa inválida" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const agora = new Date().toISOString();
    const { data, error } = await sb
      .from("video_motion_jobs")
      .update({
        progresso_pct,
        etapa,
        progresso_atualizado_em: agora,
      })
      .eq("id", jobId)
      .in("status", ["pendente", "processando"])
      .select("id")
      .maybeSingle();

    if (error) throw error;
    if (!data) {
      return respJson({ success: true, ignored: true, reason: "job não está ativo" });
    }

    return respJson({ success: true });
  } catch (e) {
    console.error("[video-motion-progress]", e);
    return respJson({
      success: false,
      error: e instanceof Error ? e.message : "erro desconhecido",
    }, 500);
  }
});
