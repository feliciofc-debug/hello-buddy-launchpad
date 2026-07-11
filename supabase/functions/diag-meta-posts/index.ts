import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "*",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  const { user_id, ids } = await req.json();

  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );

  const { data: conn } = await supabase
    .from("meta_connections")
    .select("page_access_token, page_id, ig_account_id")
    .eq("user_id", user_id)
    .eq("is_active", true)
    .single();

  if (!conn) return new Response(JSON.stringify({ error: "no connection" }), { headers: corsHeaders });

  const token = conn.page_access_token;
  const results: any = { page_id: conn.page_id, ig_account_id: conn.ig_account_id, checks: [] };

  // Debug token
  const tokDbg = await fetch(
    `https://graph.facebook.com/debug_token?input_token=${token}&access_token=${token}`,
  ).then((r) => r.json());
  results.token_debug = tokDbg;

  // Recent page posts
  const pagePosts = await fetch(
    `https://graph.facebook.com/v25.0/${conn.page_id}/posts?fields=id,created_time,message&limit=5&access_token=${token}`,
  ).then((r) => r.json());
  results.recent_page_posts = pagePosts;

  // Recent IG media
  const igMedia = await fetch(
    `https://graph.facebook.com/v25.0/${conn.ig_account_id}/media?fields=id,caption,media_type,permalink,timestamp&limit=5&access_token=${token}`,
  ).then((r) => r.json());
  results.recent_ig_media = igMedia;

  // Check each id
  for (const id of ids || []) {
    const r = await fetch(
      `https://graph.facebook.com/v25.0/${id}?fields=id,permalink_url,permalink,message,caption,created_time&access_token=${token}`,
    ).then((r) => r.json());
    results.checks.push({ id, result: r });
  }

  return new Response(JSON.stringify(results, null, 2), {
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
});
