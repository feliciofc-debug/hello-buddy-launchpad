import { serve } from "https://deno.land/std@0.190.0/http/server.ts"
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.45.0'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { leadId } = await req.json()

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: lead } = await supabase
      .from('leads_b2c')
      .select('*')
      .eq('id', leadId)
      .maybeSingle()

    if (!lead) throw new Error('Lead não encontrado')

    // Templates baseados em score e profissão
    let mensagem = ''

    if (lead.profissao === 'médico') {
      if (lead.score >= 80) {
        // Lead QUENTE
        mensagem = `Oi Dr(a). ${lead.nome_completo?.split(' ')[1] || lead.nome_completo}! 👨‍⚕️

Vi que você é ${lead.especialidade || 'médico'} em ${lead.cidade || lead.uf}${lead.tem_consultorio ? ' e tem consultório próprio' : ''}. 

Ajudamos médicos como você a:
✅ Automatizar agenda
✅ Captar mais pacientes
✅ Marketing digital profissional

Quer conhecer? 😊`
      } else if (lead.score >= 50) {
        // Lead MORNO
        mensagem = `Olá Dr(a). ${lead.nome_completo?.split(' ')[1] || lead.nome_completo}! 

Sou da AMZ Ofertas e ajudamos médicos em ${lead.uf} a ter mais presença digital e atrair pacientes.

Posso te mostrar como funciona? 📱`
      } else {
        // Lead FRIO
        mensagem = `Olá! Temos uma plataforma para médicos que automatiza marketing e captação de pacientes.

Tem interesse em conhecer?`
      }
    } else if (lead.profissao === 'advogado') {
      if (lead.score >= 80) {
        mensagem = `Oi Dr(a). ${lead.nome_completo?.split(' ')[1] || lead.nome_completo}! ⚖️

Vi que você atua em ${lead.cidade || lead.uf}${lead.oab ? ` (OAB ${lead.oab})` : ''}.

Ajudamos advogados a captar clientes online de forma profissional e ética.

Te interessa? 💼`
      } else {
        mensagem = `Olá! Somos especializados em marketing digital para advogados.

Quer saber como podemos ajudar seu escritório?`
      }
    } else {
      // Genérico
      mensagem = `Olá ${lead.nome_completo?.split(' ')[0] || 'amigo(a)'}!

Ajudamos profissionais como você a ter mais presença digital.

Posso te mostrar nossa solução? 🚀`
    }

    // Salvar mensagem gerada
    await supabase
      .from('leads_b2c')
      .update({
        dados_enriquecidos: {
          ...lead.dados_enriquecidos,
          mensagem_gerada: mensagem,
          gerada_em: new Date().toISOString()
        }
      })
      .eq('id', leadId)

    return new Response(JSON.stringify({ 
      success: true,
      mensagem
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
