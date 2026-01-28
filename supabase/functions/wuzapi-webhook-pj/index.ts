import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const LOCAWEB_WUZAPI_URL = Deno.env.get("WUZAPI_URL") || "https://wuzapi.amzofertas.com.br";
const LOCAWEB_WUZAPI_TOKEN = Deno.env.get("WUZAPI_TOKEN") || "";
const GEMINI_API_KEY = Deno.env.get("GEMINI_API_KEY") || "";

// Função para gerar resposta com IA
async function gerarRespostaIA(
  mensagemUsuario: string,
  historicoConversa: string,
  nomeAssistente: string,
  personalidade: string
): Promise<string> {
  const systemPrompt = `Você é ${nomeAssistente}, um assistente virtual ${personalidade}.

REGRAS:
- Seja sempre educado e profissional
- Responda de forma objetiva e útil
- Nunca invente informações
- Se não souber algo, diga que vai verificar
- Use emojis com moderação
- Mantenha respostas curtas (máximo 3 parágrafos)
- Nunca use palavras como "cansada", "cansado", "cansou" - substitua por "ocupada", "parou"

HISTÓRICO DA CONVERSA:
${historicoConversa}`;

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-lite:generateContent?key=${GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          contents: [
            { role: "user", parts: [{ text: systemPrompt }] },
            { role: "user", parts: [{ text: mensagemUsuario }] },
          ],
          generationConfig: {
            temperature: 0.7,
            maxOutputTokens: 500,
          },
        }),
      }
    );

    const data = await response.json();
    const resposta = data?.candidates?.[0]?.content?.parts?.[0]?.text || "";

    // Filtro de palavras proibidas
    return resposta
      .replace(/cansad[ao]/gi, "ocupad$1")
      .replace(/cansou/gi, "parou");

  } catch (error) {
    console.error("❌ Erro na IA:", error);
    return "Desculpe, estou com dificuldades no momento. Posso ajudar em algo mais? 😊";
  }
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("📨 [PJ-WEBHOOK] Recebido:", JSON.stringify(body).substring(0, 200));

    // Extrair dados da mensagem
    const messageData = body?.data || body;
    const phone = messageData?.Info?.Sender || messageData?.from || messageData?.phone || "";
    const messageText = messageData?.Message?.Conversation || 
                       messageData?.Message?.ExtendedTextMessage?.Text ||
                       messageData?.message?.conversation ||
                       messageData?.text || "";
    const messageId = messageData?.Info?.Id || messageData?.id || "";
    const isFromMe = messageData?.Info?.IsFromMe || messageData?.fromMe || false;
    const isGroup = phone?.includes("@g.us") || false;

    // Ignorar mensagens próprias e de grupos
    if (isFromMe || isGroup || !phone || !messageText) {
      console.log("⏭️ [PJ-WEBHOOK] Ignorando:", { isFromMe, isGroup, hasPhone: !!phone, hasText: !!messageText });
      return new Response(
        JSON.stringify({ success: true, ignored: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const cleanPhone = phone.replace(/\D/g, "").replace("@s.whatsapp.net", "");
    console.log(`📱 [PJ-WEBHOOK] Mensagem de ${cleanPhone}: ${messageText.substring(0, 50)}...`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Deduplicação
    const { data: existing } = await supabase
      .from("pj_webhook_dedup")
      .select("id")
      .eq("message_id", messageId)
      .maybeSingle();

    if (existing) {
      console.log("⏭️ [PJ-WEBHOOK] Mensagem duplicada, ignorando");
      return new Response(
        JSON.stringify({ success: true, duplicate: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Registrar dedup
    await supabase.from("pj_webhook_dedup").insert({ message_id: messageId });

    // Salvar mensagem do usuário
    await supabase.from("pj_conversas").insert({
      phone: cleanPhone,
      role: "user",
      content: messageText,
    });

    // Buscar histórico de conversa
    const { data: historico } = await supabase
      .from("pj_conversas")
      .select("role, content")
      .eq("phone", cleanPhone)
      .order("created_at", { ascending: false })
      .limit(10);

    const historicoFormatado = (historico || [])
      .reverse()
      .map((h) => `${h.role === "user" ? "Cliente" : "Assistente"}: ${h.content}`)
      .join("\n");

    // Buscar configuração do assistente (usar a primeira config ativa)
    const { data: aiConfig } = await supabase
      .from("pj_ai_config")
      .select("*")
      .eq("ativo", true)
      .limit(1)
      .maybeSingle();

    const nomeAssistente = aiConfig?.nome_assistente || "Assistente Virtual";
    const personalidade = aiConfig?.personalidade || "profissional e prestativo";

    // Gerar resposta com IA
    const resposta = await gerarRespostaIA(
      messageText,
      historicoFormatado,
      nomeAssistente,
      personalidade
    );

    console.log(`🤖 [PJ-WEBHOOK] Resposta gerada: ${resposta.substring(0, 50)}...`);

    // Salvar resposta
    await supabase.from("pj_conversas").insert({
      phone: cleanPhone,
      role: "assistant",
      content: resposta,
    });

    // Adicionar à fila anti-bloqueio
    await supabase.from("fila_atendimento_pj").insert({
      phone: cleanPhone,
      mensagem: resposta,
      tipo: "texto",
      prioridade: 1, // Alta prioridade para respostas de IA
      status: "pendente",
    });

    console.log(`📬 [PJ-WEBHOOK] Resposta adicionada à fila para ${cleanPhone}`);

    return new Response(
      JSON.stringify({
        success: true,
        phone: cleanPhone,
        responseQueued: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [PJ-WEBHOOK] Erro:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
