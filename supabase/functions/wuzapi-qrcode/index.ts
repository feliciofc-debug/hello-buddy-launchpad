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

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? ""
    );

    // Pegar user do header Authorization
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const token = authHeader.replace("Bearer ", "");
    const { data: { user }, error: userError } = await supabase.auth.getUser(token);
    
    if (userError || !user) {
      console.error("❌ Erro ao obter usuário:", userError);
      return new Response(JSON.stringify({ error: "Usuário não encontrado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { action } = await req.json();
    console.log(`📱 [WUZAPI-QRCODE] Action: ${action}, User: ${user.id}`);

    // Buscar instância do usuário
    let { data: userInstance, error: instanceError } = await supabase
      .from("wuzapi_instances")
      .select("*")
      .eq("assigned_to_user", user.id)
      .maybeSingle();

    // Se não tem instância, atribuir uma disponível
    if (!userInstance) {
      console.log("🔍 Usuário não tem instância, buscando disponível...");
      
      const { data: availableInstance, error: availableError } = await supabase
        .from("wuzapi_instances")
        .select("*")
        .is("assigned_to_user", null)
        .limit(1)
        .maybeSingle();

      if (availableError || !availableInstance) {
        console.error("❌ Nenhuma instância disponível:", availableError);
        return new Response(JSON.stringify({ 
          error: "Nenhuma instância WhatsApp disponível. Contate o suporte." 
        }), {
          status: 503,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      // Atribuir instância ao usuário
      const { data: assignedInstance, error: assignError } = await supabase
        .from("wuzapi_instances")
        .update({ 
          assigned_to_user: user.id,
          updated_at: new Date().toISOString()
        })
        .eq("id", availableInstance.id)
        .select()
        .single();

      if (assignError) {
        console.error("❌ Erro ao atribuir instância:", assignError);
        return new Response(JSON.stringify({ error: "Erro ao configurar WhatsApp" }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }

      userInstance = assignedInstance;
      console.log(`✅ Instância ${userInstance.instance_name} atribuída ao usuário`);
    }

    const { wuzapi_url, wuzapi_token } = userInstance;
    console.log(`📡 Usando instância: ${userInstance.instance_name} (${wuzapi_url})`);

    // ACTION: STATUS
    if (action === "status") {
      try {
        const statusResponse = await fetch(`${wuzapi_url}/session/status`, {
          method: "GET",
          headers: { "Token": wuzapi_token },
        });

        const statusData = await statusResponse.json();
        console.log("📊 Status Wuzapi:", statusData);

        // Estrutura: { code: 200, data: { connected, loggedIn, qrcode, jid } }
        const data = statusData?.data || statusData;
        const isConnected = data?.loggedIn === true || data?.LoggedIn === true;
        const phoneNumber = data?.jid?.split(':')[0] || data?.PhoneNumber || null;

        // Atualizar status no banco se mudou
        if (userInstance.is_connected !== isConnected || userInstance.phone_number !== phoneNumber) {
          await supabase
            .from("wuzapi_instances")
            .update({ 
              is_connected: isConnected,
              phone_number: phoneNumber,
              connected_at: isConnected ? new Date().toISOString() : null,
              updated_at: new Date().toISOString()
            })
            .eq("id", userInstance.id);
        }

        return new Response(JSON.stringify({
          success: true,
          connected: isConnected,
          loggedin: isConnected,
          phone_number: phoneNumber,
          instance_name: userInstance.instance_name,
          jid: data?.jid,
          qrcode: data?.qrcode || null  // Incluir QR code no status
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (error) {
        console.error("❌ Erro ao verificar status:", error);
        return new Response(JSON.stringify({ 
          success: false, 
          connected: false,
          error: "Erro ao verificar status" 
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ACTION: CONNECT (iniciar sessão e gerar QR Code)
    if (action === "connect") {
      try {
        console.log("🔄 Iniciando sessão via POST /session/connect...");
        
        // PRIMEIRO: Chamar POST /session/connect COM BODY VAZIO para iniciar a sessão
        const connectResponse = await fetch(`${wuzapi_url}/session/connect`, {
          method: "POST",
          headers: { 
            "Token": wuzapi_token,
            "Content-Type": "application/json"
          },
          body: JSON.stringify({})  // WUZAPI EXIGE BODY JSON VAZIO!
        });

        const connectData = await connectResponse.json();
        console.log("📡 Resposta /session/connect:", JSON.stringify(connectData, null, 2));

        // Aguardar um pouco para o QR ser gerado
        await new Promise(resolve => setTimeout(resolve, 2000));

        // DEPOIS: Buscar o status com o QR Code
        const statusResponse = await fetch(`${wuzapi_url}/session/status`, {
          method: "GET",
          headers: { "Token": wuzapi_token },
        });

        const statusData = await statusResponse.json();
        console.log("📊 Status após connect:", JSON.stringify(statusData, null, 2));

        const data = statusData?.data || statusData;
        const isLoggedIn = data?.loggedIn === true;
        const qrCode = data?.qrcode || null;
        const phoneNumber = data?.jid?.split(':')[0];

        // Se já está logado
        if (isLoggedIn) {
          console.log("✅ WhatsApp já conectado!");
          
          await supabase
            .from("wuzapi_instances")
            .update({ 
              is_connected: true,
              phone_number: phoneNumber,
              connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString()
            })
            .eq("id", userInstance.id);

          return new Response(JSON.stringify({
            success: true,
            already_connected: true,
            loggedin: true,
            phone_number: phoneNumber,
            instance_name: userInstance.instance_name,
            message: "WhatsApp já está conectado"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Se tem QR code
        if (qrCode && qrCode.length > 0) {
          console.log("📷 QR Code encontrado!");
          return new Response(JSON.stringify({
            success: true,
            qrcode: qrCode,
            instance_name: userInstance.instance_name,
            message: "Escaneie o QR Code com seu WhatsApp"
          }), {
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          });
        }

        // Sem QR ainda - retornar para retry
        console.log("⏳ QR não disponível ainda, aguardando...");
        return new Response(JSON.stringify({
          success: false,
          retry: true,
          error: "Aguardando QR Code... Tente novamente em 2 segundos.",
          raw_response: statusData
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (error) {
        console.error("❌ Erro ao gerar QR:", error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Erro ao conectar WhatsApp: " + (error instanceof Error ? error.message : String(error))
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ACTION: ACTIVATE (chamar POST /session/connect após scan do QR)
    if (action === "activate") {
      try {
        console.log("🔗 Ativando sessão via POST /session/connect...");
        
        const connectResponse = await fetch(`${wuzapi_url}/session/connect`, {
          method: "POST",
          headers: { 
            "Token": wuzapi_token,
            "Content-Type": "application/json"
          }
        });

        const connectData = await connectResponse.json();
        console.log("📡 Resposta /session/connect:", JSON.stringify(connectData, null, 2));

        return new Response(JSON.stringify({
          success: true,
          data: connectData,
          message: "Sessão ativada"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (error) {
        console.error("❌ Erro ao ativar sessão:", error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Erro ao ativar sessão: " + (error instanceof Error ? error.message : String(error))
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    // ACTION: DISCONNECT
    if (action === "disconnect") {
      try {
        console.log("🔌 Desconectando WhatsApp...");
        const logoutResponse = await fetch(`${wuzapi_url}/session/logout`, {
          method: "POST",
          headers: { "Token": wuzapi_token },
        });

        const logoutData = await logoutResponse.json();
        console.log("📴 Resposta logout:", logoutData);

        // Atualizar status no banco
        await supabase
          .from("wuzapi_instances")
          .update({ 
            is_connected: false,
            phone_number: null,
            connected_at: null,
            updated_at: new Date().toISOString()
          })
          .eq("id", userInstance.id);

        return new Response(JSON.stringify({
          success: true,
          message: "WhatsApp desconectado com sucesso"
        }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });

      } catch (error) {
        console.error("❌ Erro ao desconectar:", error);
        return new Response(JSON.stringify({ 
          success: false, 
          error: "Erro ao desconectar WhatsApp" 
        }), {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
    }

    return new Response(JSON.stringify({ error: "Ação não reconhecida" }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  } catch (error) {
    console.error("❌ Erro geral:", error);
    return new Response(JSON.stringify({ 
      error: error instanceof Error ? error.message : "Erro interno" 
    }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
