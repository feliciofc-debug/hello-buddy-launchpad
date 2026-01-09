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
    const { groupJid, userId } = await req.json();

    if (!groupJid || !userId) {
      return new Response(
        JSON.stringify({ error: "groupJid e userId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar token do usuário
    const { data: cliente } = await supabase
      .from("clientes_afiliados")
      .select("wuzapi_token")
      .eq("user_id", userId)
      .single();

    if (!cliente?.wuzapi_token) {
      return new Response(
        JSON.stringify({ error: "WhatsApp não conectado" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar informações do grupo via WuzAPI - método GET com body
    const response = await fetch(`${CONTABO_WUZAPI_URL}/group/info`, {
      method: "GET",
      headers: {
        "Token": cliente.wuzapi_token,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({ GroupJID: groupJid })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error("Erro WuzAPI:", errorText);
      return new Response(
        JSON.stringify({ error: "Erro ao buscar grupo", details: errorText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const groupInfo = await response.json();
    console.log("Group info:", JSON.stringify(groupInfo));

    // Extrair participantes - WuzAPI retorna em Participants
    const participants = groupInfo.Participants || groupInfo.participants || [];

    // Formatar participantes
    const formattedParticipants = participants.map((p: any) => ({
      jid: p.JID || p.Jid || p.jid || "",
      phone: (p.JID || p.Jid || p.jid || "").split("@")[0],
      isAdmin: p.IsAdmin || p.isAdmin || p.Admin === "admin" || p.Admin === "superadmin" || false,
      isSuperAdmin: p.IsSuperAdmin || p.isSuperAdmin || p.Admin === "superadmin" || false
    }));

    // Atualizar contagem de membros no banco
    await supabase
      .from("whatsapp_grupos_afiliado")
      .update({ member_count: formattedParticipants.length })
      .eq("group_jid", groupJid)
      .eq("user_id", userId);

    return new Response(
      JSON.stringify({ 
        success: true, 
        participants: formattedParticipants,
        groupName: groupInfo.Name || groupInfo.name || groupInfo.Subject || "",
        totalMembers: formattedParticipants.length
      }),
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
