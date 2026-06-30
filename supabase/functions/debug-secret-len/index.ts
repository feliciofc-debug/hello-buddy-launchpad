// Debug: tamanho e prefixo/sufixo de secrets, SEM expor valor
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(async () => {
  const s = Deno.env.get("META_APP_SECRET") ?? "";
  const t = Deno.env.get("WHATSAPP_TEST_ACCESS_TOKEN") ?? "";
  const id = Deno.env.get("META_APP_ID") ?? "";
  // Validate app_id + secret pair against Graph API (no token leak)
  let pair_check: unknown = null;
  if (id && s) {
    try {
      const r = await fetch(`https://graph.facebook.com/oauth/access_token?client_id=${id}&client_secret=${s}&grant_type=client_credentials`);
      const j = await r.json();
      pair_check = { status: r.status, ok: r.ok, has_access_token: !!j.access_token, error_code: j?.error?.code ?? null, error_message: j?.error?.message ?? null };
    } catch (e) { pair_check = { error: String(e) }; }
  }
  return new Response(JSON.stringify({
    META_APP_ID: id,
    META_APP_SECRET: { length: s.length, first4: s.slice(0,4), last4: s.slice(-4), has_whitespace: /\s/.test(s), is_32_hex: /^[0-9a-f]{32}$/i.test(s) },
    WHATSAPP_TEST_ACCESS_TOKEN: { length: t.length, first6: t.slice(0,6), last4: t.slice(-4), has_whitespace: /\s/.test(t) },
    pair_check,
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
