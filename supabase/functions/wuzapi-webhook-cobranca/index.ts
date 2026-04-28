// =====================================================
// WUZAPI WEBHOOK COBRANÇA - Pietro Cobrador Conversacional
// Clone enxuto do wuzapi-webhook-pj, focado em cobrança.
// Diferenças vs PJ:
//  1. Tabela conversas: cobranca_conversas (não pj_conversas)
//  2. Dedup: cobranca_webhook_dedup
//  3. Resolve cliente em billing_customers (por phone) e dívida em billing_subscriptions
//  4. System prompt = Pietro Cobrador (cordial, foco em pagamento, regra 11)
//  5. Fila: insere em fila_atendimento_pj com wuzapi_url=pietro-cobranca (porta 8082)
//  6. Sem catálogo de produtos, sem TTS, sem transcrição de áudio
// =====================================================

import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.75.0";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface ConversationMessage {
  role: 'user' | 'assistant';
  content: string;
}

// ============================================
// SYSTEM PROMPT - PIETRO COBRADOR
// ============================================
function buildCobradorPrompt(
  clienteNome: string | null,
  valorDivida: number | null,
  diaVencimento: number | null,
  paymentLink: string | null,
  status: string | null,
  historicoFormatado: string
): string {
  const valorFmt = valorDivida ? `R$ ${valorDivida.toFixed(2).replace('.', ',')}` : 'valor a confirmar';
  const diaFmt = diaVencimento ? `dia ${diaVencimento}` : 'data a confirmar';
  const linkFmt = paymentLink || '(link de pagamento ainda não cadastrado — me avisa que organizo aqui)';
  const nomeFmt = clienteNome || 'amigo(a)';
  const statusFmt = status || 'desconhecido';

  return `Você é Pietro Eugênio, consultor financeiro humanizado da AMZ Ofertas.
Seu papel é conversar com clientes sobre suas mensalidades de forma cordial, próxima e empática — JAMAIS agressiva.

═══════════════════════════════════════════════════
DADOS DO CLIENTE
═══════════════════════════════════════════════════
- Nome: ${nomeFmt}
- Valor mensal: ${valorFmt}
- Vencimento: ${diaFmt} de cada mês
- Status atual: ${statusFmt}
- Link de pagamento: ${linkFmt}

═══════════════════════════════════════════════════
TOM DE VOZ
═══════════════════════════════════════════════════
- Cordial, próximo, humano (como um amigo que cobra com jeito)
- 1-2 emojis por mensagem (😊 🙏 ✨ 💚)
- Respostas CURTAS: 2-4 linhas no MÁXIMO
- Sem formalidade excessiva, mas sempre respeitoso
- NUNCA agressivo, NUNCA ameaçador, NUNCA jurídico

═══════════════════════════════════════════════════
REGRAS DE OURO (1 a 11)
═══════════════════════════════════════════════════
1. Sempre se apresente como Pietro na primeira mensagem.
2. Trate o cliente pelo nome quando souber.
3. Se ele já pagou e está confirmando, AGRADEÇA com carinho — não cobre de novo.
4. Se ele pediu para parar/cancelar, NÃO insista — apenas reconheça e encerre educadamente.
5. Se ele perguntou o valor ou link, RESPONDA com o link acima.
6. Se ele pediu prazo, mostre flexibilidade ("claro, sem problema, qual data fica boa?").
7. Se ele reclamou do serviço, OUÇA primeiro — só depois mencione o pagamento.
8. NUNCA invente valor, data ou link. Use APENAS os dados acima.
9. Se o link estiver vazio, diga: "vou te enviar o link em instantes, ok?"
10. Em caso de dúvida séria (cancelamento, reembolso, problema técnico), diga: "vou passar pra equipe te dar o suporte certo, ok? 🙏"
11. Se o cliente perguntar algo que NÃO seja sobre cobrança/pagamento (clima, futebol, vida pessoal, etc.), responda brevemente de forma simpática mas SEMPRE traga de volta ao assunto pagamento de forma natural. Ex: "Hahaha verdade! 😄 E aproveitando, sobre a mensalidade do dia ${diaFmt}, posso te ajudar?"

═══════════════════════════════════════════════════
HISTÓRICO DA CONVERSA
═══════════════════════════════════════════════════
${historicoFormatado || 'Início da conversa.'}`;
}

