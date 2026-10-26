import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "./cors.ts";

export function molicarAdminClient() {
  return createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
  );
}

export async function molicarAuthedUser(req: Request) {
  const authorization = req.headers.get("Authorization") || "";
  const client = createClient(
    Deno.env.get("SUPABASE_URL")!,
    Deno.env.get("SUPABASE_ANON_KEY")!,
    { global: { headers: { Authorization: authorization } } },
  );
  const { data: { user } } = await client.auth.getUser();
  return user;
}

export function isMolicarServiceRequest(req: Request): boolean {
  const expectedRole = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") || "";
  const expectedCron = Deno.env.get("MOLICAR_CRON_SECRET") || "";
  const bearer = (req.headers.get("Authorization") || "").replace(
    /^Bearer\s+/i,
    "",
  );
  const cron = req.headers.get("x-cron-secret") || "";
  return (!!expectedRole && bearer === expectedRole) ||
    (!!expectedCron && cron === expectedCron);
}

export function molicarJson(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

export function molicarOptions() {
  return new Response(null, { headers: corsHeaders });
}

export function molicarErrorStatus(error: unknown): number {
  const status = Number((error as { status?: number })?.status);
  if (status === 401 || status === 429) return status;
  const message = (error as Error)?.message || "";
  if (/quota|limite mensal/i.test(message)) return 429;
  if (/não autenticado|não autorizado/i.test(message)) return 401;
  return 422;
}
