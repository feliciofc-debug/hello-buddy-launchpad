// ============================================
// CRIAR GRUPO WHATSAPP PJ - EDGE FUNCTION
// AMZ Ofertas - Sistema PJ (Locaweb)
// ============================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// PJ usa Locaweb
const LOCAWEB_WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";
const LOCAWEB_WUZAPI_TOKEN = Deno.env.get("WUZAPI_TOKEN") || "";

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { groupName, descricao, userId } = await req.json();

    if (!groupName || !userId) {
      return new Response(
        JSON.stringify({ error: "groupName e userId são obrigatórios" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📱 [PJ-GROUP-CREATE] Criando grupo: ${groupName} para user: ${userId}`);

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Buscar token do usuário (ou usar default)
    let wuzapiToken = LOCAWEB_WUZAPI_TOKEN;
    const { data: config } = await supabase
      .from("pj_clientes_config")
      .select("wuzapi_token, telefone")
      .eq("user_id", userId)
      .maybeSingle();

    if (config?.wuzapi_token) {
      wuzapiToken = config.wuzapi_token;
    }

    // Telefone para ser o admin do grupo
    let telefoneAdmin = config?.telefone?.replace(/\D/g, '') || '';
    if (telefoneAdmin && !telefoneAdmin.startsWith("55")) {
      telefoneAdmin = "55" + telefoneAdmin;
    }

    // Criar grupo via WuzAPI
    const createResponse = await fetch(`${LOCAWEB_WUZAPI_URL}/group/create`, {
      method: "POST",
      headers: { 
        "Token": wuzapiToken, 
        "Content-Type": "application/json" 
      },
      body: JSON.stringify({
        Name: groupName,
        Participants: telefoneAdmin ? [telefoneAdmin] : ["5500000000000"]
      }),
    });

    const createText = await createResponse.text();
    console.log("📋 [PJ-GROUP-CREATE] Resultado criação (raw):", createText);
    
    let createResult;
    try {
      createResult = JSON.parse(createText);
    } catch {
      console.error("❌ [PJ-GROUP-CREATE] Resposta não é JSON válido:", createText);
      return new Response(
        JSON.stringify({ error: "Resposta inválida da API WuzAPI", details: createText }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (!createResponse.ok) {
      return new Response(
        JSON.stringify({ error: "Erro ao criar grupo", details: createResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrair JID do grupo (diferentes formatos possíveis)
    const groupJid =
      createResult?.GroupJid ||
      createResult?.Jid ||
      createResult?.gid ||
      createResult?.JID ||
      createResult?.data?.GroupJid ||
      createResult?.data?.Jid ||
      createResult?.data?.gid ||
      createResult?.data?.JID;

    if (!groupJid) {
      return new Response(
        JSON.stringify({ error: "Grupo criado mas JID não retornado", details: createResult }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`✅ [PJ-GROUP-CREATE] Grupo criado com JID: ${groupJid}`);

    // Aguardar antes de gerar link
    await new Promise(resolve => setTimeout(resolve, 1000));

    // Gerar link de convite
    const endpoints = [
      "/chat/group/invitelink",
      "/group/invitelink", 
      "/group/invite"
    ];
    
    let inviteLink = null;
    
    for (const endpoint of endpoints) {
      console.log(`🔗 [PJ-GROUP-CREATE] Tentando endpoint: ${endpoint}`);
      const linkResponse = await fetch(`${LOCAWEB_WUZAPI_URL}${endpoint}`, {
        method: "POST",
        headers: { 
          "Token": wuzapiToken, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({ GroupJid: groupJid }),
      });
      
      const linkText = await linkResponse.text();
      
      if (!linkText.includes("404") && !linkText.includes("not found")) {
        try {
          const linkResult = JSON.parse(linkText);
          inviteLink = linkResult?.InviteLink || linkResult?.inviteLink || linkResult?.link || linkResult?.data?.InviteLink;
          if (inviteLink) break;
        } catch {
          console.warn("⚠️ [PJ-GROUP-CREATE] Link convite não retornou JSON válido:", linkText);
        }
      }
    }

    console.log(`🔗 [PJ-GROUP-CREATE] Link de convite: ${inviteLink || "não disponível"}`);

    // Salvar no banco (tabela PJ)
    const { data: grupo, error: insertError } = await supabase
      .from("pj_grupos_whatsapp")
      .insert({
        user_id: userId,
        grupo_jid: groupJid,
        nome: groupName,
        descricao: descricao || null,
        invite_link: inviteLink || null,
        participantes_count: 1,
        ativo: true
      })
      .select()
      .single();

    if (insertError) {
      console.error("❌ [PJ-GROUP-CREATE] Erro ao salvar grupo:", insertError);
      return new Response(
        JSON.stringify({ 
          success: true,
          warning: "Grupo criado no WhatsApp mas erro ao salvar no banco",
          groupJid, 
          inviteLink,
          details: insertError 
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
    console.error("💥 [PJ-GROUP-CREATE] Erro geral:", error);
    const message = error instanceof Error ? error.message : "Erro desconhecido";
    return new Response(
      JSON.stringify({ error: message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
