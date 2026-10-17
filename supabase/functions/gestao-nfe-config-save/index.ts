import {
  gestaoZapsignAuthedUser,
  jsonResponse,
  optionsResponse,
} from "../_shared/gestao-zapsign-http.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return optionsResponse();
  try {
    const { user, authHeader } = await gestaoZapsignAuthedUser(req);
    if (!user) return jsonResponse({ success: false, error: "Não autenticado" }, 401);
    const body = await req.json();
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const row = {
      user_id: user.id,
      cnpj: String(body?.cnpj ?? ""),
      inscricao_estadual: String(body?.inscricao_estadual ?? ""),
      regime_tributario: String(body?.regime_tributario ?? ""),
      razao_social: String(body?.razao_social ?? ""),
      nome_fantasia: String(body?.nome_fantasia ?? ""),
      logradouro: String(body?.logradouro ?? ""),
      numero: String(body?.numero ?? ""),
      complemento: body?.complemento != null ? String(body.complemento) : null,
      bairro: String(body?.bairro ?? ""),
      municipio: String(body?.municipio ?? ""),
      uf: String(body?.uf ?? "").toUpperCase().slice(0, 2),
      cep: String(body?.cep ?? ""),
      operacoes_json: body?.operacoes_json ?? {},
      updated_at: new Date().toISOString(),
    };
    const { error } = await supabase.from("gestao_nfe_config").upsert(row, {
      onConflict: "user_id",
    });
    if (error) throw new Error("Não foi possível salvar a configuração fiscal.");
    return jsonResponse({ success: true, message: "Configuração fiscal salva." });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
