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

function looksLikeSuccessText(text: string | null | undefined) {
  if (!text) return false;
  const t = text.toLowerCase();
  return (
    t.includes("success") ||
    t.includes("logged out") ||
    t.includes("logout") ||
    t.includes("disconnected") ||
    t.includes("disconnect") ||
    t.includes("ok")
  );
}

function isLogicalSuccess(resp: Response, parsed: { ok: boolean; json?: any; text: string }) {
  if (resp.ok) return true;
  if (parsed.ok && parsed.json?.success !== false) return true;
  // Algumas builds retornam 500 com texto simples mesmo quando a ação funciona.
  if (resp.status >= 500 && looksLikeSuccessText(parsed.text)) return true;
  return false;
}

function extractQrCodePayload(qrData: any): string | null {
  // WuzAPI builds vary a lot in the QR payload keys.
  // Support the most common shapes we've seen in production.
  const raw =
    qrData?.QRCode ||
    qrData?.qrcode ||
    qrData?.qr ||
    qrData?.code ||
    qrData?.Code ||
    qrData?.data?.QRCode ||
    qrData?.data?.qrcode ||
    qrData?.data?.qr ||
    qrData?.data?.code ||
    qrData?.data?.Code ||
    qrData?.qr?.QRCode ||
    qrData?.qr?.qrcode ||
    qrData?.qr?.code ||
    null;
  if (!raw) return null;
  if (typeof raw !== "string") return null;
  if (raw.startsWith("data:image")) {
    const idx = raw.indexOf("base64,");
    return idx >= 0 ? raw.slice(idx + "base64,".length) : raw;
  }
  return raw;
}

function extractQrFromText(text: string | null | undefined): string | null {
  if (!text) return null;
  const t = text.trim();

  // data URL
  if (t.startsWith("data:image")) {
    const idx = t.indexOf("base64,");
    return idx >= 0 ? t.slice(idx + "base64,".length) : t;
  }

  // Algumas builds retornam apenas o base64 puro
  const looksBase64 = /^[A-Za-z0-9+/=\r\n]+$/.test(t) && t.replace(/\s+/g, "").length > 400;
  if (looksBase64) return t.replace(/\s+/g, "");

  // Algumas retornam JSON como string dentro do texto
  try {
    const asJson = JSON.parse(t);
    return extractQrCodePayload(asJson);
  } catch {
    // ignore
  }

  return null;
}

