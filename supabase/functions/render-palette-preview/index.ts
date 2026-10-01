import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { initWasm, Resvg } from "https://esm.sh/@resvg/resvg-wasm@2.6.2";
import { corsHeaders } from "../_shared/cors.ts";

let wasmReady: Promise<void> | null = null;
let fontReady: Promise<Uint8Array> | null = null;
const ensureWasm = () => {
  if (!wasmReady) {
    wasmReady = initWasm(
      fetch("https://cdn.jsdelivr.net/npm/@resvg/resvg-wasm@2.6.2/index_bg.wasm"),
    ).catch((error) => {
      wasmReady = null;
      throw error;
    });
  }
  return wasmReady;
};

const ensureFont = () => {
  if (!fontReady) {
    fontReady = fetch("https://cdn.jsdelivr.net/npm/@fontsource/inter@5.2.8/files/inter-latin-400-normal.woff2")
      .then(async (response) => {
        if (!response.ok) throw new Error(`fonte da prévia indisponível: ${response.status}`);
        return new Uint8Array(await response.arrayBuffer());
      })
      .catch((error) => {
        fontReady = null;
        throw error;
      });
  }
  return fontReady;
};

const escapeXml = (value: unknown) =>
  String(value ?? "").replace(/[<>&"']/g, (char) => ({
    "<": "&lt;",
    ">": "&gt;",
    "&": "&amp;",
    '"': "&quot;",
    "'": "&apos;",
  })[char] ?? char);

const validHex = (value: unknown) => /^#[0-9a-f]{6}$/i.test(String(value ?? ""));

function textColor(hex: string): string {
  const value = Number.parseInt(hex.slice(1), 16);
  const r = (value >> 16) & 255;
  const g = (value >> 8) & 255;
  const b = value & 255;
  return (r * 0.299 + g * 0.587 + b * 0.114) / 255 > 0.58 ? "#111827" : "#ffffff";
}

const bytesToBase64 = (bytes: Uint8Array): string => {
  let binary = "";
  for (let offset = 0; offset < bytes.length; offset += 8192) {
    binary += String.fromCharCode(...bytes.subarray(offset, offset + 8192));
  }
  return btoa(binary);
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  try {
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
    if (req.headers.get("Authorization") !== `Bearer ${serviceKey}`) {
      return new Response(JSON.stringify({ success: false, error: "Não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const body = await req.json();
    const userId = String(body?.user_id ?? "");
    const colors = (Array.isArray(body?.colors) ? body.colors : [])
      .map((item: any, index: number) => ({
        index: index + 1,
        hex: String(item?.hex ?? "").toLowerCase(),
        role: String(item?.role ?? `Cor ${index + 1}`),
      }))
      .filter((item: any) => validHex(item.hex))
      .slice(0, 6);
    if (!userId || colors.length < 2) throw new Error("user_id e ao menos duas cores são obrigatórios");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, serviceKey);
    const logoPath = String(body?.logo_path ?? "");
    let logoDataUrl = "";
    if (logoPath.startsWith(`${userId}/video-site/`)) {
      const { data: logo, error: logoError } = await supabase.storage.from("tenant-logos").download(logoPath);
      if (logoError) {
        console.warn("[render-palette-preview][logo]", logoError.message);
      } else if (logo && logo.size <= 5 * 1024 * 1024) {
        const mime = logo.type.startsWith("image/") ? logo.type : "image/png";
        logoDataUrl = `data:${mime};base64,${bytesToBase64(new Uint8Array(await logo.arrayBuffer()))}`;
      }
    }

    const width = 1080;
    const rowHeight = 112;
    const height = 170 + colors.length * rowHeight;
    const rows = colors.map((item: any, index: number) => {
      const y = 130 + index * rowHeight;
      return `<g>
        <rect x="70" y="${y}" width="940" height="86" rx="18" fill="${item.hex}"/>
        <circle cx="120" cy="${y + 43}" r="27" fill="${textColor(item.hex)}" fill-opacity="0.94"/>
        <text x="120" y="${y + 53}" text-anchor="middle" font-size="29" font-weight="800" fill="${item.hex}">${item.index}</text>
        <text x="175" y="${y + 38}" font-size="30" font-weight="700" fill="${textColor(item.hex)}">${escapeXml(item.role)}</text>
        <text x="175" y="${y + 70}" font-size="26" font-weight="500" fill="${textColor(item.hex)}">${item.hex.toUpperCase()}</text>
      </g>`;
    }).join("");
    const logo = logoDataUrl
      ? `<rect x="760" y="24" width="250" height="88" rx="16" fill="#ffffff" stroke="#e2e8f0"/>
         <image href="${escapeXml(logoDataUrl)}" x="776" y="36" width="218" height="64" preserveAspectRatio="xMidYMid meet"/>`
      : "";
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
      <rect width="100%" height="100%" fill="#f8fafc"/>
      <text x="70" y="62" font-family="Inter" font-size="38" font-weight="800" fill="#111827">Paleta encontrada</text>
      <text x="70" y="101" font-family="Inter" font-size="23" fill="#475569">Confira os números e códigos antes de gerar</text>
      ${logo}
      <g font-family="Inter">${rows}</g>
    </svg>`;

    const [, font] = await Promise.all([ensureWasm(), ensureFont()]);
    const png = new Resvg(svg, {
      fitTo: { mode: "width", value: width },
      font: { fontBuffers: [font], defaultFontFamily: "Inter" },
      textRendering: 1,
    }).render().asPng();
    const path = `${userId}/palette-previews/${Date.now()}-${crypto.randomUUID().slice(0, 8)}.png`;
    const { error } = await supabase.storage.from("temp").upload(path, png, {
      contentType: "image/png",
      upsert: false,
    });
    if (error) throw error;
    const { data } = supabase.storage.from("temp").getPublicUrl(path);
    return new Response(JSON.stringify({ success: true, image_url: data.publicUrl, path }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    console.error("[render-palette-preview]", (error as Error).message);
    return new Response(JSON.stringify({ success: false, error: (error as Error).message }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
