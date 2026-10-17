import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import {
  ML_API_BASE,
  ML_OAUTH_REDIRECT_URI,
  mlAppUrl,
  mlClientId,
  mlClientSecret,
} from "../_shared/ml-config.ts";
import { mlLocationToPersistAfterOAuth, parseMlUserLocation } from "../_shared/ml-location.ts";
import { isMlOAuthStateExpired, mlOAuthStateExpiryCutoffIso } from "../_shared/ml-oauth-state.ts";
import { saveMlContaTokens } from "../_shared/ml-token.ts";

const redirecionar = (params: Record<string, string>) => {
  const url = new URL("/veiculos", mlAppUrl());
  Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  return new Response(null, { status: 302, headers: { Location: url.toString() } });
};

Deno.serve(async (req) => {
  try {
    const { searchParams } = new URL(req.url);
    const code = searchParams.get("code");
    const state = searchParams.get("state");
    const erroOAuth = searchParams.get("error_description") || searchParams.get("error");
    if (erroOAuth) return redirecionar({ ml: "erro", motivo: erroOAuth });
    if (!code || !state) return redirecionar({ ml: "erro", motivo: "code_ou_state_ausente" });

    const admin = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );
    await admin.from("ml_oauth_states").delete().lt("created_at", mlOAuthStateExpiryCutoffIso());

    const { data: stateRow } = await admin.from("ml_oauth_states")
      .select("user_id, created_at").eq("state", state).maybeSingle();
    if (!stateRow) return redirecionar({ ml: "erro", motivo: "state_invalido" });
    if (isMlOAuthStateExpired(String(stateRow.created_at))) {
      await admin.from("ml_oauth_states").delete().eq("state", state);
      return redirecionar({ ml: "erro", motivo: "state_expirado" });
    }
    await admin.from("ml_oauth_states").delete().eq("state", state);

    const tokenRes = await fetch(`${ML_API_BASE}/oauth/token`, {
      method: "POST",
      headers: { accept: "application/json", "content-type": "application/x-www-form-urlencoded" },
      body: new URLSearchParams({
        grant_type: "authorization_code",
        client_id: mlClientId(),
        client_secret: mlClientSecret(),
        code,
        redirect_uri: ML_OAUTH_REDIRECT_URI,
      }),
    });
    if (!tokenRes.ok) {
      console.error("[ml-oauth-callback] token", tokenRes.status);
      return redirecionar({ ml: "erro", motivo: "token" });
    }
    const token = await tokenRes.json();

    const meRes = await fetch(`${ML_API_BASE}/users/me`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    if (!meRes.ok) return redirecionar({ ml: "erro", motivo: "perfil" });
    const me = await meRes.json();
    const mlUserId = Number(me.id);

    const { data: mlContaExistente } = await admin.from("ml_contas")
      .select("user_id, status")
      .eq("ml_user_id", mlUserId)
      .maybeSingle();
    if (
      mlContaExistente &&
      mlContaExistente.user_id !== stateRow.user_id &&
      mlContaExistente.status !== "revoked"
    ) {
      return redirecionar({ ml: "erro", motivo: "conta_ml_em_uso" });
    }

    await saveMlContaTokens(admin as never, {
      userId: stateRow.user_id,
      mlUserId,
      nickname: String(me.nickname || "").trim() || null,
      accessToken: token.access_token,
      refreshToken: token.refresh_token,
      expiresInSec: Number(token.expires_in) || 21600,
    });

    const detailRes = await fetch(`${ML_API_BASE}/users/${mlUserId}`, {
      headers: { Authorization: `Bearer ${token.access_token}` },
    });
    let profileLoc = parseMlUserLocation(me as Record<string, unknown>);
    if (detailRes.ok) {
      profileLoc = parseMlUserLocation(await detailRes.json()) ?? profileLoc;
    }
    const { data: cfgRow } = await admin.from("empresa_config")
      .select("ml_location_json")
      .eq("user_id", stateRow.user_id)
      .maybeSingle();
    const loc = mlLocationToPersistAfterOAuth(cfgRow?.ml_location_json, profileLoc);
    if (loc) {
      await admin.from("empresa_config").update({ ml_location_json: loc }).eq("user_id", stateRow.user_id);
    }
    return redirecionar({ ml: "conectado" });
  } catch (e) {
    const msg = (e as Error).message;
    console.error("[ml-oauth-callback]", msg);
    if (msg.includes("duplicate") || msg.includes("unique") || msg.includes("ml_contas_ml_user_id")) {
      return redirecionar({ ml: "erro", motivo: "conta_ml_em_uso" });
    }
    return redirecionar({ ml: "erro", motivo: "inesperado" });
  }
});
