import { createClient } from "https://esm.sh/@supabase/supabase-js@2.49.1";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const { system, messages, ticket_id } = await req.json();

    if (!system || !ticket_id) {
      return new Response(JSON.stringify({ error: "Missing system or ticket_id" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Gather extra context from DB
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const sb = createClient(supabaseUrl, supabaseKey);

    // Get recent edge function health
    const { data: healthData } = await sb
      .from("edge_functions_health")
      .select("function_name, status, last_error, consecutive_failures")
      .order("function_name");

    // Get recent campaign execution logs (last 10)
    const { data: execLogs } = await sb
      .from("campaign_execution_logs")
      .select("log_type, message, error, created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    const extraContext = `
--- CONTEXTO DO SISTEMA (somente leitura) ---
Edge Functions Health: ${JSON.stringify(healthData || [])}
Últimos logs de execução: ${JSON.stringify(execLogs || [])}
---`;

    const fullPrompt = `${system}\n\n${extraContext}\n\nHistórico do chamado:\n${messages || "(vazio)"}`;

    // Call AI via Lovable Gateway
    const apiKey = Deno.env.get("LOVABLE_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiResponse = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: fullPrompt },
          { role: "user", content: "Analise o chamado acima e forneça um diagnóstico detalhado com sugestões de solução." },
        ],
        max_tokens: 1500,
      }),
    });

    if (!aiResponse.ok) {
      const errText = await aiResponse.text();
      console.error("AI Gateway error:", errText);
      return new Response(JSON.stringify({ error: "AI Gateway error", details: errText }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const aiData = await aiResponse.json();
    const responseText = aiData.choices?.[0]?.message?.content || "Sem resposta da IA";

    return new Response(JSON.stringify({ response: responseText }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("Error:", err);
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
