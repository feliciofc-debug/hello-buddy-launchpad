// ============================================================
// video-render-maintenance
// Roda periodicamente (cron). Faz três coisas:
//  1. Recicla jobs travados em "processando" (worker morreu).
//  2. Avisa o cliente quando o vídeo está demorando mais que o normal,
//     para o silêncio não parecer abandono.
//  3. Registra alarme de "fila parada" (VPS provavelmente fora do ar).
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-render-token, x-cron-key",
};

const STALE_MINUTOS = 15;
const AVISO_DEMORA_MINUTOS = 5;
const FILA_PARADA_MINUTOS = 10;

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    // Auth: chave do cron (tabela interna) OU token do worker da VPS.
    const cronKey = req.headers.get("x-cron-key") || "";
    const workerToken = req.headers.get("x-render-token") || "";
    const esperadoWorker = Deno.env.get("VPS_RENDER_TOKEN") || "";
    let autorizado = !!esperadoWorker && workerToken === esperadoWorker;
    if (!autorizado && cronKey) {
      const { data: keyRow } = await supabase
        .from("internal_cron_keys")
        .select("chave")
        .eq("nome", "video-render-maintenance")
        .maybeSingle();
      autorizado = !!keyRow?.chave && keyRow.chave === cronKey;
    }
    if (!autorizado) {
      return new Response(JSON.stringify({ success: false, error: "não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const agora = Date.now();

    // 1. Jobs travados voltam para a fila
    const { data: reciclados } = await supabase
      .from("video_render_jobs")
      .update({ status: "pendente", claimed_at: null })
      .eq("status", "processando")
      .lt("claimed_at", new Date(agora - STALE_MINUTOS * 60_000).toISOString())
      .select("id");

    // 2. Aviso de demora (uma única vez por job).
    // Conta do momento em que o job ENTROU NA FILA (enfileirado_at), não da
    // criação — senão dispararia enquanto o dono ainda escolhe a copy A/B/C.
    const { data: demorados } = await supabase
      .from("video_render_jobs")
      .select("id, user_id, telefone")
      .in("status", ["pendente", "processando"])
      .is("avisado_demora_at", null)
      .not("enfileirado_at", "is", null)
      .lt("enfileirado_at", new Date(agora - AVISO_DEMORA_MINUTOS * 60_000).toISOString())
      .limit(20);


    for (const job of demorados || []) {
      if (job.telefone) {
        try {
          await supabase.functions.invoke("whatsapp-send-message", {
            body: {
              user_id: job.user_id,
              to: job.telefone,
              message:
                "Ainda estou finalizando a legenda do seu vídeo. 🎬 Já te aviso aqui quando estiver publicado.",
            },
          });
        } catch (e) {
          console.error("[render-maintenance] aviso falhou:", e);
        }
      }
      await supabase
        .from("video_render_jobs")
        .update({ avisado_demora_at: new Date().toISOString() })
        .eq("id", job.id);
    }

    // 3. Alarme de fila parada (worker/VPS provavelmente fora do ar)
    const { count: paradosCount } = await supabase
      .from("video_render_jobs")
      .select("id", { count: "exact", head: true })
      .eq("status", "pendente")
      .not("enfileirado_at", "is", null)
      .lt("enfileirado_at", new Date(agora - FILA_PARADA_MINUTOS * 60_000).toISOString());


    const filaParada = (paradosCount || 0) > 0;
    if (filaParada) {
      console.error(
        `🚨 [render-maintenance] fila de vídeo parada: ${paradosCount} job(s) pendentes há mais de ${FILA_PARADA_MINUTOS} min — worker da VPS pode estar fora do ar`,
      );
      try {
        await supabase.from("edge_functions_health").upsert(
          {
            function_name: "video-render-worker-vps",
            status: "down",
            last_error: `${paradosCount} job(s) na fila há mais de ${FILA_PARADA_MINUTOS} min`,
            checked_at: new Date().toISOString(),
          },
          { onConflict: "function_name" },
        );
      } catch (_e) {
        /* monitoramento é best-effort */
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        reciclados: reciclados?.length || 0,
        avisados: demorados?.length || 0,
        fila_parada: filaParada,
        pendentes_antigos: paradosCount || 0,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("[render-maintenance] erro:", e);
    return new Response(
      JSON.stringify({
        success: false,
        error: e instanceof Error ? e.message : "erro desconhecido",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
