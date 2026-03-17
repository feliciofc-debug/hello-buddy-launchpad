import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
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

function normalizeQrToDataUrl(raw: string | null | undefined): string | null {
  if (!raw || typeof raw !== "string") return null;
  const value = raw.trim();
  if (!value) return null;
  if (value.startsWith("data:image")) return value;
  if (value.length < 80) return null;
  return `data:image/png;base64,${value}`;
}

function extractQrFromStatusPayload(statusPayload: any): string | null {
  const data = statusPayload?.data || statusPayload || {};
  const raw =
    data?.qrcode ||
    data?.qrCode ||
    data?.QRCode ||
    statusPayload?.qrcode ||
    statusPayload?.qrCode ||
    statusPayload?.QRCode ||
    null;

  return normalizeQrToDataUrl(raw);
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

const sleep = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));
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

    // Se não há instância mapeada, construir URL com IP + porta do pj_clientes_config
    const rawBaseUrl = effectiveInstance?.wuzapi_url || `http://191.252.193.73:${effectivePort}`;
    const baseUrl = rawBaseUrl.replace(/\/+$/, "");
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

      // Se há sessão em limbo, fazer limpeza completa (logout + disconnect)
      if (hasStaleSession) {
        console.log("🔄 Limpando sessão antiga (hard reset)...");
        const cleanupEndpoints = [
          `${baseUrl}/session/logout`,
          `${baseUrl}/session/disconnect`,
          `${baseUrl}/user/disconnect`,
          `${baseUrl}/session/disconnect`, // repetição intencional para builds instáveis
        ];

        let cleanupSuccess = false;
        for (const cleanupUrl of cleanupEndpoints) {
          try {
            const cleanupResp = await fetch(cleanupUrl, {
              method: "POST",
              headers: { "Token": wuzapiToken, "Content-Type": "application/json" },
              body: JSON.stringify({}),
            });

            const parsed = await safeReadJson(cleanupResp);
            const logicalSuccess = isLogicalSuccess(cleanupResp, parsed);

            console.log(`   Cleanup ${cleanupUrl}: status=${cleanupResp.status} logicalSuccess=${logicalSuccess}`);

            if (logicalSuccess) {
              cleanupSuccess = true;
            }

            // Pequeno respiro entre chamadas para evitar corrida no servidor WuzAPI
            await sleep(1200);
          } catch (e) {
            console.log(`   Erro cleanup ${cleanupUrl}:`, e);
          }
        }

        // Aguardar mais tempo para o servidor processar o reset
        console.log("⏳ Aguardando servidor limpar sessão...");
        await sleep(3000);

        // Tentar DELETE no session se os POSTs falharam (algumas builds aceitam)
        if (!cleanupSuccess) {
          try {
            const deleteResp = await fetch(`${baseUrl}/session`, {
              method: "DELETE",
              headers: { "Token": wuzapiToken },
            });
            console.log(`   DELETE /session: status=${deleteResp.status}`);
            await sleep(2000);
          } catch (e) {
            console.log(`   Erro DELETE /session:`, e);
          }
        }
      }

      // 0) Tenta pegar QR direto primeiro (build Locaweb pode já ter QR disponível)
      const qrEndpoints = [
        `${baseUrl}/session/qr/image`,
        `${baseUrl}/session/qr`,
        `${baseUrl}/qr`,
        // Algumas builds só respondem por POST
        `${baseUrl}/session/qr__POST__`,
      ];

      for (const qrUrl of qrEndpoints) {
        try {
          const isPost = qrUrl.endsWith("__POST__");
          const realUrl = isPost ? qrUrl.replace(/__POST__$/, "") : qrUrl;

          const preQrResp = await fetch(realUrl, {
            method: isPost ? "POST" : "GET",
            headers: {
              "Token": wuzapiToken,
              ...(isPost ? { "Content-Type": "application/json" } : {}),
            },
            ...(isPost ? { body: JSON.stringify({}) } : {}),
          });

          console.log(`📲 Tentando QR em ${realUrl} (${isPost ? "POST" : "GET"}): status ${preQrResp.status}`);
          
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
        { url: `${baseUrl}/session/connect`, method: "POST", noBody: false },
        { url: `${baseUrl}/session/start`, method: "POST", noBody: false },
        { url: `${baseUrl}/session/login`, method: "POST", noBody: false },
        { url: `${baseUrl}/user/qr`, method: "GET", noBody: true },
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

      // 2) Buscar QR Code com lógica robusta e logs detalhados
      // Aguardar 3 segundos após connect para WuzAPI gerar o QR
      if (connectOk) {
        console.log("⏳ Aguardando 3 segundos para WuzAPI preparar o QR code...");
        await new Promise((r) => setTimeout(r, 3000));
      }

      // Endpoints de QR para tentar (inclui variações de diferentes builds WuzAPI)
      const qrFetchEndpoints = [
        { method: 'GET', path: '/session/qr/image' },
        { method: 'GET', path: '/session/qr' },
        { method: 'POST', path: '/session/qr' },
        { method: 'GET', path: '/qr' },
      ];

      let qrCodeResult: string | null = null;
      const qrAttempts: string[] = [];
      const maxRetries = 10;
      let reconnectAfterNotConnected = false;

      for (let retry = 0; retry < maxRetries && !qrCodeResult; retry++) {
        console.log(`[QR] Tentativa ${retry + 1}/${maxRetries}...`);
        
        for (const endpoint of qrFetchEndpoints) {
          try {
            const qrUrl = `${baseUrl}${endpoint.path}`;
            console.log(`[QR] Tentando ${endpoint.method} ${qrUrl}`);
            
            const qrResponse = await fetch(qrUrl, {
              method: endpoint.method,
              headers: { 
                'Token': wuzapiToken,
                'Content-Type': 'application/json'
              },
              ...(endpoint.method === 'POST' ? { body: JSON.stringify({}) } : {})
            });
            
            const contentType = qrResponse.headers.get('content-type') || '';
            console.log(`[QR] Status: ${qrResponse.status}, Content-Type: ${contentType}`);
            
            if (qrResponse.status === 404) {
              qrAttempts.push(`${endpoint.path}: 404 (não existe)`);
              continue;
            }
            
            if (qrResponse.ok) {
              // Se retornou imagem diretamente (binário)
              if (contentType.includes('image')) {
                const arrayBuffer = await qrResponse.arrayBuffer();
                const uint8Array = new Uint8Array(arrayBuffer);
                let binary = '';
                for (let i = 0; i < uint8Array.length; i++) {
                  binary += String.fromCharCode(uint8Array[i]);
                }
                const base64 = btoa(binary);
                qrCodeResult = `data:image/png;base64,${base64}`;
                qrAttempts.push(`${endpoint.path}: ✅ SUCESSO (imagem binária)`);
                console.log(`[QR] ✅ Imagem binária obtida!`);
                break;
              }
              
              // Se retornou JSON
              const qrParsed = await safeReadJson(qrResponse);
              console.log(`[QR] Dados recebidos:`, JSON.stringify(qrParsed.json || qrParsed.text).substring(0, 300));
              
              // Tentar extrair QR de diferentes formatos de resposta
              const possibleQr = extractQrAny(qrParsed);
              if (possibleQr) {
                // Garantir formato data URL
                if (possibleQr.startsWith('data:')) {
                  qrCodeResult = possibleQr;
                } else if (possibleQr.length > 100) {
                  qrCodeResult = `data:image/png;base64,${possibleQr}`;
                }
                if (qrCodeResult) {
                  qrAttempts.push(`${endpoint.path}: ✅ SUCESSO (JSON)`);
                  console.log(`[QR] ✅ QR Code extraído do JSON!`);
                  break;
                }
              }
              
              // Tentar campos específicos que podem existir
              const qrData = qrParsed.json || {};
              const possibleFields = ['qrcode', 'qrCode', 'QRCode', 'code', 'data', 'image', 'qr'];
              for (const field of possibleFields) {
                const val = qrData[field] || qrData?.data?.[field];
                if (val && typeof val === 'string' && val.length > 100) {
                  qrCodeResult = val.startsWith('data:') ? val : `data:image/png;base64,${val}`;
                  qrAttempts.push(`${endpoint.path}: ✅ SUCESSO (campo ${field})`);
                  console.log(`[QR] ✅ QR encontrado no campo '${field}'!`);
                  break;
                }
              }
              
              if (qrCodeResult) break;
              qrAttempts.push(`${endpoint.path}: 200 mas sem QR no response`);
            } else {
              const errorText = await qrResponse.text().catch(() => '');
              qrAttempts.push(`${endpoint.path}: ${qrResponse.status} - ${errorText.substring(0, 50)}`);

              if (
                !reconnectAfterNotConnected &&
                qrResponse.status >= 500 &&
                /not\s*connected/i.test(errorText)
              ) {
                reconnectAfterNotConnected = true;
                console.log("[QR] Detectado 'not connected' durante fetch QR. Forçando reconnect...");
                try {
                  await tryPostJson(`${baseUrl}/session/connect`, { Token: wuzapiToken }, {});
                  await sleep(2000);
                } catch (reconnectErr: any) {
                  qrAttempts.push(`reconnect fallback falhou: ${reconnectErr.message}`);
                }
              }
            }
          } catch (e: any) {
            qrAttempts.push(`${endpoint.path}: erro - ${e.message}`);
            console.error(`[QR] Erro em ${endpoint.path}:`, e.message);
          }
        }
        
        if (!qrCodeResult && retry < maxRetries - 1) {
          console.log(`[QR] Aguardando 2s antes de tentar novamente...`);
          await sleep(2000);
        }
      }

      // SEMPRE retornar com detalhes para debug
      if (qrCodeResult) {
        console.log("✅ [QR] QR Code obtido com sucesso!");
        return new Response(
          JSON.stringify({
            success: true,
            qrCode: qrCodeResult,
            status: "awaiting_scan",
            debug: { qrAttempts, baseUrl, connectOk }
          }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      } else {
        console.log("❌ [QR] Não foi possível obter QR Code");
        return new Response(
          JSON.stringify({
            success: false,
            error: "QR code não retornado pela WuzAPI após múltiplas tentativas",
            details: {
              qrAttempts,
              baseUrl,
              lastStatus: lastConnectStatus,
              connectOk,
              hint: "A sessão pode estar conectada ou presa. Tente fazer logout/reset primeiro."
            },
            raw: (lastConnectRaw || "").slice(0, 300),
          }),
          { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
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
      
      // CORREÇÃO: Verificar AMBOS connected E loggedIn para evitar falsos positivos
      const isReallyConnected = (innerData?.connected === true && innerData?.loggedIn === true) || 
                                 (statusData?.Connected === true && statusData?.LoggedIn === true);
      
      // Só extrair JID se estiver REALMENTE conectado (evita JID fantasma de sessões antigas)
      const jid = isReallyConnected ? (innerData?.jid || statusData?.JID || statusData?.jid || "") : "";

      console.log("📊 [Status] Análise:", { 
        rawConnected: innerData?.connected, 
        rawLoggedIn: innerData?.loggedIn, 
        isReallyConnected, 
        jidFromApi: innerData?.jid,
        jidToSave: jid 
      });

      // Atualizar status no banco (somente se a instância é do userId ou se não foi forçado por instanceId)
      // CORREÇÃO: Se não está conectado, LIMPAR o JID para evitar dados residuais
      if (!instanceId || effectiveInstance?.assigned_to_user === userId) {
        await supabase
          .from("pj_clientes_config")
          .update({
            whatsapp_conectado: isReallyConnected,
            wuzapi_jid: isReallyConnected ? jid : null, // LIMPAR se não conectado!
            ultimo_status_check: new Date().toISOString(),
          })
          .eq("user_id", userId);
      }

      // Também sincronizar o status da instância (melhora confiabilidade dos envios e diagnósticos)
      // CORREÇÃO: Se não conectado, limpar phone_number também
      try {
        if (effectiveInstance?.id) {
          await supabase
            .from("wuzapi_instances")
            .update({
              is_connected: isReallyConnected,
              connected_at: isReallyConnected ? new Date().toISOString() : null,
              phone_number: isReallyConnected && jid ? String(jid).split("@")[0] : null,
            })
            .eq("id", effectiveInstance.id);
        }
      } catch (e) {
        console.log("⚠️ [PJ-WUZAPI] Falha ao sincronizar wuzapi_instances:", e);
      }

      return new Response(
        JSON.stringify({
          success: true,
          connected: isReallyConnected,
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

    if (action === "swap_phone") {
      // ============================================================
      // RESET TOTAL DA SESSÃO - Trocar telefone / limpar sessão presa
      // ============================================================
      console.log("[swap_phone] Iniciando reset completo da sessão...");
      
      const statusAntes = { connected: false, loggedIn: false, jid: null as string | null };
      const tentativas: string[] = [];
      
      try {
        // 1. Capturar status atual
        try {
          const statusRes = await fetch(`${baseUrl}/session/status`, {
            method: "GET",
            headers: { "Token": wuzapiToken, "Content-Type": "application/json" }
          });
          if (statusRes.ok) {
            const statusParsed = await safeReadJson(statusRes);
            if (statusParsed.ok) {
              const innerData = statusParsed.json?.data || statusParsed.json;
              statusAntes.connected = innerData?.connected || false;
              statusAntes.loggedIn = innerData?.loggedIn || false;
              statusAntes.jid = innerData?.jid || null;
            }
          }
          tentativas.push(`status: ${JSON.stringify(statusAntes)}`);
        } catch (e: any) {
          tentativas.push(`status falhou: ${e.message}`);
        }

        // 2. Logout
        try {
          await fetch(`${baseUrl}/session/logout`, {
            method: "POST",
            headers: { "Token": wuzapiToken, "Content-Type": "application/json" },
            body: JSON.stringify({})
          });
          tentativas.push("logout: ok");
        } catch (e: any) {
          tentativas.push(`logout: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 2000));

        // 3. Disconnect
        try {
          await fetch(`${baseUrl}/session/disconnect`, {
            method: "POST",
            headers: { "Token": wuzapiToken, "Content-Type": "application/json" },
            body: JSON.stringify({})
          });
          tentativas.push("disconnect: ok");
        } catch (e: any) {
          tentativas.push(`disconnect: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 2000));

        // 4. Connect com Subscribe
        try {
          const connectRes = await fetch(`${baseUrl}/session/connect`, {
            method: "POST",
            headers: { "Token": wuzapiToken, "Content-Type": "application/json" },
            body: JSON.stringify({
              Subscribe: ["Message", "ReadReceipt", "ChatPresence", "Presence"]
            })
          });
          const connectText = await connectRes.text();
          tentativas.push(`connect: ${connectRes.status} - ${connectText.substring(0, 100)}`);
        } catch (e: any) {
          tentativas.push(`connect: ${e.message}`);
        }
        await new Promise(r => setTimeout(r, 3000));

        // 5. Buscar QR code com retry
        let qrCode: string | null = null;
        const qrEndpoints = ["/session/qr", "/session/qr/image", "/qr"];
        const maxRetries = 10;
        
        for (let i = 0; i < maxRetries && !qrCode; i++) {
          for (const endpoint of qrEndpoints) {
            try {
              const qrRes = await fetch(`${baseUrl}${endpoint}`, {
                method: "GET",
                headers: { "Token": wuzapiToken }
              });
              
              if (qrRes.ok) {
                const contentType = qrRes.headers.get("content-type") || "";
                
                if (contentType.includes("image")) {
                  const buffer = await qrRes.arrayBuffer();
                  const base64 = btoa(String.fromCharCode(...new Uint8Array(buffer)));
                  qrCode = `data:image/png;base64,${base64}`;
                  tentativas.push(`qr ${endpoint}: imagem obtida`);
                  break;
                } else {
                  const qrParsed = await safeReadJson(await fetch(`${baseUrl}${endpoint}`, {
                    method: "GET",
                    headers: { "Token": wuzapiToken }
                  }));
                  
                  if (qrParsed.ok) {
                    const extracted = extractQrCodePayload(qrParsed.json);
                    if (extracted) {
                      qrCode = extracted.startsWith("data:") ? extracted : `data:image/png;base64,${extracted}`;
                      tentativas.push(`qr ${endpoint}: json obtido`);
                      break;
                    }
                  }
                }
              } else {
                tentativas.push(`qr ${endpoint}: ${qrRes.status}`);
              }
            } catch (e: any) {
              tentativas.push(`qr ${endpoint}: ${e.message}`);
            }
          }
          
          if (!qrCode) {
            await new Promise(r => setTimeout(r, 2000));
          }
        }

        // 6. Atualizar banco
        if (effectiveInstance?.id) {
          await supabase
            .from("wuzapi_instances")
            .update({
              is_connected: false,
              phone_number: null,
              connected_at: null,
              updated_at: new Date().toISOString()
            })
            .eq("id", effectiveInstance.id);

          tentativas.push("wuzapi_instances atualizado");
        }

        await supabase
          .from("pj_clientes_config")
          .update({
            whatsapp_conectado: false,
            wuzapi_jid: null,
            ultimo_status_check: new Date().toISOString()
          })
          .eq("user_id", userId);
          
        tentativas.push("pj_clientes_config atualizado");

        // 7. Retornar resultado
        if (qrCode) {
          return new Response(JSON.stringify({
            success: true,
            qrCode,
            status: "awaiting_scan",
            details: { tentativas, statusAntes }
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        } else {
          return new Response(JSON.stringify({
            success: false,
            error: "Não foi possível obter QR code após reset",
            details: { tentativas, statusAntes, baseUrl }
          }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
        }

      } catch (error: any) {
        return new Response(JSON.stringify({
          success: false,
          error: error.message,
          details: { tentativas, statusAntes }
        }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
      }
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
