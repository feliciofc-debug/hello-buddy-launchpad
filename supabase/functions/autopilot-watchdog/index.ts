// Vigia do piloto automático.
// Motivo: em 11/09/2026 as configs de 4 clientes ficaram ativo=false e ninguém percebeu por 5 dias.
// 1) Reativa qualquer config desligada que NÃO tenha sido pausada por decisão humana (desativado_por='usuario').
// 2) Avisa (notificacoes_usuario) quando um cliente está ativo mas não gera post há mais de 36h.
// Fail-open: qualquer erro é logado e não derruba o cron.

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  const agora = new Date();
  const reativadas: string[] = [];
  const semPostagem: string[] = [];

  try {
    // ===== 1. Reativar desligamentos que não foram humanos =====
    const { data: desligadas, error: desErr } = await supabase
      .from("autopilot_config")
      .select("id, user_id, desativado_por, desativado_em, repetir_ciclo")
      .eq("ativo", false);

    if (desErr) {
      console.error("❌ [WATCHDOG] Erro lendo configs desligadas:", desErr.message);
    } else {
      for (const cfg of desligadas || []) {
        if ((cfg.desativado_por || "").toLowerCase() === "usuario") continue;

        // Não reativar contas encerradas/bloqueadas.
        const { data: perfil } = await supabase
          .from("profiles")
          .select("acesso_bloqueado")
          .eq("id", cfg.user_id)
          .maybeSingle();
        if ((perfil as any)?.acesso_bloqueado === true) continue;

        const { error: upErr } = await supabase
          .from("autopilot_config")
          .update({
            ativo: true,
            desativado_por: null,
            desativado_em: null,
            desativado_motivo: null,
            proxima_execucao: agora.toISOString(),
            updated_at: agora.toISOString(),
          })
          .eq("id", cfg.id);

        if (upErr) {
          console.error(`❌ [WATCHDOG] Falha reativando ${cfg.id}:`, upErr.message);
          continue;
        }

        reativadas.push(cfg.id);
        console.log(`🔁 [WATCHDOG] Config ${cfg.id} reativada (desligamento não humano)`);

        await supabase.from("autopilot_auditoria").insert({
          config_id: cfg.id,
          user_id: cfg.user_id,
          acao: "reativado_pelo_vigia",
          origem: "autopilot-watchdog",
          motivo: `desligamento sem autor humano (desativado_por=${cfg.desativado_por || "null"})`,
        });
      }
    }

    // ===== 2. Cliente ativo sem gerar post há mais de 36h =====
    const limite = new Date(agora.getTime() - 36 * 60 * 60 * 1000).toISOString();

    const { data: ativas, error: ativErr } = await supabase
      .from("autopilot_config")
      .select("id, user_id")
      .eq("ativo", true);

    if (ativErr) {
      console.error("❌ [WATCHDOG] Erro lendo configs ativas:", ativErr.message);
    } else {
      for (const cfg of ativas || []) {
        const { count, error: cErr } = await supabase
          .from("social_posts_queue")
          .select("id", { count: "exact", head: true })
          .eq("user_id", cfg.user_id)
          .gte("created_at", limite);

        if (cErr) {
          console.error("❌ [WATCHDOG] Erro contando posts:", cErr.message);
          continue;
        }

        if ((count || 0) === 0) {
          semPostagem.push(cfg.user_id);
          console.warn(`⚠️ [WATCHDOG] Cliente ${cfg.user_id} ativo mas sem post há 36h+`);

          try {
            await supabase.from("notificacoes_usuario").insert({
              user_id: cfg.user_id,
              tipo: "autopilot_sem_postagem",
              titulo: "Publicação automática parada",
              mensagem:
                "O piloto automático está ligado, mas nenhum post foi gerado nas últimas 36 horas. Verifique se há produtos ativos e redes conectadas.",
            });
          } catch (nErr) {
            console.error("❌ [WATCHDOG] Falha criando notificação:", (nErr as Error).message);
          }

          await supabase.from("autopilot_auditoria").insert({
            config_id: cfg.id,
            user_id: cfg.user_id,
            acao: "alerta_sem_postagem",
            origem: "autopilot-watchdog",
            motivo: "nenhum post gerado nas últimas 36h com autopilot ativo",
          });
        }
      }
    }

    return new Response(
      JSON.stringify({
        success: true,
        timestamp: agora.toISOString(),
        reativadas,
        sem_postagem: semPostagem,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("❌ [WATCHDOG] Erro geral:", (e as Error).message);
    return new Response(
      JSON.stringify({ success: false, error: (e as Error).message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
