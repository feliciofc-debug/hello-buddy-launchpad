import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const CONTABO_WUZAPI_URL = "https://api2.amzofertas.com.br";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { userId, syncFromWhatsApp } = await req.json();

    if (!userId) {
      return new Response(
        JSON.stringify({ error: "userId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Se syncFromWhatsApp = true, buscar grupos direto da WuzAPI e sincronizar
    if (syncFromWhatsApp) {
      const { data: cliente } = await supabase
        .from("clientes_afiliados")
        .select("wuzapi_token")
        .eq("user_id", userId)
        .single();

      if (cliente?.wuzapi_token) {
        const response = await fetch(`${CONTABO_WUZAPI_URL}/group/list`, {
          method: "GET",
          headers: { 
            "Token": cliente.wuzapi_token,
            "Content-Type": "application/json" 
          },
        });

        if (response.ok) {
          const groups = await response.json();
          console.log("Grupos da WuzAPI:", JSON.stringify(groups));

          // Sincronizar com o banco
          for (const group of (groups.Groups || groups || [])) {
            const groupJid = group.JID || group.Jid || group.jid;
            const groupName = group.Name || group.name || group.Subject || group.subject;

            if (groupJid && groupName) {
              // Upsert - inserir se não existe, atualizar se existe
              await supabase
                .from("whatsapp_grupos_afiliado")
                .upsert({
                  user_id: userId,
                  group_jid: groupJid,
                  group_name: groupName,
                  member_count: group.Participants?.length || group.participants?.length || 0,
                  ativo: true,
                  updated_at: new Date().toISOString()
                }, {
                  onConflict: 'group_jid'
                });
            }
          }
        }
      }
    }

    // Buscar grupos do banco
    const { data: grupos, error } = await supabase
      .from("whatsapp_grupos_afiliado")
      .select("*")
      .eq("user_id", userId)
      .eq("ativo", true)
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Erro ao buscar grupos:", error);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar grupos", details: error }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: true, grupos }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (error: unknown) {
    console.error("Erro geral:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
