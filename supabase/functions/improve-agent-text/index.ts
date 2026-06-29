// Edge function: melhora/enriquece textos do formulário do agente via Gemini Flash.
// Recebe { field, text, context? } e retorna { improved }.
import "https://deno.land/x/xhr@0.1.0/mod.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const FIELD_INSTRUCTIONS: Record<string, string> = {
  agent_name: "Sugira um nome curto e profissional para o agente (1-3 palavras). Retorne só o nome.",
  persona: "Reescreva a persona do agente de IA de forma clara, profissional e empática, em 2-4 frases. Mantenha a essência do que o usuário escreveu, mas enriqueça com tom e postura. Sem listas, sem markdown.",
  greeting: "Reescreva a saudação inicial do agente para WhatsApp: amigável, curta (1-2 linhas), com 1 emoji no máximo. Sem markdown.",
  tone: "Resuma em 1 frase curta o tom de voz do atendimento (ex: 'descontraído e próximo, mas profissional').",
  knowledge_base: "Organize as informações do negócio (o que vende, horários, diferenciais, FAQ) em texto fluido e bem estruturado em parágrafos curtos. Mantenha TODAS as informações do usuário, apenas reorganize e enriqueça. Sem markdown, sem listas com bullets.",
  handoff_rules: "Reescreva de forma clara em quais situações o agente deve transferir para um humano. Texto direto, 2-4 frases.",
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { field, text, context } = await req.json();
    if (!text || typeof text !== "string" || !text.trim()) {
      return new Response(JSON.stringify({ error: "Texto vazio" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const instruction = FIELD_INSTRUCTIONS[field] ?? "Reescreva o texto deixando-o mais claro e profissional, preservando o sentido.";
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) {
      return new Response(JSON.stringify({ error: "LOVABLE_API_KEY ausente" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const systemMsg = `Você ajuda donos de negócio a melhorar textos de configuração de um agente de IA no WhatsApp. ${instruction} Responda APENAS com o texto final, sem prefácios, sem aspas, sem markdown.`;
    const userMsg = context
      ? `Contexto do negócio: ${context}\n\nTexto do usuário:\n${text}`
      : `Texto do usuário:\n${text}`;

    const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${LOVABLE_API_KEY}`,
      },
      body: JSON.stringify({
        model: "google/gemini-2.5-flash",
        messages: [
          { role: "system", content: systemMsg },
          { role: "user", content: userMsg },
        ],
      }),
    });

    if (!resp.ok) {
      const errText = await resp.text();
      console.error("Gateway error", resp.status, errText);
      const status = resp.status === 429 ? 429 : resp.status === 402 ? 402 : 500;
      return new Response(
        JSON.stringify({ error: status === 429 ? "Limite de uso atingido, tente em instantes." : status === 402 ? "Créditos de IA esgotados." : "Falha ao gerar melhoria." }),
        { status, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await resp.json();
    const improved = data?.choices?.[0]?.message?.content?.trim() ?? "";
    return new Response(JSON.stringify({ improved }), {
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (err) {
    console.error("improve-agent-text error", err);
    return new Response(JSON.stringify({ error: String(err) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
