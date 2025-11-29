import { serve } from "https://deno.land/std@0.190.0/http/server.ts";
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { leadId, leadTipo, strategy, tipo_abordagem } = await req.json();

    console.log("[GERAR-MSG-IA] Lead:", leadId, "Tipo:", leadTipo);

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    // Buscar lead
    const tabela = leadTipo === 'b2b' ? 'leads_b2b' : 'leads_b2c';
    const { data: lead } = await supabase
      .from(tabela)
      .select('*')
      .eq('id', leadId)
      .maybeSingle();

    if (!lead) throw new Error('Lead não encontrado');

    let mensagem = '';

    // Se tiver estratégia da IA, usar Lovable AI para gerar mensagem personalizada
    if (strategy && tipo_abordagem === 'ativa_comercial') {
      const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY');
      
      if (LOVABLE_API_KEY) {
        const prompt = `Você é um vendedor consultivo especializado em ${lead.profissao || 'negócios'}.

PERFIL DO LEAD:
- Nome: ${lead.nome_completo || lead.razao_social || 'Cliente'}
- Profissão: ${lead.profissao || lead.setor || 'Profissional'}
- Especialidade: ${lead.especialidade || 'Geral'}
- Cidade: ${lead.cidade || 'Brasil'}/${lead.estado || ''}

ESTRATÉGIA DE ABORDAGEM:
- Perfil: ${strategy.perfil_comportamental || 'Profissional qualificado'}
- Dores: ${(strategy.dores_identificadas || []).join(', ') || 'Não identificadas'}
- Tom: ${strategy.tom_mensagem || 'informal'}
- CTA: ${strategy.call_to_action || 'Agendar conversa'}

CRIE uma mensagem de WhatsApp que:
1. Seja ULTRA PERSONALIZADA (use nome, especialidade, cidade)
2. Gere CURIOSIDADE e URGÊNCIA
3. Ofereça VALOR IMEDIATO
4. Tenha CTA claro
5. Máximo 4 linhas, bem curta e direta
6. Use 1-2 emojis, não mais

NÃO seja genérico. Use dados reais do perfil.

Retorne APENAS o texto da mensagem, sem aspas ou formatação.`;

        const response = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${LOVABLE_API_KEY}`,
            "Content-Type": "application/json",
          },
          body: JSON.stringify({
            model: "google/gemini-2.5-flash",
            messages: [
              { role: "system", content: "Você é um vendedor consultivo expert. Escreva mensagens curtas, diretas e humanizadas. Sem formalidades excessivas." },
              { role: "user", content: prompt }
            ],
            max_tokens: 300,
            temperature: 0.8,
          }),
        });

        if (response.ok) {
          const data = await response.json();
          mensagem = data.choices?.[0]?.message?.content?.trim() || '';
          console.log("[GERAR-MSG-IA] Mensagem gerada via IA:", mensagem);
        }
      }
    }

    // Fallback: Templates baseados em score e profissão
    if (!mensagem) {
      const nome = lead.nome_completo || lead.razao_social || 'Cliente';
      const primeiroNome = nome.split(' ')[0];
      
      if (lead.profissao === 'médico' || lead.profissao?.toLowerCase().includes('médic')) {
        if (lead.score >= 80) {
          mensagem = `Oi Dr(a). ${primeiroNome}! 👨‍⚕️

Vi que você é ${lead.especialidade || 'médico'} em ${lead.cidade || lead.estado}${lead.tem_consultorio ? ' e tem consultório próprio' : ''}. 

Ajudamos médicos como você a:
✅ Automatizar agenda
✅ Captar mais pacientes
✅ Marketing digital profissional

Quer conhecer? 😊`;
        } else if (lead.score >= 50) {
          mensagem = `Olá Dr(a). ${primeiroNome}! 

Sou da AMZ Ofertas e ajudamos médicos em ${lead.estado || 'sua região'} a ter mais presença digital e atrair pacientes.

Posso te mostrar como funciona? 📱`;
        } else {
          mensagem = `Olá! Temos uma plataforma para médicos que automatiza marketing e captação de pacientes.

Tem interesse em conhecer?`;
        }
      } else if (lead.profissao === 'advogado' || lead.profissao?.toLowerCase().includes('advog')) {
        if (lead.score >= 80) {
          mensagem = `Oi Dr(a). ${primeiroNome}! ⚖️

Vi que você atua em ${lead.cidade || lead.estado}${lead.oab ? ` (OAB ${lead.oab})` : ''}.

Ajudamos advogados a captar clientes online de forma profissional e ética.

Te interessa? 💼`;
        } else {
          mensagem = `Olá! Somos especializados em marketing digital para advogados.

Quer saber como podemos ajudar seu escritório?`;
        }
      } else {
        // Genérico
        mensagem = `Olá ${primeiroNome}!

Ajudamos profissionais como você a ter mais presença digital e captar clientes.

Posso te mostrar nossa solução? 🚀`;
      }
    }

    // Salvar mensagem gerada no lead
    await supabase
      .from(tabela)
      .update({
        dados_enriquecidos: {
          ...(lead.dados_enriquecidos || {}),
          mensagem_gerada: mensagem,
          strategy_used: strategy,
          gerada_em: new Date().toISOString()
        },
        mensagem_selecionada: mensagem
      })
      .eq('id', leadId);

    console.log("[GERAR-MSG-IA] Mensagem final:", mensagem.substring(0, 50) + "...");

    return new Response(JSON.stringify({ 
      success: true,
      texto: mensagem,
      mensagem,
      strategy_used: strategy
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error) {
    console.error("[GERAR-MSG-IA] Erro:", error);
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido';
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
