// ============================================================
// EXTRAIR IDENTIDADE DO SITE (Camada A: HTML/CSS, sem IA).
// Entrada: { url }. Saída: identidade para a tela de confirmação.
// Nunca salva nada — quem salva é o usuário depois de aprovar.
// ============================================================

import { corsHeaders } from "../_shared/cors.ts";
import { lerIdentidadeDoSite } from "../_shared/site-identidade.ts";

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const { url } = await req.json();
    if (!url || typeof url !== "string" || url.trim().length < 4) {
      return new Response(JSON.stringify({ success: false, error: "Informe o endereço do site." }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const identidade = await lerIdentidadeDoSite(url);
    return new Response(JSON.stringify({ success: true, identidade }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    return new Response(
      JSON.stringify({ success: false, error: (e as Error)?.message || "Falha ao ler o site." }),
      { status: 200, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});
