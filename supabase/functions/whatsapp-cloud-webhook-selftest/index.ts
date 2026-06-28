// Self-test: assina um payload com META_APP_SECRET e POSTa no whatsapp-cloud-webhook.
// Uso: GET/POST nesta função, retorna { status, body } da chamada.

const APP_SECRET = Deno.env.get("META_APP_SECRET") ?? "";
const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;

function bytesToHex(b: Uint8Array): string {
  return Array.from(b).map((x) => x.toString(16).padStart(2, "0")).join("");
}

Deno.serve(async () => {
  const payload = {
    object: "whatsapp_business_account",
    entry: [
      {
        id: "TEST_ENTRY",
        changes: [
          {
            field: "messages",
            value: {
              messaging_product: "whatsapp",
              metadata: {
                display_phone_number: "5521999998888",
                phone_number_id: "TEST_PHONE_NUMBER_ID",
              },
              contacts: [{ profile: { name: "Teste" }, wa_id: "5521999998888" }],
              messages: [
                {
                  id: "wamid.TESTE_REAL_001",
                  from: "5521999998888",
                  timestamp: String(Math.floor(Date.now() / 1000)),
                  type: "text",
                  text: { body: "teste fase 1.0" },
                },
              ],
            },
          },
        ],
      },
    ],
  };

  const rawBody = JSON.stringify(payload);

  const key = await crypto.subtle.importKey(
    "raw",
    new TextEncoder().encode(APP_SECRET),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign"],
  );
  const sig = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(rawBody));
  const signature = "sha256=" + bytesToHex(new Uint8Array(sig));

  const url = `${SUPABASE_URL}/functions/v1/whatsapp-cloud-webhook`;
  const res = await fetch(url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-Hub-Signature-256": signature,
    },
    body: rawBody,
  });
  const text = await res.text();

  return new Response(
    JSON.stringify({
      target_url: url,
      sent_signature: signature,
      raw_body_length: rawBody.length,
      response_status: res.status,
      response_body: text,
    }, null, 2),
    { headers: { "Content-Type": "application/json" } },
  );
});
