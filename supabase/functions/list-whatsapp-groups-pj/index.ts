import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOCAWEB_WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";
const LOCAWEB_WUZAPI_TOKEN = Deno.env.get("WUZAPI_TOKEN") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, sync = false } = await req.json();

    console.log(`📋 [PJ-GROUPS] Listando grupos para user: ${userId}, sync: ${sync}`);

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "userId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Buscar token do usuário
    let wuzapiToken = LOCAWEB_WUZAPI_TOKEN;
    const { data: config } = await supabase
      .from("pj_clientes_config")
      .select("wuzapi_token")
      .eq("user_id", userId)
      .maybeSingle();

    if (config?.wuzapi_token) {
      wuzapiToken = config.wuzapi_token;
    }

    // Buscar grupos da API Wuzapi
    console.log("📱 [PJ-GROUPS] Buscando grupos da API...");
    
    const response = await fetch(`${LOCAWEB_WUZAPI_URL}/group/list`, {
      method: "POST",
      headers: {
        "Token": wuzapiToken,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({}),
    });

    const data = await response.json();
    console.log("📋 [PJ-GROUPS] Resposta:", { success: data?.success, count: data?.Groups?.length });

    if (!response.ok || data?.success === false) {
      return new Response(
        JSON.stringify({ success: false, error: data?.error || "Erro ao listar grupos" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groups = data?.Groups || data?.groups || [];

    // Mapear e salvar no banco (se sync)
    const mappedGroups = groups.map((g: any) => ({
      user_id: userId,
      grupo_jid: g.JID || g.jid || g.id,
      nome: g.Name || g.name || g.subject || "Grupo sem nome",
      descricao: g.Topic || g.description || null,
      participantes_count: g.Participants?.length || g.participants?.length || 0,
      is_admin: g.IsAdmin || g.isAdmin || false,
      is_announce: g.IsAnnounce || g.announce || false,
      ultimo_sync: new Date().toISOString(),
    }));

    if (sync && mappedGroups.length > 0) {
      console.log(`💾 [PJ-GROUPS] Sincronizando ${mappedGroups.length} grupos...`);

      for (const group of mappedGroups) {
        await supabase
          .from("pj_grupos_whatsapp")
          .upsert(group, {
            onConflict: "user_id,grupo_jid",
          });
      }

      console.log("✅ [PJ-GROUPS] Grupos sincronizados!");
    }

    // Buscar grupos do banco (mais confiável)
    const { data: savedGroups, error: dbError } = await supabase
      .from("pj_grupos_whatsapp")
      .select("*")
      .eq("user_id", userId)
      .eq("ativo", true)
      .order("nome");

    return new Response(
      JSON.stringify({
        success: true,
        groups: savedGroups || mappedGroups,
        fromApi: mappedGroups.length,
        synced: sync,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [PJ-GROUPS] Erro:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
