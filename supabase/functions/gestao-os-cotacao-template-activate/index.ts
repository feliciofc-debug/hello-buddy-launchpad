import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const authed = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await authed.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const admin = createClient(url, serviceKey);
    const nomeMeta = Deno.env.get("OS_COTACAO_CONVITE_TEMPLATE_NOME")?.trim()
      || "os_cotacao_convite_v1";
    let { data: template } = await admin.from("whatsapp_templates")
      .select("id,status_meta,motivo_rejeicao_meta,nome_meta")
      .eq("user_id", user.id)
      .eq("nome_meta", nomeMeta)
      .eq("idioma", "pt_BR")
      .maybeSingle();

    if (!template) {
      const inserted = await admin.from("whatsapp_templates").insert({
        user_id: user.id,
        nome_meta: nomeMeta,
        tipo_uso: "transacional",
        categoria_meta: "UTILITY",
        idioma: "pt_BR",
        body_text:
          "Olá, {{1}}! A {{2}} tem um pedido de cotação de serviço para o veículo {{3}}. Podemos enviar os detalhes e as fotos por aqui?",
        header: null,
        botoes: [
          { type: "QUICK_REPLY", text: "Sim, pode enviar" },
          { type: "QUICK_REPLY", text: "Não tenho agenda" },
        ],
        variaveis_map: {
          "1": { campo: "parceiro", exemplo: "Funilaria do Zé" },
          "2": { campo: "loja", exemplo: "Loja AMZ Auto" },
          "3": { campo: "veiculo", exemplo: "MINI Cooper 2021" },
        },
        status_meta: "rascunho",
      }).select("id,status_meta,motivo_rejeicao_meta,nome_meta").single();
      if (inserted.error) throw new Error(inserted.error.message);
      template = inserted.data;
    }

    if (template.status_meta === "rascunho") {
      const submitted = await fetch(`${url}/functions/v1/whatsapp-template-submit`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${serviceKey}`,
          apikey: serviceKey,
        },
        body: JSON.stringify({ user_id: user.id, template_id: template.id }),
      });
      const result = await submitted.json().catch(() => ({}));
      if (!submitted.ok || result?.success !== true) {
        throw new Error(String(result?.error ?? "Falha ao enviar modelo à Meta"));
      }
      template = { ...template, status_meta: result.status_meta ?? "pendente" };
    }

    return new Response(JSON.stringify({ success: true, template }), {
      headers: { ...cors, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : String(error),
    }), {
      status: 400,
      headers: { ...cors, "Content-Type": "application/json" },
    });
  }
});