// ============================================
// GERAR RESPOSTA COM IA (LOVABLE AI GATEWAY)
// ============================================
async function generateAIResponse(
  userMessage: string,
  conversationHistory: ConversationMessage[],
  systemPrompt: string
): Promise<string> {
  const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');

  if (!LOVABLE_API_KEY) {
    console.error('❌ [COB-AI] LOVABLE_API_KEY não configurada!');
    return 'Oi! Aqui é o Pietro 😊 Como posso te ajudar?';
  }

  try {
    const messages = [
      { role: 'system', content: systemPrompt },
      ...conversationHistory.slice(-6).map(m => ({ role: m.role, content: m.content })),
      { role: 'user', content: userMessage }
    ];

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages,
        max_tokens: 400,
        temperature: 0.7
      })
    });

    if (!response.ok) {
      const errorText = await response.text();
      console.error('❌ [COB-AI] Erro API:', response.status, errorText);
      if (response.status === 429) {
        return 'Opa, me dá um segundinho aqui que já te respondo 😅';
      }
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    const aiMessage = data.choices?.[0]?.message?.content || '';
    console.log('🤖 [COB-AI] Resposta:', aiMessage.slice(0, 100));
    return aiMessage.trim() || 'Oi! Aqui é o Pietro 😊';

  } catch (error) {
    console.error('❌ [COB-AI] Erro:', error);
    return 'Oi! Aqui é o Pietro 😊 Como posso te ajudar?';
  }
}

// ============================================
// HISTÓRICO
// ============================================
async function getConversationHistory(supabase: any, phone: string): Promise<ConversationMessage[]> {
  const cleanPhone = phone.replace(/\D/g, '');
  const { data } = await supabase
    .from('cobranca_conversas')
    .select('role, content')
    .eq('phone', cleanPhone)
    .in('role', ['user', 'assistant'])
    .order('created_at', { ascending: false })
    .limit(10);

  if (!data) return [];
  return data.reverse();
}

// ============================================
// RESOLVER CLIENTE (billing_customers + billing_subscriptions)
// ============================================
async function resolveCustomer(supabase: any, phone: string) {
  const cleanPhone = phone.replace(/\D/g, '');
  // Busca por terminação (últimos 10/11 dígitos) — telefones podem variar com 55/9
  const last10 = cleanPhone.slice(-10);
  const last11 = cleanPhone.length >= 11 ? cleanPhone.slice(-11) : null;

  const { data: customers } = await supabase
    .from('billing_customers')
    .select('*')
    .or(
      [
        `phone.ilike.%${last10}`,
        last11 ? `phone.ilike.%${last11}` : null,
        `whatsapp.ilike.%${last10}`,
        last11 ? `whatsapp.ilike.%${last11}` : null,
      ].filter(Boolean).join(',')
    )
    .limit(1);

  const customer = customers?.[0] || null;
  if (!customer) {
    console.log(`👤 [COB-WEBHOOK] Cliente não encontrado para ${cleanPhone}`);
    return { customer: null, subscription: null };
  }

  const { data: subs } = await supabase
    .from('billing_subscriptions')
    .select('*')
    .eq('customer_id', customer.id)
    .order('created_at', { ascending: false })
    .limit(1);

  return { customer, subscription: subs?.[0] || null };
}

// ============================================
// FILA: enviar resposta via pietro-cobranca (porta 8082)
// ============================================
async function inserirNaFilaCobranca(
  supabase: any,
  phone: string,
  message: string,
  wuzapiToken: string,
  wuzapiUrl: string,
  userId: string | null,
) {
  const cleanPhone = phone.replace(/\D/g, '');
  const formattedPhone = cleanPhone.startsWith('55') ? cleanPhone : '55' + cleanPhone;
  const delayMs = Math.floor(Math.random() * 4000) + 3000; // 3-7s
  const scheduledAt = new Date(Date.now() + delayMs);

  const { error } = await supabase
    .from('fila_atendimento_pj')
    .insert({
      lead_phone: formattedPhone,
      mensagem: message,
      tipo_mensagem: 'texto',
      prioridade: 1,
      status: 'pendente',
      wuzapi_token: wuzapiToken,
      wuzapi_url: wuzapiUrl,
      user_id: userId,
      scheduled_at: scheduledAt.toISOString(),
      lead_source: 'pietro_cobranca',
    });

  if (error) {
    console.error('❌ [COB-FILA] Erro:', error);
    return false;
  }
  console.log(`✅ [COB-FILA] Resposta agendada para ${formattedPhone} via ${wuzapiUrl}`);
  return true;
}