function extractQrAny(parsed: { ok: boolean; json?: any; text: string }): string | null {
  if (parsed.ok) return extractQrCodePayload(parsed.json);
  return extractQrFromText(parsed.text);
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
    // Algumas chamadas podem chegar sem Content-Type correto; então parseamos de forma tolerante.
    const rawBody = await req.text().catch(() => "");
    const body = (() => {
      if (!rawBody) return {};
      try {
        return JSON.parse(rawBody);
      } catch {
        return {};
      }
    })();
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

    // ✅ Resolver instância alvo
    // - Por padrão: usa a instância mapeada do usuário (porta em pj_clientes_config)
    // - Admin/urgência: permite forçar por instanceId (ex: amz-03 / porta 8083)
    const instanceId: string | undefined = body?.instanceId;

    // Igual ao PJ antigo: usar a instância real (http://191.252.193.73:808x) vinda de wuzapi_instances
    // Isso evita o 404 do domínio wuzapi.amzofertas.com.br em /session/connect.
    const targetPort = Number(clienteConfig.wuzapi_port || 8080);

    const { data: forcedInstance } = instanceId
      ? await supabase
          .from("wuzapi_instances")
          .select("id, wuzapi_url, wuzapi_token, instance_name, port, assigned_to_user")
          .eq("id", instanceId)
          .maybeSingle()
      : ({ data: null } as any);

    const { data: mappedInstance } = !forcedInstance
      ? await supabase
          .from("wuzapi_instances")
          .select("id, wuzapi_url, wuzapi_token, instance_name, port, assigned_to_user")
          .eq("assigned_to_user", userId)
          .eq("port", targetPort)
          .maybeSingle()
      : ({ data: null } as any);

    const effectiveInstance = forcedInstance || mappedInstance;
    const effectivePort = Number(effectiveInstance?.port || targetPort);

    console.log("🔧 [PJ-WUZAPI] Resolve instance:", {
      instanceId: instanceId || null,
      hasForced: Boolean(forcedInstance),
      hasMapped: Boolean(mappedInstance),
      effectivePort,
      effectiveInstanceName: effectiveInstance?.instance_name || null,
    });

    const baseUrl = (effectiveInstance?.wuzapi_url || LOCAWEB_WUZAPI_URL).replace(/\/+$/, "");
    const wuzapiToken = effectiveInstance?.wuzapi_token || clienteConfig.wuzapi_token || LOCAWEB_WUZAPI_TOKEN;

    if (action === "connect" || action === "qrcode") {
      // Gerar QR Code para conexão
      console.log("📲 Gerando QR Code...");
      console.log(`📡 Base URL: ${baseUrl}`);

      // A WuzAPI da Locaweb usa endpoint diferente!
      // Primeiro, verificar se já está conectado
      let isAlreadyConnected = false;
      let hasStaleSession = false;
      try {
        const statusResp = await fetch(`${baseUrl}/session/status`, {
          method: "GET",
          headers: { "Token": wuzapiToken },
        });
        const statusParsed = await safeReadJson(statusResp);
        if (statusParsed.ok) {
          const innerData = statusParsed.json?.data || statusParsed.json;
          isAlreadyConnected = innerData?.connected === true || innerData?.loggedIn === true;
          const hasJid = !!(innerData?.jid);
          console.log("📊 Status atual:", { connected: isAlreadyConnected, jid: innerData?.jid, loggedIn: innerData?.loggedIn });
          
          // Detectar sessão "limbo": tem JID mas não está realmente conectado
          if (!isAlreadyConnected && hasJid) {
            hasStaleSession = true;
            console.log("⚠️ Sessão em estado limbo detectada - forçando logout...");
          }
          
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

      // Se há sessão em limbo, forçar logout antes de tentar reconectar
      if (hasStaleSession) {
        console.log("🔄 Limpando sessão antiga...");
        const logoutEndpoints = [
          `${baseUrl}/session/logout`,
          `${baseUrl}/session/disconnect`,
          `${baseUrl}/user/disconnect`,
        ];
        
        let cleanupSuccess = false;
        for (const logoutUrl of logoutEndpoints) {
          try {
            const logoutResp = await fetch(logoutUrl, {
              method: "POST",
              headers: { "Token": wuzapiToken, "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });

            const parsed = await safeReadJson(logoutResp);
            const logicalSuccess = isLogicalSuccess(logoutResp, parsed);

            console.log(`   Logout ${logoutUrl}: status=${logoutResp.status} logicalSuccess=${logicalSuccess}`);

            if (logicalSuccess) {
              cleanupSuccess = true;
              break;
            }
          } catch (e) {
            console.log(`   Erro logout ${logoutUrl}:`, e);
          }
        }

        // Aguardar mais tempo para o servidor processar
        console.log("⏳ Aguardando servidor limpar sessão...");
        await new Promise((r) => setTimeout(r, 3000));

        // Tentar DELETE no session se os POSTs falharam (algumas builds aceitam)
        if (!cleanupSuccess) {
          try {
            const deleteResp = await fetch(`${baseUrl}/session`, {
              method: "DELETE",
              headers: { "Token": wuzapiToken },
            });
            console.log(`   DELETE /session: status=${deleteResp.status}`);
            await new Promise((r) => setTimeout(r, 2000));
          } catch (e) {
            console.log(`   Erro DELETE /session:`, e);
          }
        }
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
          const preQrCode = extractQrAny(preQrParsed);
          if (preQrCode) {
            console.log("✅ QR Code encontrado!");
            return new Response(
              JSON.stringify({ success: true, qrCode: preQrCode, status: "awaiting_scan" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
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
          
           // Verificar se a resposta já contém QR code (mesmo não-JSON)
           const possibleQr = extractQrAny(parsed);
           if (possibleQr) {
             qrCodeFound = possibleQr;
             console.log("✅ QR Code encontrado na resposta!");
             break;
           }

           if (parsed.ok) {
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
             const qrCode = extractQrAny(qrParsed);
             if (qrCode) {
               return new Response(
                 JSON.stringify({ success: true, qrCode, status: "awaiting_scan" }),
                 { headers: { ...corsHeaders, "Content-Type": "application/json" } }
               );
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

      // Atualizar status no banco (somente se a instância é do userId ou se não foi forçado por instanceId)
      if (!instanceId || effectiveInstance?.assigned_to_user === userId) {
        await supabase
          .from("pj_clientes_config")
          .update({
            whatsapp_conectado: isConnected,
            wuzapi_jid: jid,
            ultimo_status_check: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }

      // Também sincronizar o status da instância (melhora confiabilidade dos envios e diagnósticos)
      try {
        if (effectiveInstance?.id) {
          await supabase
            .from("wuzapi_instances")
            .update({
              is_connected: isConnected,
              connected_at: isConnected ? new Date().toISOString() : null,
              phone_number: jid ? String(jid).split("@")[0] : null,
            })
            .eq("id", effectiveInstance.id);
        }
      } catch (e) {
        console.log("⚠️ [PJ-WUZAPI] Falha ao sincronizar wuzapi_instances:", e);
      }

      return new Response(
        JSON.stringify({
          success: true,
          connected: isConnected,
          jid,
          port: effectivePort,
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
        // soft
        `${baseUrl}/session/disconnect`,
        // hard
        `${baseUrl}/session/logout`,
        `${baseUrl}/session/logout?force=true`,
        // various builds
        `${baseUrl}/session/reset`,
        `${baseUrl}/session/restart`,
        `${baseUrl}/session/kill`,
        `${baseUrl}/session/clear`,
        `${baseUrl}/session/delete`,
        `${baseUrl}/session/remove`,
      ];

      let disconnectData: any = null;
      for (const url of disconnectCandidates) {
        const { resp, parsed } = await tryPostJson(url, { Token: wuzapiToken }, {});

        const logicalSuccess = isLogicalSuccess(resp, parsed);
        if (parsed.ok) disconnectData = parsed.json;
        console.log("🔌 Disconnect:", {
          url,
          status: resp.status,
          logicalSuccess,
          data: disconnectData || parsed.text?.slice(0, 160),
        });

        if (resp.status === 404) continue;
        if (logicalSuccess) break;
      }

      // Atualizar status no banco (somente se a instância é do userId ou se não foi forçado por instanceId)
      if (!instanceId || effectiveInstance?.assigned_to_user === userId) {
        await supabase
          .from("pj_clientes_config")
          .update({
            whatsapp_conectado: false,
            wuzapi_jid: null,
          })
          .eq("user_id", userId);
      }

      // Sempre sincronizar a instância alvo
      if (effectiveInstance?.id) {
        await supabase
          .from("wuzapi_instances")
          .update({
            is_connected: false,
            phone_number: null,
            connected_at: null,
          })
          .eq("id", effectiveInstance.id);
      }

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
      
      let webhookConfigured = false;
      let eventsConfigured = false;
      let lastResponse: any = null;

      // Tentar múltiplos endpoints (builds diferentes de WuzAPI)
      const webhookCandidates = [
        // Formato Locaweb/WuzAPI moderno
        { url: `${baseUrl}/admin/webhook`, body: { WebhookURL: webhookUrl, Events: "Message,ReadReceipt,ChatPresence,Presence" } },
        { url: `${baseUrl}/webhook`, body: { webhookURL: webhookUrl, events: "Message,ReadReceipt,ChatPresence,Presence,HistorySync,Receipt" } },
        // Formatos alternativos
        { url: `${baseUrl}/session/webhook`, body: { url: webhookUrl, events: "Message,ReadReceipt" } },
        { url: `${baseUrl}/settings/webhook`, body: { webhook: webhookUrl, events: "Message,ReadReceipt" } },
        // Formato com lowercase
        { url: `${baseUrl}/admin/webhook`, body: { webhookurl: webhookUrl, events: "Message,ReadReceipt,ChatPresence,Presence" } },
      ];

      for (const candidate of webhookCandidates) {
        try {
          console.log(`🔧 Tentando ${candidate.url}...`);
          const { resp, parsed } = await tryPostJson(candidate.url, { Token: wuzapiToken }, candidate.body);
          lastResponse = { url: candidate.url, status: resp.status, data: parsed.json || parsed.text };
          
          console.log(`   Status: ${resp.status}, resposta: ${JSON.stringify(parsed.json || parsed.text).slice(0, 200)}`);
          
          if (resp.status === 404) continue;
          
          if (resp.ok && parsed.ok) {
            console.log(`✅ Webhook configurado via ${candidate.url}:`, parsed.json);
            webhookConfigured = true;
            eventsConfigured = true;
            break;
          }
        } catch (e) {
          console.error(`❌ Erro em ${candidate.url}:`, e);
        }
      }

      return new Response(
        JSON.stringify({
          success: webhookConfigured,
          webhookUrl,
          eventsConfigured,
          events: "Message,ReadReceipt,ChatPresence,Presence,HistorySync,Receipt",
          message: webhookConfigured 
            ? "Webhook configurado para wuzapi-webhook-pj com sucesso!" 
            : "Não foi possível configurar o webhook automaticamente. Configure manualmente no painel WuzAPI.",
          lastResponse,
          hint: !webhookConfigured ? "Acesse http://191.252.193.73:8083 e configure o webhook para: " + webhookUrl : undefined,
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
