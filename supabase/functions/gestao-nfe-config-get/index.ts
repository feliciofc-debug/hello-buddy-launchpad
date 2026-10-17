import { defaultGestaoNfeOperacoes } from "../_shared/gestao-nfe-config-default.ts";
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
    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_ANON_KEY")!,
      { global: { headers: { Authorization: authHeader } } },
    );
    const { data } = await supabase.from("gestao_nfe_config")
      .select("*")
      .eq("user_id", user.id)
      .maybeSingle();
    const operacoes = { ...defaultGestaoNfeOperacoes(), ...(data?.operacoes_json ?? {}) };
    return jsonResponse({
      success: true,
      config: data
        ? { ...data, operacoes_json: operacoes }
        : {
            cnpj: "",
            inscricao_estadual: "",
            regime_tributario: "",
            razao_social: "",
            nome_fantasia: "",
            logradouro: "",
            numero: "",
            complemento: null,
            bairro: "",
            municipio: "",
            uf: "",
            cep: "",
            operacoes_json: operacoes,
          },
    });
  } catch (e) {
    return jsonResponse({ success: false, error: (e as Error).message }, 422);
  }
});
