// Recria um job de vídeo a partir de um job anterior (stale/erro), mesmo usuário.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.57.4";
import { corsHeaders } from "../_shared/cors.ts";

const json = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ success: false, error: "Não autenticado" }, 401);

    const anon = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } } as any,
    );
    const { data: authData, error: authErr } = await anon.auth.getUser();
    const user = authData?.user;
    if (authErr || !user) return json({ success: false, error: "Sessão inválida" }, 401);

    const body = await req.json().catch(() => ({}));
    const jobId = String(body?.job_id ?? "").trim();
    if (!jobId) return json({ success: false, error: "job_id obrigatório" }, 400);

    const sb = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const { data: old, error: loadErr } = await sb
      .from("video_motion_jobs")
      .select(
        "id, user_id, template, titulo, props, metadata, trilha_id, trilha_volume, legenda_post, plataformas, formato, origem, telefone",
      )
      .eq("id", jobId)
      .eq("user_id", user.id)
      .maybeSingle();

    if (loadErr) throw loadErr;
    if (!old) return json({ success: false, error: "Job não encontrado" }, 404);

    const { data: novo, error: insErr } = await sb
      .from("video_motion_jobs")
      .insert({
        user_id: user.id,
        origem: old.origem ?? "plataforma",
        template: old.template,
        titulo: old.titulo,
        props: old.props,
        trilha_id: old.trilha_id,
        trilha_volume: old.trilha_volume ?? 0.28,
        legenda_post: old.legenda_post,
        plataformas: old.plataformas ?? [],
        formato: old.formato ?? "reels",
        telefone: old.telefone,
        metadata: old.metadata,
        status: "pendente",
        progresso_pct: 0,
        etapa: "na_fila",
        progresso_atualizado_em: new Date().toISOString(),
      })
      .select("id")
      .single();

    if (insErr) throw insErr;

    const { data: pos } = await sb.rpc("video_motion_fila_posicao", { p_job_id: novo.id });

    return json({
      success: true,
      job_id: novo.id,
      posicao_fila: pos ?? 1,
    });
  } catch (e) {
    console.error("[video-motion-retry]", e);
    return json({
      success: false,
      error: e instanceof Error ? e.message : "erro desconhecido",
    }, 500);
  }
});
