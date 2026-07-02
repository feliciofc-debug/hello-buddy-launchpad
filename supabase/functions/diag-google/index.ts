Deno.serve(async () => {
  const key = Deno.env.get("GOOGLE_API_KEY");
  const cx = Deno.env.get("GOOGLE_CX");
  const url = `https://www.googleapis.com/customsearch/v1?key=${key}&cx=${cx}&q=teste&num=1`;
  const r = await fetch(url);
  const text = await r.text();
  return new Response(JSON.stringify({ status: r.status, body: text.slice(0, 800), has_key: !!key, has_cx: !!cx }), { headers: { "Content-Type": "application/json" } });
});
