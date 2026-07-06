import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!;
  const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
  const supabase = createClient(SUPABASE_URL, SERVICE_KEY);

  try {
    const { image_url, user_id } = await req.json();
    if (!image_url) throw new Error("image_url é obrigatório");
    if (!user_id) throw new Error("user_id é obrigatório");

    const { data: conn } = await supabase
      .from("meta_connections")
      .select("page_id, page_access_token")
      .eq("user_id", user_id)
      .eq("is_active", true)
      .single();

    if (!conn?.page_access_token || !conn?.page_id) {
      return new Response(
        JSON.stringify({
          success: false,
          error: "Facebook não conectado. Vá em Configurações → Redes Sociais.",
        }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const token = conn.page_access_token;
    const pageId = conn.page_id;

    // Etapa 1: upload unpublished photo
    console.log("[fb-story-photo] step1 uploading unpublished photo", { pageId, image_url });
    const upRes = await fetch(`https://graph.facebook.com/v25.0/${pageId}/photos`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ url: image_url, published: false, access_token: token }),
    });
    const upTxt = await upRes.text();
    let upData: any = {};
    try { upData = JSON.parse(upTxt); } catch {}
    console.log("[fb-story-photo] step1 raw response", { status: upRes.status, body: upTxt });

    if (upData?.error || !upData?.id) {
      const raw = upData?.error?.message || upTxt || `falha_${upRes.status}`;
      const amigavel = /aspect|ratio|9:16|vertical|dimension|size/i.test(raw)
        ? "story precisa de imagem vertical 9:16"
        : `FB photo upload: ${raw}`;
      return new Response(
        JSON.stringify({ success: false, error: amigavel, raw: upData || upTxt }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const photoId = upData.id;

    // Etapa 2: publica como story
    console.log("[fb-story-photo] step2 publishing photo_stories", { pageId, photoId });
    const stRes = await fetch(`https://graph.facebook.com/v25.0/${pageId}/photo_stories`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ photo_id: photoId, access_token: token }),
    });
    const stTxt = await stRes.text();
    let stData: any = {};
    try { stData = JSON.parse(stTxt); } catch {}
    console.log("[fb-story-photo] step2 raw response", { status: stRes.status, body: stTxt });

    if (stData?.error || (!stData?.success && !stData?.post_id && !stData?.id)) {
      const raw = stData?.error?.message || stTxt || `falha_${stRes.status}`;
      const amigavel = /aspect|ratio|9:16|vertical|dimension|size/i.test(raw)
        ? "story precisa de imagem vertical 9:16"
        : `FB photo_stories: ${raw}`;
      return new Response(
        JSON.stringify({ success: false, error: amigavel, raw: stData || stTxt, photo_id: photoId }),
        { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    return new Response(
      JSON.stringify({
        success: true,
        story_id: stData.post_id || stData.id || photoId,
        photo_id: photoId,
        raw: stData,
      }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (err: any) {
    console.error("[fb-story-photo] erro", err);
    return new Response(
      JSON.stringify({ success: false, error: err?.message || "Erro desconhecido" }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