// ============================================
// SERVE
// ============================================
serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const body = await req.json();
    console.log("📨 [COB-WEBHOOK] Recebido:", JSON.stringify(body).substring(0, 1500));

    const envelope = body?.data || body;
    const eventType = envelope?.type || envelope?.event?.type || "";
    const messageData = envelope?.event || envelope;

    if (eventType && eventType !== "Message") {
      console.log("⏭️ [COB-WEBHOOK] Evento não-mensagem, ignorando:", eventType);
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: "non_message_event", eventType }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    const info = messageData?.Info || {};

    const candidateSenders: string[] = [
      info?.SenderAlt,
      (envelope as any)?.event?.Info?.SenderAlt,
      messageData?.SenderAlt,
      info?.Sender,
      info?.Chat,
      info?.RemoteJid,
      info?.RemoteJID,
      messageData?.Sender,
      messageData?.Chat,
      messageData?.from,
      messageData?.phone,
      (messageData as any)?.key?.remoteJid,
      (messageData as any)?.key?.participant,
    ].filter(Boolean);

    const msg = messageData?.Message || messageData?.message || {};
    const messageText =
      msg?.Conversation ||
      msg?.conversation ||
      msg?.ExtendedTextMessage?.Text ||
      msg?.extendedTextMessage?.text ||
      messageData?.body ||
      messageData?.text ||
      "";

    const messageId = info?.ID || info?.Id || messageData?.id || "";
    const isFromMe = info?.IsFromMe || messageData?.fromMe || false;

    const normalizeWaIdToDigits = (raw: string) => {
      if (!raw) return "";
      let s = String(raw);
      s = s.replace("@s.whatsapp.net", "").replace("@g.us", "").replace("@lid", "");
      if (s.includes(":")) s = s.split(":")[0];
      return s.replace(/\D/g, "");
    };

    const looksLikePhone = (digits: string) =>
      !!digits && digits.length >= 10 && digits.length <= 13;

    const bestCandidate =
      candidateSenders.find((c) => String(c).includes("@s.whatsapp.net")) ||
      candidateSenders.find((c) => looksLikePhone(normalizeWaIdToDigits(String(c)))) ||
      "";

    const cleanPhone = normalizeWaIdToDigits(bestCandidate);
    const senderInvalid = !looksLikePhone(cleanPhone);
    const isGroup = Boolean(info?.IsGroup) || String(bestCandidate).includes("@g.us");

    if (isFromMe || isGroup || senderInvalid || !messageText) {
      console.log("⏭️ [COB-WEBHOOK] Ignorando:", { isFromMe, isGroup, senderInvalid, hasText: !!messageText });
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: senderInvalid ? "invalid_sender" : "filtered" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    console.log(`📱 [COB-WEBHOOK] Mensagem de ${cleanPhone}: ${messageText.substring(0, 80)}`);

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Dedup
    if (messageId) {
      const { data: existing } = await supabase
        .from("cobranca_webhook_dedup")
        .select("id")
        .eq("message_id", messageId)
        .maybeSingle();
      if (existing) {
        console.log("⏭️ [COB-WEBHOOK] Duplicada");
        return new Response(JSON.stringify({ success: true, duplicate: true }), {
          headers: { ...corsHeaders, "Content-Type": "application/json" },
        });
      }
      await supabase.from("cobranca_webhook_dedup").insert({ message_id: messageId });
    }

    // Comando de parada
    const msgLowerTrim = messageText.trim().toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
    const STOP_COMMANDS = ['parar', 'pare', 'stop', 'chega', 'cancelar', 'nao quero mais', 'descadastrar', 'sair'];
    const isStopCommand = STOP_COMMANDS.some(cmd => msgLowerTrim === cmd || msgLowerTrim.includes(cmd));

    if (isStopCommand) {
      console.log(`🛑 [COB-WEBHOOK] STOP de ${cleanPhone}`);
      await supabase.from("cobranca_conversas").insert([
        { phone: cleanPhone, role: "user", content: messageText },
        { phone: cleanPhone, role: "system", content: "[CONVERSA PAUSADA - stop]" },
      ]);
      return new Response(
        JSON.stringify({ success: true, stopped: true }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Pausa ativa
    const { data: pauseCheck } = await supabase
      .from("cobranca_conversas")
      .select("id, created_at")
      .eq("phone", cleanPhone)
      .eq("role", "system")
      .ilike("content", "%CONVERSA PAUSADA%")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (pauseCheck) {
      const pausedAt = new Date(pauseCheck.created_at).getTime();
      const PAUSE_MS = 30 * 60 * 1000;
      if (Date.now() - pausedAt < PAUSE_MS) {
        console.log(`🛑 [COB-WEBHOOK] Conversa pausada para ${cleanPhone}`);
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: "paused" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Anti-loop
    const LOOP_WINDOW_MIN = 3;
    const LOOP_MAX = 6;
    const COOLDOWN_SEC = 30;
    const loopCutoff = new Date(Date.now() - LOOP_WINDOW_MIN * 60 * 1000).toISOString();
    const { count: recent } = await supabase
      .from("cobranca_conversas")
      .select("id", { count: "exact", head: true })
      .eq("phone", cleanPhone)
      .eq("role", "assistant")
      .gte("created_at", loopCutoff);

    if ((recent || 0) >= LOOP_MAX) {
      console.warn(`🔄🛑 [COB-WEBHOOK] LOOP! ${recent} msgs em ${LOOP_WINDOW_MIN}min`);
      await supabase.from("cobranca_conversas").insert({
        phone: cleanPhone, role: "system", content: "[LOOP DETECTADO - Pausa 30min]",
      });
      return new Response(
        JSON.stringify({ success: true, ignored: true, reason: "loop_detected" }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Cooldown
    const { data: lastAssistant } = await supabase
      .from("cobranca_conversas")
      .select("created_at")
      .eq("phone", cleanPhone)
      .eq("role", "assistant")
      .order("created_at", { ascending: false })
      .limit(1)
      .maybeSingle();

    if (lastAssistant) {
      const elapsed = (Date.now() - new Date(lastAssistant.created_at).getTime()) / 1000;
      if (elapsed < COOLDOWN_SEC) {
        console.log(`⏳ [COB-WEBHOOK] Cooldown ativo (${elapsed.toFixed(0)}s)`);
        return new Response(
          JSON.stringify({ success: true, ignored: true, reason: "cooldown" }),
          { headers: { ...corsHeaders, "Content-Type": "application/json" } }
        );
      }
    }

    // Resolver cliente
    const { customer, subscription } = await resolveCustomer(supabase, cleanPhone);

    // Salvar msg do usuário (com customer_id se identificado)
    await supabase.from("cobranca_conversas").insert({
      phone: cleanPhone,
      role: "user",
      content: messageText,
      customer_id: customer?.id || null,
    });

    // Histórico
    const conversationHistory = await getConversationHistory(supabase, cleanPhone);
    const historicoFormatado = conversationHistory
      .map((h) => `${h.role === "user" ? "Cliente" : "Pietro"}: ${h.content}`)
      .join("\n");

    // System prompt do cobrador
    const systemPrompt = buildCobradorPrompt(
      customer?.nome || customer?.name || null,
      subscription?.amount != null ? Number(subscription.amount) : null,
      subscription?.dia_vencimento ?? null,
      customer?.payment_link || null,
      subscription?.status || customer?.status || null,
      historicoFormatado,
    );

    console.log(`🧠 [COB-WEBHOOK] Gerando resposta IA para ${customer?.nome || cleanPhone}...`);
    const resposta = await generateAIResponse(messageText, conversationHistory, systemPrompt);

    // Buscar instância pietro-cobranca (porta 8082)
    const { data: instCob } = await supabase
      .from('wuzapi_instances')
      .select('wuzapi_url, wuzapi_token')
      .eq('instance_name', 'pietro-cobranca')
      .maybeSingle();

    const wuzapiUrl = instCob?.wuzapi_url || 'http://api2.amzofertas.com.br:8082';
    const wuzapiToken = instCob?.wuzapi_token;

    if (!wuzapiToken) {
      console.error("❌ [COB-WEBHOOK] Token pietro-cobranca não encontrado!");
      return new Response(
        JSON.stringify({ success: false, error: "pietro-cobranca token missing" }),
        { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
      );
    }

    // Salvar resposta no histórico
    await supabase.from("cobranca_conversas").insert({
      phone: cleanPhone,
      role: "assistant",
      content: resposta,
      customer_id: customer?.id || null,
    });

    // Inserir na fila (dispatcher já respeita wuzapi_url)
    await inserirNaFilaCobranca(supabase, cleanPhone, resposta, wuzapiToken, wuzapiUrl, customer?.user_id || null);

    return new Response(
      JSON.stringify({
        success: true,
        phone: cleanPhone,
        customerId: customer?.id || null,
        responseQueued: true,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );

  } catch (err: any) {
    console.error("❌ [COB-WEBHOOK] Erro:", err);
    return new Response(
      JSON.stringify({ success: false, error: err.message }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
