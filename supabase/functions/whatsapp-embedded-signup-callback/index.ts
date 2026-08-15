// Fase 1.2 — Embedded Signup Callback (ESQUELETO)
// Recebe { code, waba_id, phone_number_id } do frontend após o popup do Facebook
// Login for Business retornar. Faz: troca code → long-lived token → register phone →
// subscribe app no WABA → grava em whatsapp_config.
//
// ⚠️ Estratégia de token confirmada: long-lived user token (60d) + cron de refresh.
//    NÃO usar System User no flow embedded de terceiros (frágil — derruba onboarding).

import { createClient } from "npm:@supabase/supabase-js@2";
import { corsHeaders } from "npm:@supabase/supabase-js@2/cors";

// App do WhatsApp e app do Meta (Instagram/Facebook) podem ser DIFERENTES.
// Nunca misturar app_id de um com app_secret do outro: o par tem que ser coerente.
const WA_APP_ID = Deno.env.get("WHATSAPP_APP_ID");
const WA_APP_SECRET = Deno.env.get("WHATSAPP_APP_SECRET");
const META_APP_ID = WA_APP_ID && WA_APP_SECRET ? WA_APP_ID : Deno.env.get("META_APP_ID")!;
const META_APP_SECRET = WA_APP_ID && WA_APP_SECRET ? WA_APP_SECRET : Deno.env.get("META_APP_SECRET")!;
const GRAPH = "https://graph.facebook.com/v25.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    // 1) Autenticar usuário do JWT
    const authHeader = req.headers.get("Authorization");
    if (!authHeader?.startsWith("Bearer ")) {
      return json({ error: "Unauthorized" }, 401);
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: claims, error: claimsErr } = await userClient.auth.getClaims(
      authHeader.replace("Bearer ", ""),
    );
    if (claimsErr || !claims?.claims?.sub) return json({ error: "Unauthorized" }, 401);
    const userId = claims.claims.sub as string;

    // 2) Validar payload — waba_id/phone_number_id são opcionais:
    //    quando a Meta não envia o postMessage WA_EMBEDDED_SIGNUP, resolvemos
    //    os IDs pelo próprio token (debug_token + /phone_numbers).
    const body = await req.json();
    const { code, pin } = body;
    let waba_id: string | null = body.waba_id ?? null;
    let phone_number_id: string | null = body.phone_number_id ?? null;
    if (!code) {
      return json({ error: "missing_fields", required: ["code"] }, 400);
    }

    const registerPin = typeof pin === "string" && /^\d{6}$/.test(pin) ? pin : "000000";

    // 3) Trocar code → access_token de curta duração
    const shortRes = await fetch(
      `${GRAPH}/oauth/access_token?` + new URLSearchParams({
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        code,
      }),
    );
    const shortJson = await shortRes.json();
    if (!shortRes.ok || !shortJson.access_token) {
      return json({ success: false, step: "code_exchange", error: shortJson }, 200);
    }
    const shortToken = shortJson.access_token as string;

    // 4) Trocar por long-lived token (60d)
    const longRes = await fetch(
      `${GRAPH}/oauth/access_token?` + new URLSearchParams({
        grant_type: "fb_exchange_token",
        client_id: META_APP_ID,
        client_secret: META_APP_SECRET,
        fb_exchange_token: shortToken,
      }),
    );
    const longJson = await longRes.json();
    if (!longRes.ok || !longJson.access_token) {
      return json({ success: false, step: "long_lived_exchange", error: longJson }, 200);
    }
    const accessToken = longJson.access_token as string;
    const expiresInSec = (longJson.expires_in as number) ?? 60 * 24 * 60 * 60; // fallback 60d
    const tokenExpiresAt = new Date(Date.now() + expiresInSec * 1000).toISOString();

    // 4.1) Resolver waba_id / phone_number_id quando o frontend não recebeu o
    //      postMessage da Meta. debug_token traz os target_ids concedidos
    //      (granular_scopes) para whatsapp_business_management/messaging.
    if (!waba_id || !phone_number_id) {
      try {
        const dbgRes = await fetch(
          `${GRAPH}/debug_token?input_token=${accessToken}&access_token=${META_APP_ID}|${META_APP_SECRET}`,
        );
        const dbgJson = await dbgRes.json();
        const scopes: any[] = dbgJson?.data?.granular_scopes ?? [];
        const waScope = scopes.find((s) =>
          s?.scope === "whatsapp_business_management" || s?.scope === "whatsapp_business_messaging"
        );
        const candidateWaba = waba_id ?? waScope?.target_ids?.[0] ?? null;
        if (!candidateWaba) {
          return json({
            success: false,
            step: "resolve_waba",
            error: "Não foi possível identificar a conta WhatsApp Business concedida. Refaça a conexão concluindo todas as etapas do assistente da Meta (criar conta do WhatsApp Business e adicionar o número).",
            debug: dbgJson?.data?.granular_scopes ?? null,
          }, 200);
        }
        waba_id = candidateWaba;
        if (!phone_number_id) {
          const pnRes = await fetch(
            `${GRAPH}/${waba_id}/phone_numbers?fields=id,display_phone_number,verified_name&access_token=${accessToken}`,
          );
          const pnJson = await pnRes.json();
          const first = Array.isArray(pnJson?.data) ? pnJson.data[0] : null;
          if (!first?.id) {
            return json({
              success: false,
              step: "resolve_phone_number",
              error: "A conta WhatsApp Business foi criada, mas nenhum número foi adicionado/verificado. Refaça a conexão e conclua a verificação do número por SMS.",
              detail: pnJson,
            }, 200);
          }
          phone_number_id = first.id as string;
        }
      } catch (e) {
        return json({ success: false, step: "resolve_ids_exception", error: String(e) }, 200);
      }
    }



    // 5) Buscar metadados do phone_number (display_phone, verified_name)
    let displayPhone: string | null = null;
    let businessName: string | null = null;
    try {
      const metaRes = await fetch(
        `${GRAPH}/${phone_number_id}?fields=display_phone_number,verified_name&access_token=${accessToken}`,
      );
      const metaJson = await metaRes.json();
      displayPhone = metaJson.display_phone_number ?? null;
      businessName = metaJson.verified_name ?? null;
    } catch (_) {
      // não crítico — segue
    }

    // 6) Registrar o número na Cloud API (idempotente) — PIN configurável
    let registerWarning: unknown = null;
    try {
      const regRes = await fetch(`${GRAPH}/${phone_number_id}/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json", Authorization: `Bearer ${accessToken}` },
        body: JSON.stringify({ messaging_product: "whatsapp", pin: registerPin }),
      });
      if (!regRes.ok) {
        // Não é fatal: número já registrado devolve erro idempotente.
        // Mas PIN incorreto (2FA já definido) precisa ser visível pro cliente.
        registerWarning = await regRes.json().catch(() => null);
      }
    } catch (e) { registerWarning = String(e); }

    // 7) Subscribed_apps: GET primeiro, só POST se ainda não subscrito
    try {
      const subCheck = await fetch(
        `${GRAPH}/${waba_id}/subscribed_apps?access_token=${accessToken}`,
      );
      const subJson = await subCheck.json();
      const alreadySubscribed = Array.isArray(subJson?.data) &&
        subJson.data.some((a: any) => a?.whatsapp_business_api_data?.id === META_APP_ID);
      if (!alreadySubscribed) {
        const subRes = await fetch(`${GRAPH}/${waba_id}/subscribed_apps`, {
          method: "POST",
          headers: { Authorization: `Bearer ${accessToken}` },
        });
        const subResJson = await subRes.json();
        if (!subRes.ok) {
          return json({ success: false, step: "subscribed_apps", error: subResJson }, 200);
        }
      }
    } catch (e) {
      return json({ success: false, step: "subscribed_apps_exception", error: String(e) }, 200);
    }

    // 8) Persistir em whatsapp_config (upsert por user_id)
    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    const { error: upsertErr } = await admin
      .from("whatsapp_config")
      .upsert({
        user_id: userId,
        phone_number_id,
        waba_id,
        access_token: accessToken,
        display_phone: displayPhone,
        business_name: businessName,
        is_active: true,
        is_verified: true,
        last_verified_at: new Date().toISOString(),
        token_expires_at: tokenExpiresAt,
        last_refresh_at: new Date().toISOString(),
        refresh_attempts: 0,
        alert_status: "none",
        connection_method: "embedded_signup",
        updated_at: new Date().toISOString(),
      }, { onConflict: "user_id" });

    if (upsertErr) {
      return json({ success: false, step: "db_upsert", error: upsertErr.message }, 200);
    }

    return json({
      success: true,
      display_phone: displayPhone,
      business_name: businessName,
      token_expires_at: tokenExpiresAt,
      register_warning: registerWarning,
    }, 200);
  } catch (e) {
    return json({ success: false, error: String(e) }, 200);
  }
});

function json(body: unknown, status: number) {
  const b = body as any;
  if (b && b.success === false) {
    console.error("[embedded-signup] FALHA", JSON.stringify(b));
  }
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

