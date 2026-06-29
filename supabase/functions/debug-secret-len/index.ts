// Debug: tamanho e prefixo/sufixo de secrets, SEM expor valor
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
Deno.serve(() => {
  const s = Deno.env.get("META_APP_SECRET") ?? "";
  const t = Deno.env.get("WHATSAPP_TEST_ACCESS_TOKEN") ?? "";
  return new Response(JSON.stringify({
    META_APP_SECRET: {
      length: s.length,
      first4: s.slice(0, 4),
      last4: s.slice(-4),
      has_whitespace: /\s/.test(s),
      is_32_hex: /^[0-9a-f]{32}$/i.test(s),
    },
    WHATSAPP_TEST_ACCESS_TOKEN: {
      length: t.length,
      first6: t.slice(0, 6),
      last4: t.slice(-4),
      has_whitespace: /\s/.test(t),
    },
  }), { headers: { ...cors, "Content-Type": "application/json" } });
});
