// ============================================================
// site-identidade-status
// A tela consulta aqui o andamento da leitura avançada (Camada B).
// Só devolve pedido do próprio usuário (ou pedido sem dono, feito
// na mesma sessão anônima de prospecção).
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

const json = (body: unknown) =>
  new Response(JSON.stringify(body), {
    status: 200,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { job_id } = await req.json();
    if (!job_id) return json({ success: false, error: "job_id obrigatório" });

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    let userId: string | null = null;
    const token = (req.headers.get("authorization") || "").replace(/^Bearer\s+/i, "");
    if (token) {
      const { data } = await supabase.auth.getUser(token);
      userId = data?.user?.id ?? null;
    }

    const { data: job, error } = await supabase
      .from("site_render_jobs")
      .select("id, user_id, status, identidade, erro")
      .eq("id", String(job_id))
      .maybeSingle();
    if (error) throw error;
    if (!job) return json({ success: false, error: "pedido não encontrado" });
    if (job.user_id && job.user_id !== userId) {
      return json({ success: false, error: "pedido não encontrado" });
    }

    return json({
      success: true,
      status: job.status,
      erro: job.erro,
      identidade: job.status === "concluido" ? job.identidade : null,
    });
  } catch (e) {
    return json({ success: false, error: (e as Error)?.message || "Falha ao consultar." });
  }
});
