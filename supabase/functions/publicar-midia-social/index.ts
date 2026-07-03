// Publica uma mídia (foto/vídeo) da biblioteca nas redes sociais conectadas.
// - Gera legenda via IA se ainda não houver
// - Publica no Facebook + Instagram (usa functions existentes)
// - Atualiza midias_whatsapp com status/post_urls/plataformas
// - Suporta repostagem (cria novo registro filho apontando pra midia original)

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

async function gerarLegendaComIA(
  contexto: string,
  tipo: string,
  nomeEmpresa: string,
): Promise<{ legenda: string; hashtags: string[] }> {
  const key = Deno.env.get("LOVABLE_API_KEY");
  if (!key) throw new Error("LOVABLE_API_KEY ausente");

  const prompt = `Você é um social media da empresa "${nomeEmpresa}". Um ${tipo} foi enviado pelo dono com o seguinte contexto:

"${contexto || "(sem contexto — analise só o tipo de mídia)"}"

Crie uma legenda profissional pra Instagram/Facebook (máx 500 caracteres, tom natural, sem clichê corporativo). Depois, liste 6 a 10 hashtags relevantes.

Responda em JSON puro:
{"legenda":"texto...","hashtags":["tag1","tag2"]}`;

  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${key}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "google/gemini-2.5-flash",
      messages: [{ role: "user", content: prompt }],
      response_format: { type: "json_object" },
    }),
  });

  if (!resp.ok) throw new Error(`IA falhou: ${resp.status}`);
  const data = await resp.json();
  const raw = data?.choices?.[0]?.message?.content || "{}";
  const parsed = JSON.parse(raw);
  return {
    legenda: parsed.legenda || parsed.caption || "",
    hashtags: Array.isArray(parsed.hashtags) ? parsed.hashtags : [],
  };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

    const { midia_id, repostar } = await req.json();
    if (!midia_id) throw new Error("midia_id obrigatório");

    // 1. Buscar mídia
    const { data: midia, error: mErr } = await supabase
      .from("midias_whatsapp")
      .select("*")
      .eq("id", midia_id)
      .single();
    if (mErr || !midia) throw new Error("Mídia não encontrada");

    // 2. Buscar nome da empresa
    const { data: profile } = await supabase
      .from("profiles")
      .select("nome, nome_fantasia")
      .eq("id", midia.user_id)
      .maybeSingle();
    const nomeEmpresa = (profile as any)?.nome_fantasia || (profile as any)?.nome || "Sua empresa";

    // 3. Se precisa de legenda (repostar sempre gera nova pra variar)
    let legenda = midia.legenda_gerada;
    let hashtags: string[] = midia.hashtags || [];

    if (!legenda || repostar) {
      try {
        const gerado = await gerarLegendaComIA(
          midia.contexto_original || "",
          midia.tipo,
          nomeEmpresa,
        );
        legenda = gerado.legenda;
        hashtags = gerado.hashtags;
      } catch (e) {
        console.error("IA falhou, usando fallback:", e);
        legenda = midia.contexto_original || `Novidade da ${nomeEmpresa}!`;
      }
    }

    const legendaFinal = `${legenda}\n\n${hashtags.map((h) => `#${h.replace(/^#/, "")}`).join(" ")}`.trim();

    const plataformas: string[] = [];
    const postUrls: Record<string, string> = {};
    const postIds: Record<string, string> = {};
    const erros: string[] = [];

    // 4. Publicar no Facebook
    try {
      const fbBody: any = {
        user_id: midia.user_id,
        message: legendaFinal,
      };
      if (midia.tipo === "foto") fbBody.image_url = midia.midia_url;
      if (midia.tipo === "video") fbBody.video_url = midia.midia_url;

      const { data: fbRes, error: fbErr } = await supabase.functions.invoke(
        "meta-publish-post",
        { body: fbBody },
      );
      if (fbErr) throw fbErr;
      if (fbRes?.success && fbRes?.post_id) {
        plataformas.push("facebook");
        postIds.facebook = fbRes.post_id;
        postUrls.facebook = `https://facebook.com/${fbRes.post_id}`;
      } else if (fbRes?.error) {
        erros.push(`FB: ${fbRes.error}`);
      }
    } catch (e: any) {
      console.error("FB erro:", e);
      erros.push(`FB: ${e.message || "erro"}`);
    }

    // 5. Publicar no Instagram (foto/vídeo apenas)
    if (midia.tipo === "foto" || midia.tipo === "video") {
      try {
        const igBody: any = {
          user_id: midia.user_id,
          caption: legendaFinal,
        };
        if (midia.tipo === "foto") igBody.image_url = midia.midia_url;
        if (midia.tipo === "video") igBody.video_url = midia.midia_url;

        const { data: igRes, error: igErr } = await supabase.functions.invoke(
          "meta-publish-instagram",
          { body: igBody },
        );
        if (igErr) throw igErr;
        if (igRes?.success && igRes?.post_id) {
          plataformas.push("instagram");
          postIds.instagram = igRes.post_id;
          postUrls.instagram = `https://instagram.com/p/${igRes.post_id}`;
        } else if (igRes?.error) {
          erros.push(`IG: ${igRes.error}`);
        }
      } catch (e: any) {
        console.error("IG erro:", e);
        erros.push(`IG: ${e.message || "erro"}`);
      }
    }

    // 6. Se repostar: cria registro filho referenciando o original
    if (repostar) {
      const { data: novo } = await supabase
        .from("midias_whatsapp")
        .insert({
          user_id: midia.user_id,
          origem: "repostagem",
          tipo: midia.tipo,
          midia_url: midia.midia_url,
          thumbnail_url: midia.thumbnail_url,
          contexto_original: midia.contexto_original,
          legenda_gerada: legenda,
          hashtags,
          status: plataformas.length > 0 ? "publicado" : "erro",
          plataformas,
          post_ids: postIds,
          post_urls: postUrls,
          posted_at: plataformas.length > 0 ? new Date().toISOString() : null,
          erro_mensagem: erros.length > 0 ? erros.join(" | ") : null,
          midia_pai_id: midia.id,
        })
        .select()
        .single();

      // Atualiza contador na original
      await supabase
        .from("midias_whatsapp")
        .update({
          reusos: (midia.reusos || 0) + 1,
          ultima_repostagem: new Date().toISOString(),
        })
        .eq("id", midia.id);

      return new Response(
        JSON.stringify({
          success: plataformas.length > 0,
          plataformas,
          post_urls: postUrls,
          nova_midia_id: novo?.id,
          erros: erros.length > 0 ? erros : undefined,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // 7. Atualizar registro original
    await supabase
      .from("midias_whatsapp")
      .update({
        legenda_gerada: legenda,
        hashtags,
        status: plataformas.length > 0 ? "publicado" : "erro",
        plataformas,
        post_ids: postIds,
        post_urls: postUrls,
        posted_at: plataformas.length > 0 ? new Date().toISOString() : null,
        erro_mensagem: erros.length > 0 ? erros.join(" | ") : null,
      })
      .eq("id", midia.id);

    return new Response(
      JSON.stringify({
        success: plataformas.length > 0,
        plataformas,
        post_urls: postUrls,
        erros: erros.length > 0 ? erros : undefined,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e: any) {
    console.error("publicar-midia-social erro:", e);
    return new Response(
      JSON.stringify({ success: false, error: e.message }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
