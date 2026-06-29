// WhatsApp Cloud API webhook — Fase 1.0
// GET: verificação Meta (hub.challenge)
// POST: HMAC-SHA256 (X-Hub-Signature-256) + dedup + insert na fila + 200
// Pública (sem JWT). Segurança = HMAC.

import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type, x-hub-signature-256",
  "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
};

const VERIFY_TOKEN = Deno.env.get("WHATSAPP_WEBHOOK_VERIFY_TOKEN") ?? "";
const APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { persistSession: false },
});

function timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) diff |= a[i] ^ b[i];
  return diff === 0;
}

function hexToBytes(hex: string): Uint8Array {
  const clean = hex.startsWith("sha256=") ? hex.slice(7) : hex;
  if (clean.length % 2 !== 0) return new Uint8Array();
  const out = new Uint8Array(clean.length / 2);
  for (let i = 0; i < out.length; i++) {
    out[i] = parseInt(clean.substr(i * 2, 2), 16);
  }
  return out;
}

async function verifySignature(rawBody: Uint8Array, header: string | null): Promise<boolean> {
  if (!header || !APP_SECRET) return false;
  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign(
    "HMAC",
    key,
    rawBody,
  );
  return timingSafeEqual(new Uint8Array(sig), hexToBytes(header));
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  // ---------- GET: verificação Meta ----------
  if (req.method === "GET") {
    const url = new URL(req.url);
    const mode = url.searchParams.get("hub.mode");
    const token = url.searchParams.get("hub.verify_token");
    const challenge = url.searchParams.get("hub.challenge");

    if (mode === "subscribe" && token && token === VERIFY_TOKEN && challenge) {
      return new Response(challenge, {
        status: 200,
        headers: { "Content-Type": "text/plain", ...corsHeaders },
      });
    }
    return new Response("Forbidden", { status: 403, headers: corsHeaders });
  }

  // ---------- POST: recebimento ----------
  if (req.method !== "POST") {
    return new Response("Method Not Allowed", { status: 405, headers: corsHeaders });
  }

  const rawBytes = new Uint8Array(await req.arrayBuffer());
  const rawBody = new TextDecoder().decode(rawBytes);
  const sigHeader = req.headers.get("x-hub-signature-256");

  const ok = await verifySignature(rawBytes, sigHeader);
  if (!ok) {
    console.warn("[wa-cloud-webhook] invalid signature", {
      has_signature: Boolean(sigHeader),
      signature_prefix: sigHeader?.slice(0, 7) ?? null,
      app_secret_configured: Boolean(APP_SECRET),
      body_bytes: rawBytes.length,
    });
    return new Response("Unauthorized", { status: 401, headers: corsHeaders });
  }

  let body: any;
  try {
    body = JSON.parse(rawBody);
  } catch {
    // Meta exige 200 mesmo em payload estranho, pra não desabilitar o webhook.
    return new Response("OK", { status: 200, headers: corsHeaders });
  }

  try {
    const entries = Array.isArray(body?.entry) ? body.entry : [];
    const rows: any[] = [];

    for (const entry of entries) {
      const changes = Array.isArray(entry?.changes) ? entry.changes : [];
      for (const change of changes) {
        const value = change?.value;
        if (!value) continue;
        // Ignorar statuses (entrega/leitura). Só processar messages.
        const messages = Array.isArray(value.messages) ? value.messages : [];
        if (messages.length === 0) continue;

        const phoneNumberId = value?.metadata?.phone_number_id ?? null;

        for (const msg of messages) {
          if (!msg?.id || !phoneNumberId) continue;
          rows.push({
            wamid: msg.id,
            phone_number_id: String(phoneNumberId),
            from_number: String(msg.from ?? ""),
            message_type: msg.type ?? null,
            payload: msg,
            status: "received",
          });
        }
      }
    }

    if (rows.length > 0) {
      // Resolver user_id pelo phone_number_id (whatsapp_config)
      const ids = [...new Set(rows.map((r) => r.phone_number_id))];
      const { data: configs } = await supabase
        .from("whatsapp_config")
        .select("user_id, phone_number_id")
        .in("phone_number_id", ids);

      const map = new Map<string, string>();
      for (const c of configs ?? []) {
        if (c.phone_number_id && c.user_id) map.set(c.phone_number_id, c.user_id);
      }
      for (const r of rows) {
        r.user_id = map.get(r.phone_number_id) ?? null;
      }

      // Dedup por wamid
      const { error } = await supabase
        .from("whatsapp_cloud_inbound_queue")
        .upsert(rows, { onConflict: "wamid", ignoreDuplicates: true });

      if (error) console.error("[wa-cloud-webhook] insert error", error);
    }
  } catch (e) {
    console.error("[wa-cloud-webhook] processing error", e);
    // Mesmo em erro interno: 200, senão Meta desabilita.
  }

  return new Response("OK", { status: 200, headers: corsHeaders });
});
