import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
  setTenantLogo,
  TENANT_LOGO_BUCKET,
} from "../_shared/tenant-logo.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (request) => {
  if (request.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const authorization = request.headers.get("authorization") || "";
    const auth = createClient(url, anonKey, {
      global: { headers: { Authorization: authorization } },
    });
    const { data: authData, error: authError } = await auth.auth.getUser();
    if (authError || !authData.user) {
      return new Response(JSON.stringify({ error: "não autorizado" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    const userId = authData.user.id;
    const admin = createClient(url, serviceKey);
    const body = await request.json();

    if (body?.action === "remove") {
      const { data: logos, error } = await admin.from("tenant_logos")
        .select("storage_path")
        .eq("user_id", userId);
      if (error) throw error;
      const paths = (logos ?? [])
        .map((logo: { storage_path?: string }) => String(logo.storage_path || ""))
        .filter((path: string) => path.startsWith(`${userId}/`));
      const { error: deleteError } = await admin.from("tenant_logos").delete()
        .eq("user_id", userId);
      if (deleteError) throw deleteError;
      if (paths.length) {
        await admin.storage.from(TENANT_LOGO_BUCKET).remove(paths);
      }
      return new Response(JSON.stringify({ ok: true }), {
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const storagePath = String(body?.storage_path || "");
    const variant = body?.variant === "dark_background"
      ? "dark_background"
      : "default";
    if (!storagePath.startsWith(`${userId}/incoming/`)) {
      throw new Error("arquivo fora da pasta de entrada do tenant");
    }
    const ok = await setTenantLogo(admin, userId, {
      storagePath,
      fileName: String(body?.file_name || "").slice(0, 255) || null,
      mimeType: String(body?.mime_type || "").slice(0, 100) || null,
      variant,
    });
    if (!ok) throw new Error("não foi possível salvar a logo");
    const { data: logos, error } = await admin.from("tenant_logos")
      .select("id, storage_path, file_name, mime_type, variant, generated_automatically, background_warning")
      .eq("user_id", userId)
      .eq("ativo", true)
      .in("variant", ["default", "dark_background"]);
    if (error) throw error;
    return new Response(JSON.stringify({ ok: true, logos }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (error) {
    return new Response(
      JSON.stringify({
        error: error instanceof Error ? error.message : "erro desconhecido",
      }),
      {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      },
    );
  }
});
