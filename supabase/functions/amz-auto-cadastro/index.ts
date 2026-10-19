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

const RATE_LIMIT_PER_IP = 5;
const RATE_LIMIT_GLOBAL = 30;
const RATE_WINDOW_MS = 60 * 60 * 1000;
const MAX_BODY_BYTES = 10 * 1024;

function clientIp(req: Request): string | null {
  const realIp = req.headers.get("x-real-ip")?.trim();
  if (realIp) return realIp.slice(0, 64);

  const xff = req.headers.get("x-forwarded-for");
  if (xff) {
    const parts = xff.split(",").map((p) => p.trim()).filter(Boolean);
    const last = parts[parts.length - 1];
    if (last) return last.slice(0, 64);
  }

  return null;
}

async function readJsonBody(req: Request): Promise<
  | { ok: true; body: AmzAutoCadastroPayload }
  | { ok: false; status: number; error: string }
> {
  const contentLength = req.headers.get("content-length");
  if (contentLength) {
    const len = Number.parseInt(contentLength, 10);
    if (Number.isFinite(len) && len > MAX_BODY_BYTES) {
      return { ok: false, status: 413, error: "Corpo da requisição muito grande." };
    }
  }

  const raw = await req.text();
  if (raw.length > MAX_BODY_BYTES) {
    return { ok: false, status: 413, error: "Corpo da requisição muito grande." };
  }

  try {
    const body = JSON.parse(raw) as AmzAutoCadastroPayload;
    return { ok: true, body };
  } catch {
    return { ok: false, status: 400, error: "Corpo da requisição inválido." };
  }
}

async function countRecent(
  // deno-lint-ignore no-explicit-any
  supabase: any,
  since: string,
  ip: string | null,
): Promise<number | null> {
  let query = supabase
    .from("amz_auto_cadastros")
    .select("id", { count: "exact", head: true })
    .gte("created_at", since);

  if (ip) {
    query = query.eq("client_ip", ip);
  }

  const { count, error } = await query;
  if (error) return null;
  return count ?? 0;
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

  const parsedBody = await readJsonBody(req);
  if (!parsedBody.ok) {
    return new Response(JSON.stringify({ error: parsedBody.error }), {
      status: parsedBody.status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }

  const validated = validateAmzAutoCadastro(parsedBody.body);
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

  const since = new Date(Date.now() - RATE_WINDOW_MS).toISOString();
  const ip = clientIp(req);
  const limit = ip ? RATE_LIMIT_PER_IP : RATE_LIMIT_GLOBAL;
  const recentCount = await countRecent(supabase, since, ip);

  if (recentCount === null) {
    console.error("amz-auto-cadastro rate check failed");
    return new Response(
      JSON.stringify({ error: "Não foi possível processar o cadastro." }),
      {
        status: 503,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }

  if (recentCount >= limit) {
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
});
