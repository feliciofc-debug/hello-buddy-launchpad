/**
 * Variante FACEBOOK FEED (paisagem 1.91:1 / 1200x630) a partir de uma imagem quadrada.
 *
 * Contexto: o Jarvis gera tudo em 1:1 (1080x1080) porque é o formato ideal do Instagram.
 * No feed do Facebook, porém, o quadrado fica pequeno/estranho — o feed do FB é otimizado
 * para paisagem 1.91:1. Então, no momento de publicar no FB (foto no feed), estendemos a
 * cena lateralmente com IA (outpainting), mantendo o produto/assunto idêntico.
 *
 * Blindagem: qualquer falha retorna a URL ORIGINAL (o FB aceita quadrado, só fica menos bonito).
 * Cache: o arquivo é gravado com nome determinístico (hash da URL de origem), então a mesma
 * imagem não é reprocessada em publicações seguintes.
 */

const BUCKET = "produtos";

async function hashUrl(url: string): Promise<string> {
  const buf = await crypto.subtle.digest("SHA-1", new TextEncoder().encode(url));
  return [...new Uint8Array(buf)].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, 16);
}

function b64encode(bytes: Uint8Array): string {
  let bin = "";
  const chunk = 0x8000;
  for (let i = 0; i < bytes.length; i += chunk) {
    bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
  }
  return btoa(bin);
}

function b64decode(b64: string): Uint8Array {
  const bin = atob(b64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
}

export async function gerarVarianteFacebookFeed(
  // deno-lint-ignore no-explicit-any
  sb: any,
  imageUrl: string,
  userId: string,
  lovableApiKey: string | undefined,
): Promise<{ url: string; convertida: boolean; motivo?: string }> {
  try {
    if (!imageUrl || !/^https?:\/\//i.test(imageUrl)) return { url: imageUrl, convertida: false, motivo: "url_invalida" };
    if (!lovableApiKey) return { url: imageUrl, convertida: false, motivo: "sem_api_key" };
    if (imageUrl.includes("/fb-feed/")) return { url: imageUrl, convertida: false, motivo: "ja_e_variante" };

    const h = await hashUrl(imageUrl);
    const path = `fb-feed/${userId}/${h}.png`;

    // cache
    const { data: pubCache } = sb.storage.from(BUCKET).getPublicUrl(path);
    if (pubCache?.publicUrl) {
      try {
        const head = await fetch(pubCache.publicUrl, { method: "HEAD" });
        if (head.ok) return { url: pubCache.publicUrl, convertida: true, motivo: "cache" };
      } catch { /* segue e gera */ }
    }

    const src = await fetch(imageUrl, { signal: AbortSignal.timeout(20000) });
    if (!src.ok) return { url: imageUrl, convertida: false, motivo: `download_${src.status}` };
    const mimeIn = src.headers.get("content-type") || "image/jpeg";
    const bytesIn = new Uint8Array(await src.arrayBuffer());
    const dataUrl = `data:${mimeIn};base64,${b64encode(bytesIn)}`;

    const prompt = `Reenquadre esta imagem para o formato PAISAGEM 1.91:1 (1200x630 px), padrão do feed do Facebook.

REGRAS OBRIGATÓRIAS:
- ESTENDA a cena para os lados (outpainting) continuando o cenário, a iluminação, as sombras, o piso e o fundo de forma natural e contínua.
- É PROIBIDO deformar, esticar, encolher ou recortar o produto/assunto principal: ele deve ficar IDÊNTICO (mesmas cores, mesmo rótulo, mesmos textos, mesmas proporções) e permanecer em destaque.
- Se houver pessoas, mantenha os MESMOS rostos e feições.
- Se houver textos/logo na imagem original, mantenha-os legíveis, com a mesma grafia, sem duplicar e sem cortar.
- Preencha 100% do quadro: sem bordas brancas, sem barras laterais, sem letterbox, sem moldura, sem fundo desfocado artificial.
- Resultado fotorealista, alta qualidade, pronto para publicação no feed do Facebook.`;

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: { "Content-Type": "application/json", Authorization: `Bearer ${lovableApiKey}` },
      body: JSON.stringify({
        model: "google/gemini-3.1-flash-image",
        messages: [{
          role: "user",
          content: [
            { type: "text", text: prompt },
            { type: "image_url", image_url: { url: dataUrl } },
          ],
        }],
        modalities: ["image", "text"],
      }),
      signal: AbortSignal.timeout(90000),
    });
    if (!res.ok) return { url: imageUrl, convertida: false, motivo: `gateway_${res.status}` };
    const data = await res.json();
    const outUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;
    if (!outUrl) return { url: imageUrl, convertida: false, motivo: "sem_imagem_retornada" };

    let b64 = outUrl;
    let mime = "image/png";
    if (b64.startsWith("data:")) {
      const m = b64.match(/^data:(image\/\w+);base64,(.+)$/);
      if (m) { mime = m[1]; b64 = m[2]; }
    }
    const bytesOut = b64decode(b64);
    const { error: upErr } = await sb.storage.from(BUCKET).upload(path, bytesOut, { contentType: mime, upsert: true });
    if (upErr) return { url: imageUrl, convertida: false, motivo: `upload_${upErr.message}` };
    const { data: pub } = sb.storage.from(BUCKET).getPublicUrl(path);
    if (!pub?.publicUrl) return { url: imageUrl, convertida: false, motivo: "sem_url_publica" };
    return { url: pub.publicUrl, convertida: true };
  } catch (e) {
    return { url: imageUrl, convertida: false, motivo: `exception_${(e as Error).message}` };
  }
}
