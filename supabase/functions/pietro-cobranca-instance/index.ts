// Edge Function: pietro-cobranca-instance
// Escopo restrito: instância WuzAPI 'pietro-cobranca' (porta 8082)
// Acesso: somente fundador/admin autorizado
// Actions: status | gerar-qr | desconectar
import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-billing-token",
};

const INSTANCE_NAME = "pietro-cobranca";
const ALLOWED_ADMIN_EMAILS = [
  "expo@atombrasildigital.com",
  "felicio@atombrasildigital.com",
  "feliciofc@gmail.com",
];

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

async function sha256Hex(value: string): Promise<string> {
  const encoder = new TextEncoder();
  const hashBuffer = await crypto.subtle.digest("SHA-256", encoder.encode(value));
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  return hashArray.map((b) => b.toString(16).padStart(2, "0")).join("");
}

async function verifyBillingToken(token: string): Promise<{ ok: boolean; reason: string }> {
  const adminPassword = Deno.env.get("BILLING_ADMIN_PASSWORD");
  if (!adminPassword) return { ok: false, reason: "missing-secret" };

  const currentDay = Math.floor(Date.now() / (1000 * 60 * 60 * 24));
  const acceptedDays = [currentDay, currentDay - 1, currentDay + 1];
  const acceptedHashes = await Promise.all(
    acceptedDays.map((day) => sha256Hex(`${adminPassword}:${day}`)),
  );

  if (acceptedHashes.includes(token)) {
    return { ok: true, reason: "billing-daily-hash" };
  }

  // Compatibilidade com sessões antigas do painel /pay que possam ter salvo a senha diretamente.
  if (token === adminPassword) {
    return { ok: true, reason: "billing-legacy-password" };
  }

  return { ok: false, reason: `no-match-len-${token.length}` };
}

async function getBearerUserEmail(req: Request, supabaseUrl: string): Promise<string | null> {
  const authBearer = req.headers.get("authorization")?.replace(/^Bearer\s+/i, "") || "";
  if (!authBearer) return null;

  const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";
  if (!anonKey) return null;

  const authClient = createClient(supabaseUrl, anonKey);
  const { data, error } = await authClient.auth.getUser(authBearer);
  if (error || !data?.user?.email) return null;

  return data.user.email.toLowerCase();
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
    const supabase = createClient(
      supabaseUrl,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );

    // 1. Auth: billing_token do /pay/admin OU usuário autenticado da lista admin
    const billingToken = req.headers.get("x-billing-token") || "";
    const billingOk = billingToken ? await verifyBillingToken(billingToken) : false;
    const userEmail = await getBearerUserEmail(req, supabaseUrl);
    const emailOk = !!userEmail && ALLOWED_ADMIN_EMAILS.includes(userEmail);

    if (!billingOk && !emailOk) {
      console.log("[pietro-cobranca-instance] acesso negado:", userEmail || "sem-email", "billing_token:", billingToken ? "invalido" : "ausente");
      return json({
        success: false,
        error: "Forbidden",
        email_recebido: userEmail,
      }, 403);
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

    const wuzapiUrl: string | null = instance.wuzapi_url;
    const wuzapiToken: string | null = instance.wuzapi_token;
    if (!wuzapiUrl || !wuzapiToken) {
      return json({
        success: false,
        error: "Instância sem wuzapi_url/token configurados",
        instance_name: instance.instance_name,
        port: instance.port,
      }, 500);
    }

    console.log(`[pietro-cobranca] action=${action} url=${wuzapiUrl}`);

    // ---------------- STATUS ----------------
    if (action === "status") {
      try {
        const r = await fetch(`${wuzapiUrl}/session/status`, {
          headers: { Token: wuzapiToken },
        });
        const raw = await r.json();
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
          qrcode: data?.qrcode || null,
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
        // Status primeiro
        const sResp = await fetch(`${wuzapiUrl}/session/status`, {
          headers: { Token: wuzapiToken },
        });
        const sRaw = await sResp.json();
        const sData = sRaw?.data || sRaw;

        if (sData?.loggedIn === true) {
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

        if (sData?.qrcode && sData.qrcode.length > 50) {
          return json({ success: true, qrcode: sData.qrcode, message: "QR pronto" });
        }

        // Tenta /session/qr direto
        const qResp = await fetch(`${wuzapiUrl}/session/qr`, {
          headers: { Token: wuzapiToken },
        });
        const qRaw = await qResp.json();
        const qrCode = qRaw?.data?.qrcode || qRaw?.qrcode || qRaw?.data?.QRCode || null;
        if (qrCode && qrCode.length > 50) {
          return json({ success: true, qrcode: qrCode, message: "QR gerado" });
        }

        // Força /session/connect e tenta de novo
        await fetch(`${wuzapiUrl}/session/connect`, {
          method: "POST",
          headers: { Token: wuzapiToken, "Content-Type": "application/json" },
          body: JSON.stringify({}),
        });
        await new Promise((r) => setTimeout(r, 1500));

        const q2 = await fetch(`${wuzapiUrl}/session/qr`, {
          headers: { Token: wuzapiToken },
        });
        const q2Raw = await q2.json();
        const qr2 = q2Raw?.data?.qrcode || q2Raw?.qrcode || q2Raw?.data?.QRCode || null;
        if (qr2 && qr2.length > 50) {
          return json({ success: true, qrcode: qr2, message: "QR gerado (retry)" });
        }

        return json({
          success: false,
          retry: true,
          error: "QR ainda não disponível, tente novamente em instantes",
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
