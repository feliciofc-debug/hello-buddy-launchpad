// Diagnóstico rápido da Google Custom Search
Deno.serve(async () => {
  const key = Deno.env.get("GOOGLE_API_KEY") ?? "";
  const cx = Deno.env.get("GOOGLE_CX") ?? "";
  const info: any = {
    has_key: !!key,
    key_len: key.length,
    key_prefix: key.slice(0, 6),
    has_cx: !!cx,
    cx_len: cx.length,
    cx_value: cx,
  };
  if (!key || !cx) return Response.json({ ok: false, info, motivo: "faltam variáveis" });
  const url = `https://www.googleapis.com/customsearch/v1?key=${encodeURIComponent(key)}&cx=${encodeURIComponent(cx)}&q=receita+bolo+nega+maluca&num=3&hl=pt-BR&gl=br`;
  try {
    const r = await fetch(url);
    const body = await r.text();
    return Response.json({ ok: r.ok, status: r.status, info, body_sample: body.slice(0, 800) });
  } catch (e) {
    return Response.json({ ok: false, info, erro: String((e as Error).message) });
  }
});
