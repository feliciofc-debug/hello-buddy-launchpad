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
    const { groupName, descricao, userId, telefoneAdmin: telefoneAdminBody } = await req.json();

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

    // Buscar configuração do usuário PJ
    let baseUrl = LOCAWEB_WUZAPI_URL;
    let wuzapiToken = LOCAWEB_WUZAPI_TOKEN;
    
    const { data: config } = await supabase
      .from("pj_clientes_config")
      .select("wuzapi_token, wuzapi_port, telefone")
      .eq("user_id", userId)
      .maybeSingle();

    if (config?.wuzapi_token) {
      wuzapiToken = config.wuzapi_token;
    }
    
    // Buscar instância mapeada com IP:Porta real (não usar domínio)
    const targetPort = Number(config?.wuzapi_port || 8080);
    const { data: mappedInstance } = await supabase
      .from("wuzapi_instances")
      .select("wuzapi_url, wuzapi_token")
      .eq("assigned_to_user", userId)
      .eq("port", targetPort)
      .maybeSingle();
    
    if (mappedInstance?.wuzapi_url) {
      baseUrl = mappedInstance.wuzapi_url.replace(/\/+$/, "");
      console.log("📡 [PJ-GROUP-CREATE] Usando instância:", baseUrl);
    }
    if (mappedInstance?.wuzapi_token) {
      wuzapiToken = mappedInstance.wuzapi_token;
    }

    // Telefone para ser o admin do grupo (prioridade: body -> config)
    let telefoneAdmin = (telefoneAdminBody || config?.telefone || "").toString().replace(/\D/g, "");
    if (telefoneAdmin && !telefoneAdmin.startsWith("55")) {
      telefoneAdmin = "55" + telefoneAdmin;
    }

    // WuzAPI exige Participants no payload para criar grupo
    if (!telefoneAdmin) {
      return new Response(
        JSON.stringify({
          error: "Informe um número de WhatsApp (com DDD) para ser admin do grupo.",
          details: { missing: "telefoneAdmin" },
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Verificar se sessão está ativa antes de criar grupo
    console.log("📡 [PJ-GROUP-CREATE] Verificando sessão antes de criar grupo...");
    const statusResp = await fetch(`${baseUrl}/session/status`, {
      method: "GET",
      headers: { "Token": wuzapiToken },
    });
    const statusData = await statusResp.json().catch(() => ({}));
    const innerStatus = statusData?.data || statusData;
    const isConnected = innerStatus?.connected === true || innerStatus?.loggedIn === true;
    
    if (!isConnected) {
      console.error("❌ [PJ-GROUP-CREATE] Sessão não conectada:", statusData);
      return new Response(
        JSON.stringify({ 
          error: "WhatsApp não está conectado. Reconecte via QR Code.",
          details: statusData 
        }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }
    console.log("✅ [PJ-GROUP-CREATE] Sessão ativa, criando grupo...");

    // Criar grupo via WuzAPI - tentar múltiplos endpoints
    const createEndpoints = [
      "/group/create",
      "/chat/group/create",
    ];
    
    let createResult: any = null;
    let createSuccess = false;
    
    for (const endpoint of createEndpoints) {
      console.log(`📱 [PJ-GROUP-CREATE] Tentando endpoint: ${endpoint}`);
      
      // Preparar participantes - precisa ter pelo menos 1 número além do admin
      // Se não tiver telefone do admin, passar array vazio (o próprio número conectado vira admin)
      const participants: string[] = [];
      if (telefoneAdmin) {
        // Formato WuzAPI: número@s.whatsapp.net
        participants.push(`${telefoneAdmin}@s.whatsapp.net`);
      }
      
      console.log(`📱 [PJ-GROUP-CREATE] Participantes: ${JSON.stringify(participants)}`);
      
      const createResponse = await fetch(`${baseUrl}${endpoint}`, {
        method: "POST",
        headers: { 
          "Token": wuzapiToken, 
          "Content-Type": "application/json" 
        },
        body: JSON.stringify({
          Name: groupName,
          Participants: participants
        }),
      });

      const createText = await createResponse.text();
      console.log(`📋 [PJ-GROUP-CREATE] Resultado ${endpoint}:`, createText);
      
      try {
        createResult = JSON.parse(createText);
      } catch {
        console.warn(`⚠️ [PJ-GROUP-CREATE] Resposta não é JSON em ${endpoint}:`, createText);
        continue;
      }

      // Verificar se é erro real (code >= 400 ou mensagem de erro)
      const code = createResult?.code || createResponse.status;
      const errorMsg = createResult?.error || createResult?.message || "";
      
      if (code >= 400 || errorMsg.toLowerCase().includes("no session") || errorMsg.toLowerCase().includes("not connected")) {
        console.warn(`⚠️ [PJ-GROUP-CREATE] Erro em ${endpoint}: code=${code}, error=${errorMsg}`);
        continue;
      }
      
      // Se chegou aqui, provavelmente funcionou
      if (createResult?.data?.Jid || createResult?.Jid || createResult?.GroupJid || createResult?.gid) {
        createSuccess = true;
        break;
      }
      
      // Se success=true mas sem JID, pode ser que o grupo foi criado mas resposta incompleta
      if (createResult?.success === true && code < 400) {
        createSuccess = true;
        break;
      }
    }

    if (!createSuccess || !createResult) {
      return new Response(
        JSON.stringify({ 
          error: "Não foi possível criar o grupo. Verifique se o WhatsApp está conectado.",
          details: createResult 
        }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Extrair JID do grupo (diferentes formatos possíveis)
    const groupJid =
      createResult?.data?.Jid ||
      createResult?.data?.GroupJid ||
      createResult?.data?.gid ||
      createResult?.data?.JID ||
      createResult?.GroupJid ||
      createResult?.Jid ||
      createResult?.gid ||
      createResult?.JID;

    if (!groupJid) {
      // Se não retornou JID mas criou, tentar buscar grupos para encontrar o novo
      console.warn("⚠️ [PJ-GROUP-CREATE] Grupo pode ter sido criado mas JID não retornado");
      return new Response(
        JSON.stringify({ 
          warning: "Grupo possivelmente criado, mas JID não retornado. Sincronize os grupos.",
          details: createResult 
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
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
      const linkResponse = await fetch(`${baseUrl}${endpoint}`, {
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
