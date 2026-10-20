import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { corsHeaders } from "../_shared/cors.ts";
import {
  runOlxVehicleSyncBatch,
  runOlxVehicleSyncOne,
} from "../_shared/olx-vehicle-sync-run.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  try {
    const auth = req.headers.get("Authorization") ?? "";
    const SERVICE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const isService = auth === `Bearer ${SERVICE_KEY}`;

    const body = await req.json().catch(() => ({}));
    const veiculoId = body?.veiculo_id != null ? String(body.veiculo_id) : "";

    if (!isService) {
      const supabase = createClient(
        Deno.env.get("SUPABASE_URL")!,
        Deno.env.get("SUPABASE_ANON_KEY")!,
        { global: { headers: { Authorization: auth } } },
      );
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        return new Response(JSON.stringify({ success: false, error: "Não autenticado" }), {
          status: 401,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      if (!veiculoId) {
        return new Response(JSON.stringify({ success: false, error: "veiculo_id obrigatório" }), {
          status: 400,
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      const admin = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY, {
        auth: { persistSession: false },
      });
      const result = await runOlxVehicleSyncOne(admin, user.id, veiculoId);
      return new Response(JSON.stringify({ success: result.ok, ...result }), {
        status: result.ok ? 200 : 422,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const sb = createClient(Deno.env.get("SUPABASE_URL")!, SERVICE_KEY, {
      auth: { persistSession: false },
    });
    const result = await runOlxVehicleSyncBatch(sb);
    return new Response(JSON.stringify({ ok: true, ...result }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(JSON.stringify({ ok: false, error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
