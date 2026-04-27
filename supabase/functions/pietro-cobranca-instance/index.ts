// Edge Function: pietro-cobranca-instance
// Escopo restrito: instância WuzAPI 'pietro-cobranca' (porta 8082)
// Acesso: somente admin (expo@atombrasildigital.com)
// Actions: status | gerar-qr | desconectar
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-billing-token",
};

const INSTANCE_NAME = "pietro-cobranca";
const DEFAULT_WUZAPI_URL = "http://api2.amzofertas.com.br:8082";

async function verifyBillingToken(token: string): Promise<boolean> {
  const adminPassword = Deno.env.get("BILLING_ADMIN_PASSWORD");
  if (!adminPassword || !token) return false;

  const encoder = new TextEncoder();
  const data = encoder.encode(`${adminPassword}:${Math.floor(Date.now() / (1000 * 60 * 60 * 24))}`);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const expected = hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");

  return token === expected;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function extractQr(payload: any): string | null {
  return payload?.qrcode || payload?.QRCode || payload?.qr || payload?.code ||
    payload?.data?.qrcode || payload?.data?.QRCode || payload?.data?.qr || payload?.data?.code ||
    payload?.result?.qrcode || payload?.result?.QRCode || payload?.result?.qr || payload?.result?.code || null;
}

function normalizeEvents(events: unknown): string[] {
  if (Array.isArray(events)) return events.map(String).filter(Boolean);
  if (typeof events === "string" && events.trim()) return events.split(",").map((e) => e.trim()).filter(Boolean);
  return [];
}

function generateSessionToken() {
  const bytes = new Uint8Array(24);
  crypto.getRandomValues(bytes);
  return Array.from(bytes).map((b) => b.toString(16).padStart(2, "0")).join("");
}

function redactToken(value: unknown) {
  if (!value) return value;
  const token = String(value);
  return `${token.slice(0, 8)}...`;
}

function compactWuzapiBody(body: any) {
  const data = body?.data && typeof body.data === "object" ? body.data : body;
  return {
    code: body?.code,
    success: body?.success,
    error: body?.error,
    details: body?.details || data?.details || data?.Details,
    name: data?.name,
    id: data?.id,
    loggedIn: data?.loggedIn ?? data?.LoggedIn,
    connected: data?.connected ?? data?.Connected,
    jid: data?.jid ?? data?.Jid,
    qrcode_len: (extractQr(body) || "").length,
    token: redactToken(data?.token),
  };
}

async function fetchJson(url: string, token: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Token: token, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await response.text();
  try {
    return { ok: response.ok, status: response.status, json: text ? JSON.parse(text) : null };
  } catch {
    return { ok: response.ok, status: response.status, json: { rawText: text } };
  }
}

async function fetchAdminJson(url: string, adminToken: string, init: RequestInit = {}) {
  const response = await fetch(url, {
    ...init,
    headers: { Authorization: adminToken, "Content-Type": "application/json", ...(init.headers || {}) },
  });
  const text = await response.text();
  try {
    return { ok: response.ok, status: response.status, json: text ? JSON.parse(text) : null };
  } catch {
    return { ok: response.ok, status: response.status, json: { rawText: text } };
  }
}

async function ensureWuzapiSession(supabase: any, instance: any, wuzapiUrl: string, currentToken: string | null) {
  const adminToken = Deno.env.get("CONTABO_WUZAPI_ADMIN_TOKEN");
  if (!adminToken) return { token: currentToken, created: false, error: "CONTABO_WUZAPI_ADMIN_TOKEN não configurado" };

  const users = await fetchAdminJson(`${wuzapiUrl}/admin/users`, adminToken, { method: "GET" });
  console.log("[pietro-cobranca] GET /admin/users", users.status, compactWuzapiBody(users.json));
  const list = Array.isArray(users.json?.data) ? users.json.data : [];
  const physical = list.find((u: any) => u?.name === INSTANCE_NAME);

  if (physical?.token) {
    if (physical.token !== currentToken) {
      await supabase.from("wuzapi_instances").update({
        wuzapi_token: physical.token,
        wuzapi_url: wuzapiUrl,
        updated_at: new Date().toISOString(),
      }).eq("id", instance.id);
    }
    return { token: physical.token, created: false, error: null };
  }

  if (physical?.id) {
    const deleted = await fetchAdminJson(`${wuzapiUrl}/admin/users/${physical.id}`, adminToken, { method: "DELETE" });
    console.log("[pietro-cobranca] DELETE sessão sem token", deleted.status, compactWuzapiBody(deleted.json));
  }

  const newToken = generateSessionToken();
  const created = await fetchAdminJson(`${wuzapiUrl}/admin/users`, adminToken, {
    method: "POST",
    body: JSON.stringify({ name: INSTANCE_NAME, token: newToken, events: "All", webhook: "" }),
  });
  console.log("[pietro-cobranca] POST /admin/users", created.status, compactWuzapiBody(created.json));

  const createdToken = created.json?.data?.token || created.json?.token || newToken;
  if (!created.ok || !createdToken) return { token: currentToken, created: false, error: "Falha ao criar sessão no WuzAPI" };

  await supabase.from("wuzapi_instances").update({
    wuzapi_token: createdToken,
    wuzapi_url: wuzapiUrl,
    is_connected: false,
    phone_number: null,
    connected_at: null,
    updated_at: new Date().toISOString(),
  }).eq("id", instance.id);

  return { token: createdToken, created: true, error: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Auth via billing_token (mesmo padrão do /pay/admin)
    const billingToken = req.headers.get("x-billing-token");
    const isAdmin = await verifyBillingToken(billingToken || "");
    if (!isAdmin) {
      console.warn("[pietro-cobranca] billing_token inválido");
      return json({ success: false, error: "Acesso restrito ao administrador" }, 403);
    }

    // 3. Parse body
    let action = "status";
    try {
      const body = await req.json();
      action = body?.action || "status";
    } catch {
      // GET ou body vazio → status
    }

    // 4. Carrega instância pietro-cobranca
    const { data: instance, error: instErr } = await supabase
      .from("wuzapi_instances")
      .select("*")
      .eq("instance_name", INSTANCE_NAME)
      .maybeSingle();

    if (instErr || !instance) {
      console.error("[pietro-cobranca] instância não encontrada:", instErr);
      return json({ success: false, error: "Instância pietro-cobranca não cadastrada" }, 404);
    }

    const wuzapiUrl: string = instance.wuzapi_url ? String(instance.wuzapi_url).replace(/\/$/, "") : DEFAULT_WUZAPI_URL;
    const wuzapiToken: string | null = instance.wuzapi_token || null;
    if (!wuzapiUrl) {
      return json({
        success: false,
        error: "Instância sem wuzapi_url configurado",
        instance_name: instance.instance_name,
        port: instance.port,
      }, 500);
    }

    console.log(`[pietro-cobranca] action=${action} url=${wuzapiUrl}`);

    // ---------------- STATUS ----------------
    if (action === "status") {
      try {
        let activeToken = wuzapiToken;
        if (!activeToken) {
          const ensured = await ensureWuzapiSession(supabase, instance, wuzapiUrl, activeToken);
          if (ensured.error || !ensured.token) return json({ success: false, connected: false, error: ensured.error }, 500);
          activeToken = ensured.token;
        }

        let statusResponse = await fetchJson(`${wuzapiUrl}/session/status`, activeToken, { method: "GET" });
        console.log("[pietro-cobranca] GET /session/status", statusResponse.status, compactWuzapiBody(statusResponse.json));
        if (statusResponse.status === 401 || statusResponse.json?.error === "unauthorized" || statusResponse.json?.error === "no session") {
          const ensured = await ensureWuzapiSession(supabase, instance, wuzapiUrl, activeToken);
          if (ensured.error || !ensured.token) return json({ success: false, connected: false, error: ensured.error }, 500);
          activeToken = ensured.token;
          statusResponse = await fetchJson(`${wuzapiUrl}/session/status`, activeToken, { method: "GET" });
          console.log("[pietro-cobranca] GET /session/status retry", statusResponse.status, compactWuzapiBody(statusResponse.json));
        }

        const raw = statusResponse.json;
        const data = raw?.data || raw;
        const isConnected = data?.loggedIn === true || data?.LoggedIn === true;
        const phoneNumber = data?.jid ? String(data.jid).split(":")[0] : (data?.PhoneNumber || null);

        if (instance.is_connected !== isConnected || instance.phone_number !== phoneNumber) {
          await supabase
            .from("wuzapi_instances")
            .update({
              is_connected: isConnected,
              phone_number: phoneNumber,
              connected_at: isConnected ? new Date().toISOString() : null,
              updated_at: new Date().toISOString(),
            })
            .eq("id", instance.id);
        }

        return json({
          success: true,
          connected: isConnected,
          phone_number: phoneNumber,
          instance_name: instance.instance_name,
          port: instance.port,
          qrcode: extractQr(raw),
        });
      } catch (e) {
        console.error("[pietro-cobranca] erro status:", e);
        return json({
          success: false,
          connected: false,
          error: "Erro ao verificar status",
          detail: e instanceof Error ? e.message : String(e),
        });
      }
    }

    // ---------------- GERAR QR ----------------
    if (action === "gerar-qr") {
      try {
        let activeToken = wuzapiToken;
        const ensured = await ensureWuzapiSession(supabase, instance, wuzapiUrl, activeToken);
        if (ensured.error || !ensured.token) return json({ success: false, error: ensured.error }, 500);
        activeToken = ensured.token;

        // Status primeiro
        const status = await fetchJson(`${wuzapiUrl}/session/status`, activeToken, { method: "GET" });
        console.log("[pietro-cobranca] GET /session/status gerar-qr", status.status, compactWuzapiBody(status.json));
        const sRaw = status.json;
        const sData = sRaw?.data || sRaw;

        if (sData?.loggedIn === true || sData?.LoggedIn === true) {
          const phone = sData?.jid ? String(sData.jid).split(":")[0] : null;
          await supabase
            .from("wuzapi_instances")
            .update({
              is_connected: true,
              phone_number: phone,
              connected_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq("id", instance.id);

          return json({
            success: true,
            already_connected: true,
            connected: true,
            phone_number: phone,
            message: "WhatsApp já está conectado",
          });
        }

        const statusQr = extractQr(sRaw);
        if (statusQr && statusQr.length > 20) {
          return json({ success: true, qrcode: statusQr, message: "QR pronto", raw: { status: sRaw } });
        }

        // Força /session/connect e tenta buscar o QR por alguns segundos
        const connect = await fetchJson(`${wuzapiUrl}/session/connect`, activeToken, {
          method: "POST",
          body: JSON.stringify({ Events: "All", Immediate: true }),
        });
        console.log("[pietro-cobranca] POST /session/connect", connect.status, compactWuzapiBody(connect.json));
        const connectQr = extractQr(connect.json);
        if (connectQr && connectQr.length > 20) {
          return json({ success: true, qrcode: connectQr, message: "QR gerado", raw: { connect: connect.json } });
        }

        let lastQrRaw: unknown = null;
        for (let i = 0; i < 12; i++) {
          await new Promise((r) => setTimeout(r, 1500));
          const qrResponse = await fetchJson(`${wuzapiUrl}/session/qr`, activeToken, { method: "GET" });
          lastQrRaw = qrResponse.json;
          console.log("[pietro-cobranca] GET /session/qr", qrResponse.status, compactWuzapiBody(qrResponse.json));
          const qrCode = extractQr(qrResponse.json);
          if (qrCode && qrCode.length > 20) {
            return json({ success: true, qrcode: qrCode, message: "QR gerado", raw: { connect: connect.json, qr: qrResponse.json } });
          }

          const statusResponse = await fetchJson(`${wuzapiUrl}/session/status`, activeToken, { method: "GET" });
          console.log("[pietro-cobranca] GET /session/status qr-loop", statusResponse.status, compactWuzapiBody(statusResponse.json));
          const statusQrRetry = extractQr(statusResponse.json);
          if (statusQrRetry && statusQrRetry.length > 20) {
            return json({ success: true, qrcode: statusQrRetry, message: "QR gerado via status", raw: { connect: connect.json, status: statusResponse.json } });
          }
        }

        return json({
          success: false,
          retry: true,
          error: "QR ainda não disponível, tente novamente em instantes",
          raw: { last_qr: lastQrRaw },
        });
      } catch (e) {
        console.error("[pietro-cobranca] erro gerar-qr:", e);
        return json({
          success: false,
          error: "Erro ao gerar QR",
          detail: e instanceof Error ? e.message : String(e),
        }, 500);
      }
    }

    // ---------------- DESCONECTAR ----------------
    if (action === "desconectar") {
      try {
        await fetch(`${wuzapiUrl}/session/logout`, {
          method: "POST",
          headers: { Token: wuzapiToken },
        });
        await supabase
          .from("wuzapi_instances")
          .update({
            is_connected: false,
            phone_number: null,
            connected_at: null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", instance.id);

        return json({ success: true, message: "Desconectado" });
      } catch (e) {
        console.error("[pietro-cobranca] erro desconectar:", e);
        return json({
          success: false,
          error: "Erro ao desconectar",
          detail: e instanceof Error ? e.message : String(e),
        }, 500);
      }
    }

    return json({ success: false, error: `Ação desconhecida: ${action}` }, 400);
  } catch (e) {
    console.error("[pietro-cobranca] erro geral:", e);
    return json({
      success: false,
      error: e instanceof Error ? e.message : "Erro interno",
    }, 500);
  }
});
