// [EXTENSAO IMPORTAR] Receives products from the Chrome extension and inserts into produtos table.
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
const SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

const MAX_PRODUTOS = 100;
const MAX_NOME = 500;
const MAX_DESCRICAO = 2000;
const CHUNK_SIZE = 50;
const CATEGORIA_FALLBACK = "Importado Shopee";

async function sha256(text: string): Promise<string> {
  const data = new TextEncoder().encode(text);
  const hashBuffer = await crypto.subtle.digest("SHA-256", data);
  return Array.from(new Uint8Array(hashBuffer))
    .map((b) => b.toString(16).padStart(2, "0"))
    .join("");
}

function isValidUrl(s: unknown): s is string {
  if (typeof s !== "string" || !s) return false;
  try {
    const u = new URL(s);
    return u.protocol === "http:" || u.protocol === "https:";
  } catch { return false; }
}

interface ProdutoIn {
  nome?: unknown;
  preco?: unknown;
  imagem_url?: unknown;
  imagens?: unknown;
  link?: unknown;
  descricao?: unknown;
  categoria?: unknown;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  const startedAt = Date.now();

  try {
    const apiKey = req.headers.get("x-api-key") || req.headers.get("X-API-Key");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "API Key não fornecida" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const keyHash = await sha256(apiKey);
    const admin = createClient(SUPABASE_URL, SERVICE_ROLE_KEY);

    const { data: keyRow } = await admin
      .from("api_keys")
      .select("id, user_id, key_prefix")
      .eq("key_hash", keyHash)
      .is("revoked_at", null)
      .maybeSingle();

    if (!keyRow) {
      console.log(`[EXTENSAO IMPORTAR] API Key inválida prefix=${apiKey.substring(0, 16)}`);
      return new Response(JSON.stringify({ error: "API Key inválida" }), {
        status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    await admin.from("api_keys").update({ last_used_at: new Date().toISOString() }).eq("id", keyRow.id);

    let body: { marketplace?: string; produtos?: ProdutoIn[] };
    try { body = await req.json(); } catch {
      return new Response(JSON.stringify({ error: "JSON inválido" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const marketplace = (body.marketplace || "").toString().trim().toLowerCase();
    const produtosIn = Array.isArray(body.produtos) ? body.produtos : [];

    if (!marketplace) {
      return new Response(JSON.stringify({ error: "marketplace obrigatório" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (!produtosIn.length) {
      return new Response(JSON.stringify({ error: "produtos vazio" }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (produtosIn.length > MAX_PRODUTOS) {
      return new Response(JSON.stringify({ error: `Máximo ${MAX_PRODUTOS} produtos por chamada` }), {
        status: 400, headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const totalRecebidos = produtosIn.length;
    const rejeitados: Array<{ index: number; motivo: string }> = [];
    const validos: Array<{
      user_id: string; nome: string; descricao: string | null; preco: number | null;
      imagem_url: string | null; imagens: string[]; link: string;
      categoria: string; ativo: boolean; tipo: string; estoque: number;
    }> = [];

    for (let i = 0; i < produtosIn.length; i++) {
      const p = produtosIn[i] || {};
      const nomeRaw = typeof p.nome === "string" ? p.nome.trim() : "";
      const link = typeof p.link === "string" ? p.link.trim() : "";

      if (nomeRaw.length < 3) {
        rejeitados.push({ index: i, motivo: "nome inválido (mínimo 3 caracteres)" });
        continue;
      }
      if (!isValidUrl(link)) {
        rejeitados.push({ index: i, motivo: "link ausente ou inválido" });
        continue;
      }

      let nome = nomeRaw;
      if (nome.length > MAX_NOME) {
        console.log(`[TRUNCATE] nome len=${nome.length} → ${MAX_NOME}`);
        nome = nome.substring(0, MAX_NOME);
      }

      const descRaw = typeof p.descricao === "string" ? p.descricao.trim() : "";
      const descricao = descRaw ? descRaw.substring(0, MAX_DESCRICAO) : null;

      const precoNum = typeof p.preco === "number" && isFinite(p.preco) && p.preco >= 0
        ? Number(p.preco.toFixed(2)) : null;

      const imagensArr = Array.isArray(p.imagens) ? p.imagens.filter(isValidUrl) as string[] : [];
      const imagemUrlRaw = typeof p.imagem_url === "string" && isValidUrl(p.imagem_url)
        ? p.imagem_url : (imagensArr[0] || null);

      const categoriaRaw = typeof p.categoria === "string" ? p.categoria.trim() : "";
      const categoria = categoriaRaw || CATEGORIA_FALLBACK;

      validos.push({
        user_id: keyRow.user_id,
        nome,
        descricao,
        preco: precoNum,
        imagem_url: imagemUrlRaw,
        imagens: imagensArr,
        link,
        categoria,
        ativo: true,
        tipo: "fisico",
        estoque: 0,
      });
    }

    let totalDuplicados = 0;
    let toInsert = validos;

    if (validos.length) {
      const links = validos.map((v) => v.link);
      const { data: existing } = await admin
        .from("produtos")
        .select("link")
        .eq("user_id", keyRow.user_id)
        .in("link", links);

      const existingSet = new Set((existing || []).map((r: { link: string }) => r.link));
      toInsert = validos.filter((v) => !existingSet.has(v.link));
      totalDuplicados = validos.length - toInsert.length;
    }

    let totalImportados = 0;
    for (let i = 0; i < toInsert.length; i += CHUNK_SIZE) {
      const chunk = toInsert.slice(i, i + CHUNK_SIZE);
      const { error: insErr, count } = await admin
        .from("produtos")
        .insert(chunk, { count: "exact" });
      if (insErr) {
        console.error(`[EXTENSAO IMPORTAR] Erro no chunk ${i}:`, insErr.message);
      } else {
        totalImportados += count ?? chunk.length;
      }
    }

    const elapsed = Date.now() - startedAt;
    console.log(`[EXTENSAO IMPORTAR] prefix=${keyRow.key_prefix} user=${keyRow.user_id} recebidos=${totalRecebidos} rejeitados=${rejeitados.length} duplicados=${totalDuplicados} importados=${totalImportados} ms=${elapsed}`);

    return new Response(JSON.stringify({
      success: true,
      marketplace,
      total_recebidos: totalRecebidos,
      total_rejeitados: rejeitados.length,
      total_duplicados: totalDuplicados,
      total_importados: totalImportados,
      rejeitados,
    }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });

  } catch (err) {
    console.error("[EXTENSAO IMPORTAR] Fatal:", err);
    return new Response(JSON.stringify({ error: "Erro interno" }), {
      status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
