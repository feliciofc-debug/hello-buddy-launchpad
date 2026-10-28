import { createClient } from "https://esm.sh/@supabase/supabase-js@2.45.0";
import { ensureJarvisCartilhaPdf } from "../_shared/jarvis-cartilha-pdf.ts";
import { JARVIS_AJUDA_CATALOGO_VERSAO } from "../_shared/jarvis-ajuda-catalogo.ts";

const cors = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers":
    "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: cors });
  try {
    const url = Deno.env.get("SUPABASE_URL")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const anon = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, {
      auth: { persistSession: false },
      global: { headers: { Authorization: authHeader } },
    });
    const { data: { user } } = await anon.auth.getUser();
    if (!user) throw new Error("Não autenticado");

    const sb = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!, {
      auth: { persistSession: false },
    });
    const result = await ensureJarvisCartilhaPdf(sb, user.id);
    return new Response(
      JSON.stringify({
        success: true,
        url: result.url,
        versao: JARVIS_AJUDA_CATALOGO_VERSAO,
        reused: result.reused,
      }),
      {
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  } catch (error) {
    console.warn(
      "[jarvis-cartilha-pdf]",
      error instanceof Error ? error.message : error,
    );
    return new Response(
      JSON.stringify({
        success: false,
        error: "Não foi possível gerar a cartilha",
      }),
      {
        status: 400,
        headers: { ...cors, "Content-Type": "application/json" },
      },
    );
  }
});
