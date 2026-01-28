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
    const { userId, action } = await req.json();

    console.log(`📱 [PJ-WUZAPI] Ação: ${action} para user: ${userId}`);

    if (!userId) {
      return new Response(
        JSON.stringify({ success: false, error: "userId é obrigatório" }),
        { status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

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

      // 0) Tenta pegar QR direto (algumas builds geram QR sem /connect)
      try {
        const preQrResp = await fetch(`${baseUrl}/session/qr`, {
          method: "GET",
          headers: { "Token": wuzapiToken },
        });

        const preQrParsed = await safeReadJson(preQrResp);
        if (preQrParsed.ok) {
          const preQrCode = extractQrCodePayload(preQrParsed.json);
          if (preQrCode) {
            return new Response(
              JSON.stringify({ success: true, qrCode: preQrCode, status: "awaiting_scan" }),
              { headers: { ...corsHeaders, "Content-Type": "application/json" } }
            );
          }
        }
      } catch (_) {
        // ignore
      }

      // 1) Tenta iniciar sessão com /session/connect e fallbacks
      const connectCandidates = [
        `${baseUrl}/session/connect`,
        `${baseUrl}/session/start`,
        `${baseUrl}/session/login`,
      ];

      let connectOk = false;
      let lastConnectRaw: string | null = null;
      let lastConnectStatus: number | null = null;

      for (const url of connectCandidates) {
        try {
          const { resp, parsed } = await tryPostJson(url, { Token: wuzapiToken }, {});
          lastConnectStatus = resp.status;
          lastConnectRaw = parsed.text;

          // Se não é JSON, mas não foi 404, seguimos (algumas implementações retornam texto)
          if (!parsed.ok) {
            if (resp.status !== 404) {
              connectOk = resp.ok;
              if (connectOk) break;
            }
            continue;
          }

          const connectData = parsed.json;
          console.log("📲 Resposta connect:", connectData);
          if (resp.ok && connectData?.success !== false) {
            connectOk = true;
            break;
          }

          // se for 404 tenta próximo
          if (resp.status === 404) continue;
        } catch (e) {
          console.error("❌ Erro tentando iniciar sessão:", e);
        }
      }

      // 2) Buscar QR Code (retry, igual Afiliados)
      for (let i = 0; i < 5; i++) {
        const qrResponse = await fetch(`${baseUrl}/session/qr`, {
          method: "GET",
          headers: { "Token": wuzapiToken },
        });

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

        await new Promise((r) => setTimeout(r, 1200));
      }

      // Se chegou aqui, não conseguiu QR.
      // Se o /connect foi 404 (como no seu caso), devolve diagnóstico claro.
      if (!connectOk && lastConnectStatus === 404) {
        return new Response(
          JSON.stringify({
            success: false,
            error: "Endpoint /session/connect não encontrado na WuzAPI desta instância",
            raw: (lastConnectRaw || "").slice(0, 500),
          }),
          { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }

      return new Response(
        JSON.stringify({
          success: false,
          error: "QR Code não disponível ainda. Tente novamente.",
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
