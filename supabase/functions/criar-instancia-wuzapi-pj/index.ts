import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Fallback (caso não exista instância mapeada no banco)
const LOCAWEB_WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";
const LOCAWEB_WUZAPI_TOKEN = Deno.env.get("WUZAPI_TOKEN") || "";

async function safeReadJson(resp: Response) {
  const text = await resp.text();
  try {
    return { ok: true as const, json: JSON.parse(text), text };
  } catch (e: any) {
    return { ok: false as const, error: e?.message || "JSON parse failed", text };
  }
}

function extractQrCodePayload(qrData: any): string | null {
  const raw = qrData?.QRCode || qrData?.qrcode || qrData?.data?.QRCode || qrData?.data?.qrcode || qrData?.qr?.QRCode || null;
  if (!raw) return null;
  if (typeof raw !== "string") return null;
  if (raw.startsWith("data:image")) {
    const idx = raw.indexOf("base64,");
    return idx >= 0 ? raw.slice(idx + "base64,".length) : raw;
  }
  return raw;
}

async function tryPostJson(url: string, headers: Record<string, string>, body: any) {
  const resp = await fetch(url, {
    method: "POST",
    headers: { ...headers, "Content-Type": "application/json" },
    body: JSON.stringify(body ?? {}),
  });
  const parsed = await safeReadJson(resp);
  return { resp, parsed };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json().catch(() => ({}));
    let userId: string | undefined = body?.userId;
    const action: string | undefined = body?.action;

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // UX: permitir chamadas administrativas (ex: diagnóstico) sem userId,
    // usando a primeira configuração PJ existente.
    if (!userId) {
      const { data: fallbackConfig } = await supabase
        .from("pj_clientes_config")
        .select("user_id")
        .order("created_at", { ascending: true })
        .limit(1)
        .maybeSingle();

      if (fallbackConfig?.user_id) {
        userId = fallbackConfig.user_id;
      }
    }

    console.log(`📱 [PJ-WUZAPI] Ação: ${action} para user: ${userId}`);

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "userId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Buscar ou criar configuração do cliente PJ
    let { data: clienteConfig, error: configError } = await supabase
      .from("pj_clientes_config")
      .select("*")
      .eq("user_id", userId)
      .maybeSingle();

    if (!clienteConfig) {
      // Criar configuração inicial
      const { data: newConfig, error: insertError } = await supabase
        .from("pj_clientes_config")
        .insert({
          user_id: userId,
          wuzapi_token: LOCAWEB_WUZAPI_TOKEN,
          wuzapi_instance_name: "pj-default",
          wuzapi_port: 8080,
        })
        .select()
        .single();

      if (insertError) {
        console.error("❌ Erro ao criar config:", insertError);
        throw insertError;
      }
      clienteConfig = newConfig;
    }

    // ✅ Igual ao PJ antigo: usar a instância real (http://191.252.193.73:808x) vinda de wuzapi_instances
    // Isso evita o 404 do domínio wuzapi.amzofertas.com.br em /session/connect.
    const targetPort = Number(clienteConfig.wuzapi_port || 8080);
    const { data: mappedInstance } = await supabase
      .from("wuzapi_instances")
      .select("wuzapi_url, wuzapi_token, instance_name, port")
      .eq("assigned_to_user", userId)
      .eq("port", targetPort)
      .maybeSingle();

    const baseUrl = (mappedInstance?.wuzapi_url || LOCAWEB_WUZAPI_URL).replace(/\/+$/, "");
    const wuzapiToken = mappedInstance?.wuzapi_token || clienteConfig.wuzapi_token || LOCAWEB_WUZAPI_TOKEN;

    if (action === "connect" || action === "qrcode") {
      // Gerar QR Code para conexão
      console.log("📲 Gerando QR Code...");
      console.log(`📡 Base URL: ${baseUrl}`);

      // A WuzAPI da Locaweb usa endpoint diferente!
      // Primeiro, verificar se já está conectado
      let isAlreadyConnected = false;
      try {
        const statusResp = await fetch(`${baseUrl}/session/status`, {
          method: "GET",
          headers: { "Token": wuzapiToken },
        });
        const statusParsed = await safeReadJson(statusResp);
        if (statusParsed.ok) {
          const innerData = statusParsed.json?.data || statusParsed.json;
          isAlreadyConnected = innerData?.connected === true || innerData?.loggedIn === true;
          console.log("📊 Status atual:", { connected: isAlreadyConnected, jid: innerData?.jid });
          
          if (isAlreadyConnected) {
            return new Response(
              JSON.stringify({ 
                success: true, 
                status: "already_connected",
                message: "WhatsApp já está conectado!",
                jid: innerData?.jid 
              }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (e) {
        console.log("⚠️ Não foi possível verificar status:", e);
      }

      // 0) Tenta pegar QR direto primeiro (build Locaweb pode já ter QR disponível)
      const qrEndpoints = [
        `${baseUrl}/session/qr`,
        `${baseUrl}/qr`,
        `${baseUrl}/api/qr`,
      ];

      for (const qrUrl of qrEndpoints) {
        try {
          const preQrResp = await fetch(qrUrl, {
            method: "GET",
            headers: { "Token": wuzapiToken },
          });

          console.log(`📲 Tentando QR em ${qrUrl}: status ${preQrResp.status}`);
          
          if (preQrResp.status === 404) continue;

          const preQrParsed = await safeReadJson(preQrResp);
          if (preQrParsed.ok) {
            const preQrCode = extractQrCodePayload(preQrParsed.json);
            if (preQrCode) {
              console.log("✅ QR Code encontrado!");
              return new Response(
                JSON.stringify({ success: true, qrCode: preQrCode, status: "awaiting_scan" }),
                { headers: { ...corsHeaders, "Content-Type": "application/json" } }
              );
            }
          }
        } catch (_) {
          // ignore
        }
      }

      // 1) Tenta iniciar sessão com múltiplos endpoints (diferentes builds de WuzAPI)
      // IMPORTANTE: Incluir Subscribe para receber eventos de mensagem!
      const connectCandidates = [
        { url: `${baseUrl}/user/qr`, method: "GET", noBody: true },
        { url: `${baseUrl}/session/qr`, method: "POST", noBody: false },
        { url: `${baseUrl}/session/connect`, method: "POST", noBody: false },
        { url: `${baseUrl}/session/start`, method: "POST", noBody: false },
        { url: `${baseUrl}/session/login`, method: "POST", noBody: false },
        { url: `${baseUrl}/api/session/connect`, method: "POST", noBody: false },
      ];

      // Payload com eventos para receber mensagens
      const connectPayload = {
        Subscribe: ["Message", "ReadReceipt", "ChatPresence", "Presence"],
        Immediate: true
      };

      let connectOk = false;
      let lastConnectRaw: string | null = null;
      let lastConnectStatus: number | null = null;
      let qrCodeFound: string | null = null;

      for (const candidate of connectCandidates) {
        try {
          console.log(`📲 Tentando ${candidate.method} ${candidate.url}...`);
          
          let resp: Response;
          let parsed: { ok: boolean; json?: any; text: string; error?: string };
          
          if (candidate.method === "GET" || candidate.noBody) {
            resp = await fetch(candidate.url, {
              method: candidate.method,
              headers: { "Token": wuzapiToken },
            });
            parsed = await safeReadJson(resp);
          } else {
            const result = await tryPostJson(candidate.url, { Token: wuzapiToken }, connectPayload);
            resp = result.resp;
            parsed = result.parsed;
          }
          
          lastConnectStatus = resp.status;
          lastConnectRaw = parsed.text;

          console.log(`   Status: ${resp.status}, OK: ${resp.ok}`);

          if (resp.status === 404) continue;
          
          if (parsed.ok) {
            // Verificar se a resposta já contém QR code
            const possibleQr = extractQrCodePayload(parsed.json);
            if (possibleQr) {
              qrCodeFound = possibleQr;
              console.log("✅ QR Code encontrado na resposta!");
              break;
            }
            
            if (resp.ok && parsed.json?.success !== false) {
              connectOk = true;
              console.log("✅ Endpoint funcionou:", candidate.url);
              break;
            }
          }
          
          if (resp.ok) {
            connectOk = true;
            break;
          }
        } catch (e) {
          console.error(`❌ Erro em ${candidate.url}:`, e);
        }
      }

      // Se encontrou QR code diretamente, retornar
      if (qrCodeFound) {
        return new Response(
          JSON.stringify({ success: true, qrCode: qrCodeFound, status: "awaiting_scan" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      // 2) Buscar QR Code (retry, igual Afiliados)
      for (let i = 0; i < 5; i++) {
        for (const qrUrl of qrEndpoints) {
          try {
            const qrResponse = await fetch(qrUrl, {
              method: "GET",
              headers: { "Token": wuzapiToken },
            });

            if (qrResponse.status === 404) continue;

            const qrParsed = await safeReadJson(qrResponse);
            if (qrParsed.ok) {
              const qrCode = extractQrCodePayload(qrParsed.json);
              if (qrCode) {
                return new Response(
                  JSON.stringify({ success: true, qrCode, status: "awaiting_scan" }),
                  { headers: { ...corsHeaders, "Content-Type": "application/json" } }
                );
              }
            }
          } catch (_) {
            // ignore
          }
        }
        await new Promise((r) => setTimeout(r, 1200));
      }

      // Se chegou aqui, não conseguiu QR.
      // Retornar diagnóstico detalhado para ajudar a resolver
      return new Response(
        JSON.stringify({
          success: false,
          error: "Não foi possível gerar QR Code. A sessão pode precisar ser reiniciada no servidor.",
          details: {
            baseUrl,
            lastStatus: lastConnectStatus,
            connectOk,
            hint: "Tente desconectar e reconectar, ou verifique o painel WuzAPI diretamente.",
          },
          raw: (lastConnectRaw || "").slice(0, 300),
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "status") {
      // Verificar status da conexão
      const statusResponse = await fetch(`${baseUrl}/session/status`, {
        method: "GET",
        headers: { "Token": wuzapiToken },
      });

      const statusParsed = await safeReadJson(statusResponse);
      if (!statusParsed.ok) {
        console.error("❌ Resposta /session/status não é JSON:", statusParsed.text);
        return new Response(
          JSON.stringify({
            success: false,
            error: "Resposta inválida do servidor WuzAPI (status)",
            raw: statusParsed.text?.slice(0, 500) || "",
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      const statusData = statusParsed.json;
      console.log("📊 Status:", statusData);

      // WuzAPI retorna: { code: 200, data: { connected: true, loggedIn: true, jid: "..." }, success: true }
      // Precisamos extrair do objeto `data` interno
      const innerData = statusData?.data || statusData;
      const isConnected = innerData?.connected === true || innerData?.loggedIn === true || statusData?.Connected === true;
      const jid = innerData?.jid || statusData?.JID || statusData?.jid || "";

      // Atualizar status no banco
      await supabase
        .from("pj_clientes_config")
        .update({
          whatsapp_conectado: isConnected,
          wuzapi_jid: jid,
          ultimo_status_check: new Date().toISOString(),
        })
        .eq("user_id", userId);

      // Também sincronizar o status da instância (melhora confiabilidade dos envios e diagnósticos)
      try {
        await supabase
          .from("wuzapi_instances")
          .update({
            is_connected: isConnected,
            connected_at: isConnected ? new Date().toISOString() : null,
            phone_number: jid ? String(jid).split("@")[0] : null,
          })
          .eq("assigned_to_user", userId)
          .eq("port", targetPort);
      } catch (e) {
        console.log("⚠️ [PJ-WUZAPI] Falha ao sincronizar wuzapi_instances:", e);
      }

      return new Response(
        JSON.stringify({
          success: true,
          connected: isConnected,
          jid,
          port: targetPort,
          baseUrl,
          raw: statusData,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "find_connected_port") {
      // Verifica todas as portas para encontrar qual está conectada
      console.log("🔍 Procurando porta conectada...");
      
      const { data: allInstances } = await supabase
        .from("wuzapi_instances")
        .select("port, wuzapi_url, wuzapi_token, instance_name")
        .like("wuzapi_url", "%191.252.193.73%")
        .order("port");

      const results: any[] = [];
      let connectedPort: number | null = null;
      let connectedJid: string | null = null;

      for (const inst of allInstances || []) {
        try {
          const resp = await fetch(`${inst.wuzapi_url}/session/status`, {
            method: "GET",
            headers: { "Token": inst.wuzapi_token },
          });
          const parsed = await safeReadJson(resp);
          
          if (parsed.ok) {
            const innerData = parsed.json?.data || parsed.json;
            const isConn = innerData?.connected === true || innerData?.loggedIn === true;
            const jid = innerData?.jid || "";
            
            results.push({
              port: inst.port,
              instance_name: inst.instance_name,
              connected: isConn,
              jid: jid,
            });

            if (isConn && !connectedPort) {
              connectedPort = inst.port;
              connectedJid = jid;
            }
          }
        } catch (e) {
          results.push({ port: inst.port, error: "timeout/unreachable" });
        }
      }

      // Se encontrou uma porta conectada, atualiza a config do usuário
      if (connectedPort) {
        await supabase
          .from("pj_clientes_config")
          .update({
            wuzapi_port: connectedPort,
            whatsapp_conectado: true,
            wuzapi_jid: connectedJid,
          })
          .eq("user_id", userId);
        
        console.log(`✅ Porta ${connectedPort} está conectada! Config atualizada.`);
      }

      return new Response(
        JSON.stringify({
          success: true,
          connectedPort,
          connectedJid,
          allPorts: results,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "disconnect") {
      // Desconectar WhatsApp
      const disconnectCandidates = [
        `${baseUrl}/session/disconnect`,
        `${baseUrl}/session/logout`,
      ];

      let disconnectData: any = null;
      for (const url of disconnectCandidates) {
        const { resp, parsed } = await tryPostJson(url, { Token: wuzapiToken }, {});
        if (parsed.ok) {
          disconnectData = parsed.json;
          console.log("🔌 Disconnect:", disconnectData);
          if (resp.ok && disconnectData?.success !== false) break;
          if (resp.status === 404) continue;
          break;
        }
        if (resp.status === 404) continue;
        // se não for JSON e não 404, não bloqueia o fluxo
        if (resp.ok) break;
      }

      // Atualizar status no banco
      await supabase
        .from("pj_clientes_config")
        .update({
          whatsapp_conectado: false,
          wuzapi_jid: null,
        })
        .eq("user_id", userId);

      return new Response(
        JSON.stringify({ success: true, message: "Desconectado com sucesso" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "configure_webhook") {
      // Configurar webhook para receber mensagens + eventos
      console.log("🔧 Configurando webhook e eventos...");
      
      const supabaseUrlEnv = Deno.env.get("SUPABASE_URL")!;
      const webhookUrl = `${supabaseUrlEnv}/functions/v1/wuzapi-webhook-pj`;
      
      // Configurar webhook URL + eventos importantes
      // Eventos que precisamos: Message (para receber mensagens)
      const webhookPayload = {
        webhookURL: webhookUrl,
        events: "Message,ReadReceipt,ChatPresence,Presence,HistorySync,Receipt"
      };
      
      let webhookConfigured = false;
      let eventsConfigured = false;
      let lastResponse: any = null;

      // Primeiro, configurar o webhook
      try {
        const { resp, parsed } = await tryPostJson(`${baseUrl}/webhook`, { Token: wuzapiToken }, webhookPayload);
        lastResponse = { url: `${baseUrl}/webhook`, status: resp.status, data: parsed.json || parsed.text };
        
        if (resp.ok && parsed.ok) {
          console.log(`✅ Webhook + eventos configurados:`, parsed.json);
          webhookConfigured = true;
          eventsConfigured = true;
        }
      } catch (e) {
        console.error(`❌ Erro ao configurar webhook:`, e);
      }

      // Se falhou, tentar endpoint alternativo
      if (!webhookConfigured) {
        const webhookCandidates = [
          { url: `${baseUrl}/session/webhook`, body: { url: webhookUrl, events: "Message,ReadReceipt" } },
          { url: `${baseUrl}/settings/webhook`, body: { webhook: webhookUrl, events: "Message,ReadReceipt" } },
        ];

        for (const candidate of webhookCandidates) {
          try {
            const { resp, parsed } = await tryPostJson(candidate.url, { Token: wuzapiToken }, candidate.body);
            lastResponse = { url: candidate.url, status: resp.status, data: parsed.json || parsed.text };
            
            if (resp.ok && parsed.ok) {
              console.log(`✅ Webhook configurado via ${candidate.url}:`, parsed.json);
              webhookConfigured = true;
              break;
            }
          } catch (e) {
            console.error(`❌ Erro em ${candidate.url}:`, e);
          }
        }
      }

      return new Response(
        JSON.stringify({
          success: webhookConfigured,
          webhookUrl,
          eventsConfigured,
          events: "Message,ReadReceipt,ChatPresence,Presence,HistorySync,Receipt",
          message: webhookConfigured 
            ? "Webhook e eventos configurados com sucesso!" 
            : "Não foi possível configurar o webhook automaticamente. Configure manualmente.",
          lastResponse,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    if (action === "reconnect_with_events") {
      // Reconectar sessão COM os eventos de Subscribe ativados
      console.log("🔄 Reconectando sessão com eventos ativados...");

      // 1. Primeiro, desconectar a sessão atual (sem logout para manter o pareamento)
      try {
        await fetch(`${baseUrl}/session/disconnect`, {
          method: "POST",
          headers: { Token: wuzapiToken, "Content-Type": "application/json" },
          body: JSON.stringify({})
        });
        console.log("⏸️ Sessão desconectada");
        
        // Aguardar um pouco para a desconexão
        await new Promise(r => setTimeout(r, 2000));
      } catch (e) {
        console.error("⚠️ Erro ao desconectar:", e);
      }

      // 2. Reconectar com os eventos
      const connectPayload = {
        Subscribe: ["Message", "ReadReceipt", "ChatPresence", "Presence"],
        Immediate: true
      };

      let reconnectOk = false;
      let lastResponse: any = null;

      try {
        const { resp, parsed } = await tryPostJson(
          `${baseUrl}/session/connect`,
          { Token: wuzapiToken },
          connectPayload
        );
        
        lastResponse = { status: resp.status, data: parsed.json || parsed.text };
        
        if (resp.ok && parsed.ok) {
          console.log("✅ Reconectado com eventos:", parsed.json);
          reconnectOk = true;
        }
      } catch (e) {
        console.error("❌ Erro ao reconectar:", e);
      }

      // 3. Aguardar e verificar status
      await new Promise(r => setTimeout(r, 3000));

      let finalStatus: any = null;
      try {
        const statusResp = await fetch(`${baseUrl}/session/status`, {
          method: "GET",
          headers: { Token: wuzapiToken }
        });
        const statusParsed = await safeReadJson(statusResp);
        finalStatus = statusParsed.json;
      } catch (_) {}

      return new Response(
        JSON.stringify({
          success: reconnectOk,
          message: reconnectOk 
            ? "Sessão reconectada com eventos Message habilitados!" 
            : "Falha ao reconectar. A sessão pode precisar de novo QR code.",
          subscribedEvents: ["Message", "ReadReceipt", "ChatPresence", "Presence"],
          lastResponse,
          currentStatus: finalStatus
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    return new Response(
      JSON.stringify({ success: false, error: "Ação não reconhecida" }),
      { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [PJ-WUZAPI] Erro:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
