// ============================================================
// video-transcrever-legendas
// Recebe { video_url } e devolve segmentos de legenda em pt-BR
// prontos para serem "queimados" no vídeo pelo frontend.
//
// Usa o Lovable AI Gateway (video understanding) — sem chave do cliente.
// ============================================================

import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

interface Segmento {
  start: number;
  end: number;
  text: string;
}

function normalizarSegmentos(raw: any[]): Segmento[] {
  const segs: Segmento[] = [];
  for (const s of raw || []) {
    const start = Number(s?.start ?? s?.inicio ?? 0);
    const end = Number(s?.end ?? s?.fim ?? 0);
    const text = String(s?.text ?? s?.texto ?? "").trim();
    if (!text) continue;
    if (!isFinite(start) || !isFinite(end) || end <= start) continue;
    segs.push({ start: Math.max(0, start), end, text });
  }
  // ordena e remove sobreposição
  segs.sort((a, b) => a.start - b.start);
  for (let i = 1; i < segs.length; i++) {
    if (segs[i].start < segs[i - 1].end) segs[i].start = segs[i - 1].end;
  }
  return segs.filter((s) => s.end - s.start >= 0.3);
}

// ============================================================
// Rede de segurança do nome da empresa
// O modelo pode ignorar a instrução de grafia e escrever "Ademicom".
// Corrigimos apenas quando a palavra transcrita é MUITO parecida com o
// nome cadastrado (1 ou 2 letras de diferença), para nunca trocar uma
// palavra legítima por engano.
// ============================================================
function distanciaLevenshtein(a: string, b: string): number {
  const m = a.length;
  const n = b.length;
  if (!m) return n;
  if (!n) return m;
  let prev = Array.from({ length: n + 1 }, (_, j) => j);
  for (let i = 1; i <= m; i++) {
    const atual = [i, ...new Array(n).fill(0)];
    for (let j = 1; j <= n; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(prev[j] + 1, atual[j - 1] + 1, prev[j - 1] + custo);
    }
    prev = atual;
  }
  return prev[n];
}

const semAcento = (s: string) =>
  s.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();

/** Corrige grafias quase idênticas ao nome da empresa dentro dos segmentos. */
function corrigirNomeEmpresa(segs: Segmento[], nomeEmpresa?: string): Segmento[] {
  const nome = (nomeEmpresa || "").trim();
  if (!nome) return segs;

  // Só palavras únicas com 5+ letras (evita "Casa", "Auto", nomes compostos genéricos)
  const alvos = nome
    .split(/\s+/)
    .map((p) => p.replace(/[^\p{L}\p{N}]/gu, ""))
    .filter((p) => p.length >= 5);
  if (alvos.length === 0) return segs;

  let trocas = 0;
  const corrigidos = segs.map((s) => ({
    ...s,
    text: s.text.replace(/[\p{L}\p{N}]{4,}/gu, (palavra) => {
      for (const alvo of alvos) {
        const a = semAcento(palavra);
        const b = semAcento(alvo);
        if (a === b) return palavra === alvo ? palavra : (trocas++, alvo);
        const dist = distanciaLevenshtein(a, b);
        const limite = b.length >= 8 ? 2 : 1;
        if (dist > 0 && dist <= limite && Math.abs(a.length - b.length) <= 2) {
          trocas++;
          return alvo;
        }
      }
      return palavra;
    }),
  }));

  if (trocas > 0) {
    console.log(`[legendas] grafia da empresa corrigida em ${trocas} ocorrência(s)`);
  }
  return corrigidos;
}


Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const { video_url, nome_empresa } = await req.json();
    if (!video_url || !/^https?:\/\//i.test(String(video_url))) {
      throw new Error("video_url é obrigatório");
    }
    const nomeEmpresa = String(nome_empresa || "").trim().slice(0, 80);


    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY não configurada");

    // Se o vídeo estiver em bucket privado, gera URL assinada; caso contrário usa direto.
    let urlParaIA = String(video_url);
    try {
      const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
      const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
      const admin = createClient(SUPABASE_URL, SERVICE_KEY);
      const m = urlParaIA.match(
        /\/storage\/v1\/object\/(?:public|sign)\/([^/]+)\/(.+?)(?:\?|$)/,
      );
      if (m) {
        const [, bucket, path] = m;
        const { data } = await admin.storage
          .from(bucket)
          .createSignedUrl(decodeURIComponent(path), 3600);
        if (data?.signedUrl) urlParaIA = data.signedUrl;
      }
    } catch (_e) {
      /* segue com a URL original */
    }

    const prompt = `Transcreva a FALA deste vídeo em português do Brasil e devolva legendas curtas, prontas para leitura na tela.

REGRAS:
- Divida em blocos curtos de no máximo 42 caracteres (1 linha) ou 2 linhas separadas por \\n.
- Cada bloco dura entre 1 e 3.5 segundos e acompanha exatamente o que é falado.
- Não invente conteúdo. Se não houver fala, devolva uma lista vazia.
- Sem emojis, sem marcações, apenas o texto falado com pontuação natural.
- Transcreva com capitalização natural: primeira letra de cada frase em maiúscula, nomes próprios e marcas com a grafia correta (ex.: WhatsApp, TikTok, Tramontina, AMZ Ofertas). Não escreva em caixa alta.
${nomeEmpresa ? `- O vídeo é de uma empresa chamada "${nomeEmpresa}". Sempre que esse nome aparecer na fala, escreva exatamente com essa grafia.` : ""}

Responda SOMENTE com JSON válido no formato:
{"segments":[{"start":0.0,"end":2.4,"text":"texto da legenda"}]}`;


    const res = await fetch(
      "https://ai.gateway.lovable.dev/v1/chat/completions",
      {
        method: "POST",
        headers: {
          Authorization: `Bearer ${LOVABLE_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "google/gemini-3.6-flash",
          messages: [
            {
              role: "user",
              content: [
                { type: "text", text: prompt },
                { type: "video_url", video_url: { url: urlParaIA } },
              ],
            },
          ],
          response_format: { type: "json_object" },
        }),
      },
    );

    if (!res.ok) {
      const errTxt = await res.text();
      console.error("[legendas] gateway falhou:", res.status, errTxt);
      return new Response(
        JSON.stringify({
          success: false,
          error:
            res.status === 429
              ? "Muitas solicitações agora. Tente novamente em instantes."
              : res.status === 402
                ? "Créditos de IA insuficientes para transcrever o vídeo."
                : "Não consegui transcrever este vídeo. Confira se ele tem áudio e tente novamente.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const json = await res.json();
    const content: string = json?.choices?.[0]?.message?.content ?? "";
    let parsed: any = {};
    try {
      parsed = JSON.parse(content);
    } catch {
      const m = content.match(/\{[\s\S]*\}/);
      if (m) parsed = JSON.parse(m[0]);
    }

    const segments = normalizarSegmentos(parsed?.segments || parsed?.segmentos || []);

    return new Response(
      JSON.stringify({ success: true, segments }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (error) {
    console.error("[legendas] erro:", error);
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : "Erro desconhecido",
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
