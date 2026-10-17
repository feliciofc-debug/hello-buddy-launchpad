import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";
import { hashGestaoContadorToken } from "../_shared/gestao-contador-token.ts";
import { loadGestaoContadorPacoteData } from "../_shared/gestao-contador-data.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });

  const url = new URL(req.url);
  const token = url.searchParams.get("token")?.trim();

  if (req.method === "GET" && token) {
    const hash = await hashGestaoContadorToken(token);
    const admin = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "",
    );
    const { data: row } = await admin.from("gestao_contador_token")
      .select("user_id, competencia, expires_at")
      .eq("token_hash", hash)
      .maybeSingle();
    if (!row || new Date(String(row.expires_at)) < new Date()) {
      return new Response(JSON.stringify({ error: "invalid_or_expired" }), {
        status: 403,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    await admin.from("gestao_contador_token").update({ last_access_at: new Date().toISOString() })
      .eq("token_hash", hash);

    const userId = String(row.user_id);
    const competencia = String(row.competencia);
    const pacote = await loadGestaoContadorPacoteData(admin, userId, competencia);
    return new Response(JSON.stringify(pacote), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }

  if (req.method === "POST") {
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const userClient = createClient(
      Deno.env.get("SUPABASE_URL") ?? "",
      Deno.env.get("SUPABASE_ANON_KEY") ?? "",
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data: userData } = await userClient.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "unauthorized" }), {
        status: 401,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const body = await req.json().catch(() => ({})) as { competencia?: string };
    const competencia = String(body.competencia ?? "").slice(0, 7);
    if (!/^\d{4}-\d{2}$/.test(competencia)) {
      return new Response(JSON.stringify({ error: "invalid_competencia" }), {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const { generateGestaoContadorToken, GESTAO_CONTADOR_TOKEN_TTL_DAYS } =
      await import("../_shared/gestao-contador-token.ts");
    const plain = generateGestaoContadorToken();
    const token_hash = await hashGestaoContadorToken(plain);
    const expires = new Date();
    expires.setDate(expires.getDate() + GESTAO_CONTADOR_TOKEN_TTL_DAYS);
    const { error } = await userClient.from("gestao_contador_token").insert({
      user_id: userData.user.id,
      token_hash,
      competencia,
      expires_at: expires.toISOString(),
    });
    if (error) {
      return new Response(JSON.stringify({ error: error.message }), {
        status: 500,
        headers: { ...cors, "Content-Type": "application/json" },
      });
    }
    const siteBase = (Deno.env.get("PUBLIC_SITE_URL") ?? Deno.env.get("SITE_URL") ?? "").replace(/\/$/, "");
    const publicPath = `/contador/${plain}`;
    return new Response(JSON.stringify({
      token: plain,
      competencia,
      expiresAt: expires.toISOString(),
      path: publicPath,
      appUrl: siteBase ? `${siteBase}${publicPath}` : publicPath,
    }), { headers: { ...cors, "Content-Type": "application/json" } });
  }

  return new Response(JSON.stringify({ error: "method_not_allowed" }), {
    status: 405,
    headers: { ...cors, "Content-Type": "application/json" },
  });
});

