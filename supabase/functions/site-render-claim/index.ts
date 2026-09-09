// ============================================================
// site-render-claim
// O worker de navegador da VPS chama em polling e recebe no máximo
// 1 site para abrir. Auth: header `x-render-token`.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { autorizarWorker, renderCors, respJson } from "../_shared/render-auth.ts";

const STALE_MINUTOS = 5;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: renderCors });

  const auth = autorizarWorker(req);
  if (!auth.ok) return respJson({ success: false, error: auth.motivo }, 401);

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data, error } = await supabase
      .rpc("claim_site_render_job", { p_stale_minutos: STALE_MINUTOS })
      .maybeSingle();
    if (error) throw error;
    const job = data as { id?: string; url?: string } | null;
    if (!job?.id) return respJson({ success: true, job: null });

    return respJson({ success: true, job: { id: job.id, url: job.url } });
  } catch (e) {
    return respJson({ success: false, error: (e as Error)?.message }, 500);
  }
});
