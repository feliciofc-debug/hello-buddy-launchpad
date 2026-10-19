import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "./cors.ts";

export async function gestaoTrocaAuthedUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { user, authHeader };
}

export function gestaoTrocaAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function optionsResponse() {
  return new Response(null, { headers: corsHeaders });
}

export function parseFipePriceString(price: string): number | null {
  const digits = String(price || "").replace(/[^\d,]/g, "");
  if (!digits) return null;
  const normalized = digits.includes(",")
    ? digits.replace(/\./g, "").replace(",", ".")
    : digits;
  const n = Number(normalized);
  return Number.isFinite(n) ? Math.round(n * 100) / 100 : null;
}
