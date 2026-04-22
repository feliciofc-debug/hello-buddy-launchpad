import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    // Pega até 5 agendamentos prontos (status pendente + horário passou)
    const { data: agendados, error } = await supabase
      .from("videos_agendados")
      .select("*")
      .eq("status", "pendente")
      .lte("scheduled_for", new Date().toISOString())
      .order("scheduled_for", { ascending: true })
      .limit(5);

    if (error) throw error;

    if (!agendados || agendados.length === 0) {
      return new Response(
        JSON.stringify({ success: true, processed: 0, message: "Nenhum agendamento pronto" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📅 Processando ${agendados.length} agendamento(s)`);

    const results: any[] = [];

    for (const item of agendados) {
      // Marca como processando
      await supabase
        .from("videos_agendados")
        .update({ status: "processando", tentativas: (item.tentativas || 0) + 1 })
        .eq("id", item.id);

      try {
        let funcResult: any = null;
        let funcError: any = null;

        if (item.tipo === "story") {
          const { data, error } = await supabase.functions.invoke("meta-publish-story", {
            body: {
              video_url: item.video_url,
              user_id: item.user_id,
              canais: item.canais,
            },
          });
          funcResult = data;
          funcError = error;
        } else if (item.tipo === "reels") {
          // Reels: publica em cada plataforma do array canais
          const reelsResult: any = { success: false };
          for (const platform of item.canais) {
            const { data, error: pubErr } = await supabase.functions.invoke("meta-publish-reels", {
              body: {
                platform,
                video_url: item.video_url,
                caption: item.caption,
                user_id: item.user_id,
              },
            });
            if (pubErr) {
              reelsResult[platform] = { ok: false, error: pubErr.message };
            } else if (data?.success) {
              reelsResult[platform] = { ok: true, post_id: data.post_id };
              reelsResult.success = true;
            } else {
              reelsResult[platform] = { ok: false, error: data?.error || "Erro desconhecido" };
            }
          }
          funcResult = reelsResult;
        }

        if (funcError) {
          throw new Error(funcError.message || "Erro na publicação");
        }

        // Verifica se ao menos um canal funcionou
        const okFb = funcResult?.facebook?.ok;
        const okIg = funcResult?.instagram?.ok;
        const okAny = okFb || okIg || funcResult?.success;

        if (okAny) {
          await supabase
            .from("videos_agendados")
            .update({
              status: "publicado",
              resultado: funcResult,
              published_at: new Date().toISOString(),
              erro: null,
            })
            .eq("id", item.id);

          results.push({ id: item.id, ok: true });
        } else {
          const errMsg = funcResult?.facebook?.error || funcResult?.instagram?.error || "Falha em todos os canais";
          await supabase
            .from("videos_agendados")
            .update({
              status: "erro",
              resultado: funcResult,
              erro: errMsg,
            })
            .eq("id", item.id);

          results.push({ id: item.id, ok: false, error: errMsg });
        }
      } catch (err: any) {
        console.error(`❌ Erro no agendamento ${item.id}:`, err);
        await supabase
          .from("videos_agendados")
          .update({
            status: "erro",
            erro: err?.message || String(err),
          })
          .eq("id", item.id);

        results.push({ id: item.id, ok: false, error: err?.message });
      }
    }

    return new Response(
      JSON.stringify({ success: true, processed: agendados.length, results }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (error: any) {
    console.error("❌ Erro geral:", error);
    return new Response(
      JSON.stringify({ success: false, error: error?.message || "Erro desconhecido" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
