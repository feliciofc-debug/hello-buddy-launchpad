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
    const { groupName, categoria, userId } = await req.json();

    if (!groupName || !userId) {
      return new Response(
        JSON.stringify({ error: "groupName e userId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar token do afiliado
    const { data: cliente, error: clienteError } = await supabase
      .from("clientes_afiliados")
      .select("wuzapi_token")
      .eq("user_id", userId)
      .single();

    if (clienteError || !cliente?.wuzapi_token) {
      console.error("Erro ao buscar cliente:", clienteError);
      return new Response(
        JSON.stringify({ error: "Cliente não encontrado ou sem token WuzAPI" }),
        { status: 404, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const token = cliente.wuzapi_token;

    console.log(`Criando grupo: ${groupName} para user: ${userId}`);

    // Criar grupo via WuzAPI
    const createResponse = await fetch(`${CONTABO_WUZAPI_URL}/group/create`, {
      method: "POST",
      headers: { 
        "Token": token, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        Name: groupName,
        Participants: []  // Começa vazio, leads entram via link
      }),
    });

    const createResult = await createResponse.json();
    console.log("Resultado criação grupo:", JSON.stringify(createResult));

    if (!createResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao criar grupo", details: createResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // WuzAPI pode retornar GroupJid ou Jid dependendo da versão
    const groupJid = createResult.GroupJid || createResult.Jid || createResult.gid;

    if (!groupJid) {
      return new Response(
        JSON.stringify({ error: "Grupo criado mas JID não retornado", details: createResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Aguardar um pouco antes de gerar o link
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Gerar link de convite
    const linkResponse = await fetch(`${CONTABO_WUZAPI_URL}/group/invitelink`, {
      method: "POST",
      headers: { 
        "Token": token, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({ GroupJid: groupJid }),
    });

    const linkResult = await linkResponse.json();
    console.log("Resultado link convite:", JSON.stringify(linkResult));

    const inviteLink = linkResult.InviteLink || linkResult.inviteLink || linkResult.link;

    // Salvar no banco
    const { data: grupo, error: insertError } = await supabase
      .from("whatsapp_grupos_afiliado")
      .insert({
        user_id: userId,
        group_jid: groupJid,
        group_name: groupName,
        categoria: categoria || null,
        invite_link: inviteLink || null,
        member_count: 1, // Criador é membro
        ativo: true
      })
      .select()
      .single();

    if (insertError) {
      console.error("Erro ao salvar grupo:", insertError);
      return new Response(
        JSON.stringify({ error: "Grupo criado no WhatsApp mas erro ao salvar no banco", details: insertError }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ 
        success: true, 
        grupo,
        groupJid, 
        inviteLink 
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
