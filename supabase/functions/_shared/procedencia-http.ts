import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "./cors.ts";

export async function procedenciaAuthedUser(req: Request) {
  const authHeader = req.headers.get("Authorization") || "";
  const supabase = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authHeader } } },
  );
  const { data: { user } } = await supabase.auth.getUser();
  return { user, authHeader };
}

export function procedenciaAdminClient() {
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

export function maskEmailForDisplay(email: string): string {
  const e = String(email || "").trim();
  const at = e.indexOf("@");
  if (at <= 1) return "••••";
  return `${e.slice(0, 1)}••••@${e.slice(at + 1)}`;
}
