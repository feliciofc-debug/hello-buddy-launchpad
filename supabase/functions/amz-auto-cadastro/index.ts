import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  type AmzAutoCadastroPayload,
  validateAmzAutoCadastro,
} from "../_shared/amz-auto-cadastro-validate.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

const RATE_LIMIT = 5;
const RATE_WINDOW_MS = 60 * 60 * 1000;

function clientIp(req: Request): string | null {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const first = xff.split(",")[0]?.trim();
    if (first) return first.slice(0, 64);
  }
  const cf = req.headers.get("cf-connecting-ip")?.trim();
  if (cf) return cf.slice(0, 64);
  return null;
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return new Response(JSON.stringify({ error: "Método não permitido." }), {
      status: 405,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  try {
    const body = (await req.json()) as AmzAutoCadastroPayload;
    const validated = validateAmzAutoCadastro(body);
    if (!validated.ok) {
      return new Response(JSON.stringify({ error: validated.error }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
    );

    const ip = clientIp(req);
    if (ip) {
      const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
      const { count, error: rateError } = await supabase
        .from("amz_auto_cadastros")
        .select("id", { count: "exact", head: true })
        .eq("client_ip", ip)
        .gte("created_at", since);

      if (rateError) {
        console.error("amz-auto-cadastro rate check failed");
        return new Response(
          JSON.stringify({ error: "Não foi possível processar o cadastro." }),
          {
            status: 503,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }

      if ((count ?? 0) >= RATE_LIMIT) {
        return new Response(
          JSON.stringify({
            error: "Muitas tentativas. Tente novamente mais tarde.",
          }),
          {
            status: 429,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
    }

    const row = {
      ...validated.data,
      status: "em_analise",
      client_ip: ip,
    };

    const { error: insertError } = await supabase
      .from("amz_auto_cadastros")
      .insert(row);

    if (insertError) {
      if (insertError.code === "23505") {
        return new Response(
          JSON.stringify({
            error: "Já existe um cadastro com este CNPJ.",
          }),
          {
            status: 409,
            headers: { ...corsHeaders, "Content-Type": "application/json" },
          },
        );
      }
      console.error("amz-auto-cadastro insert failed", insertError.code);
      return new Response(
        JSON.stringify({ error: "Não foi possível salvar o cadastro." }),
        {
          status: 500,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        },
      );
    }

    return new Response(JSON.stringify({ ok: true }), {
      status: 201,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch {
    return new Response(JSON.stringify({ error: "Corpo da requisição inválido." }), {
      status: 400,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
