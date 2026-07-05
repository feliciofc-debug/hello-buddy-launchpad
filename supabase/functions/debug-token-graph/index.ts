// READ-ONLY diagnostic: testa tokens de secrets contra Graph API. Não escreve nada.
const cors = { "Access-Control-Allow-Origin": "*", "Access-Control-Allow-Headers": "*" };
const PNID = "1136417836228337";

async function testToken(token: string) {
  if (!token) return { present: false };
  try {
    const r = await fetch(`https://graph.facebook.com/v25.0/${PNID}?access_token=${token}`);
    const j = await r.json();
    return {
      present: true,
      length: token.length,
      first8: token.slice(0, 8),
      status: r.status,
      ok: r.ok,
      display_phone_number: j?.display_phone_number ?? null,
      error_code: j?.error?.code ?? null,
      error_subcode: j?.error?.error_subcode ?? null,
      error_message: j?.error?.message ?? null,
    };
  } catch (e) {
    return { present: true, length: token.length, first8: token.slice(0, 8), error: String(e) };
  }
}

Deno.serve(async () => {
  const names = [
    "WHATSAPP_PERMANENT_TOKEN",
    "WHATSAPP_TEST_ACCESS_TOKEN",
    "META_PAGE_ACCESS_TOKEN",
    "WHATSAPP_APP_SECRET",
    "META_APP_SECRET",
    "WUZAPI_TOKEN",
  ];
  const out: Record<string, unknown> = {};
  for (const n of names) {
    const v = Deno.env.get(n) ?? "";
    if (n === "WHATSAPP_APP_SECRET" || n === "META_APP_SECRET" || n === "WUZAPI_TOKEN") {
      out[n] = { present: !!v, length: v.length, first8: v.slice(0, 8) };
    } else {
      out[n] = await testToken(v);
    }
  }
  return new Response(JSON.stringify(out, null, 2), {
    headers: { ...cors, "Content-Type": "application/json" },
  });
});
