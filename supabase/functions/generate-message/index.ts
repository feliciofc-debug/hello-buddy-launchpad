import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('✍️ generate-message INICIADO (VERSÃO COMPLETA)')

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { prospect_id } = await req.json()
    if (!prospect_id) throw new Error('prospect_id required')

    console.log('📦 Buscando prospect:', prospect_id)

    // Buscar prospect COMPLETO
    const { data: prospect } = await supabaseClient
      .from('prospects_qualificados')
      .select('*, socio:socios(*, empresa:empresas(*))')
      .eq('id', prospect_id)
      .single()

    if (!prospect) throw new Error('Prospect not found')

    const socio = prospect.socio
    const empresa = socio.empresa
    const enrichment = socio.enrichment_data || {}

    console.log(`✍️ Gerando mensagens para: ${socio.nome}`)

    // Preparar contexto para a IA
    const contexto = `
PROSPECT:
Nome: ${socio.nome}
Cargo: ${socio.qualificacao}
Empresa: ${empresa.nome_fantasia || empresa.razao_social}
Capital Social: R$ ${(empresa.capital_social || 0).toLocaleString('pt-BR')}
Localização: ${empresa.endereco?.municipio || 'N/A'}, ${empresa.endereco?.uf || 'N/A'}

SCORE: ${prospect.score}/100
INSIGHTS: ${prospect.insights?.join(', ') || 'N/A'}

DADOS ENRIQUECIDOS:
LinkedIn: ${enrichment.linkedin_url || 'Não encontrado'}
${enrichment.linkedin_snippet ? `Bio LinkedIn: ${enrichment.linkedin_snippet}` : ''}
Instagram: ${enrichment.instagram_username ? `@${enrichment.instagram_username}` : 'Não encontrado'}

${enrichment.news_mentions && enrichment.news_mentions.length > 0 ? 
  `NOTÍCIAS RECENTES:\n${enrichment.news_mentions.map((n: any) => `- ${n.titulo}`).join('\n')}` : 
  'Sem notícias recentes'}
`.trim()

    const firstName = socio.nome.split(' ')[0]

    // Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

    if (!LOVABLE_API_KEY) {
      console.warn('⚠️ Lovable AI não disponível, usando templates simples')
      
      // Fallback sem IA
      const messages = {
        professional: `Oi ${firstName}!\n\nVi que você é ${socio.qualificacao} na ${empresa.nome_fantasia || empresa.razao_social}. Parabéns pela trajetória!\n\nTenho uma proposta que pode agregar valor ao seu negócio.\n\nPodemos agendar uma conversa?\n\nAbs,\nJoão - AMZ`,
        friendly: `E aí ${firstName}!\n\nAchei seu perfil da ${empresa.nome_fantasia || empresa.razao_social}!\n\nTenho algo interessante pra te mostrar.\n\nBora trocar uma ideia? 😊\n\nAbs,\nJoão`,
        enthusiast: `${firstName}! 🚀\n\nSua empresa ${empresa.nome_fantasia || empresa.razao_social} está no caminho certo!\n\nQuero te apresentar algo especial.\n\nTopa?\n\nAbs,\nJoão`,
        generated_at: new Date().toISOString()
      }

      await supabaseClient
        .from('prospects_qualificados')
        .update({ mensagens_geradas: messages })
        .eq('id', prospect_id)

      return new Response(
        JSON.stringify({ success: true, messages }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Helper: Gerar mensagem com Lovable AI
    const generateMessage = async (tone: string) => {
      const tonePrompts = {
        professional: 'Tom profissional e respeitoso. Mencione conquistas empresariais específicas se houver.',
        friendly: 'Tom amigável e conversacional. Foco em conexão pessoal e lifestyle.',
        enthusiast: 'Tom entusiasta e enérgico. Foco em paixão, inovação e crescimento.'
      }

      const prompt = `Você é um especialista em vendas B2B de alto valor.

${contexto}

TAREFA: Escreva uma mensagem WhatsApp para ${firstName} com tom ${tone}.

REGRAS:
1. Comece com "Oi ${firstName}!" (sempre informal mesmo no professional)
2. Mencione algo ESPECÍFICO sobre ele/empresa (dos dados acima)
3. 100-150 palavras em português brasileiro
4. Natural, conversacional - NÃO pareça spam ou robô
5. CTA suave (sugerir conversa/café/reunião)
6. Use 1-2 emojis no máximo
7. Assine com "João - AMZ" ou similar

TOM: ${tonePrompts[tone as keyof typeof tonePrompts]}

IMPORTANTE: Escreva APENAS o texto da mensagem, sem formatação markdown, sem aspas. Texto puro pronto para enviar no WhatsApp.`

      const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        },
        body: JSON.stringify({
          model: 'google/gemini-2.5-flash',
          messages: [
            {
              role: 'system',
              content: 'Você é um especialista em copywriting para WhatsApp B2B. Suas mensagens são personalizadas, naturais e geram alta taxa de resposta.'
            },
            {
              role: 'user',
              content: prompt
            }
          ],
          temperature: 0.8,
        }),
      })

      if (!response.ok) {
        throw new Error(`Lovable AI error: ${response.status}`)
      }

      const data = await response.json()
      return data.choices[0].message.content.trim()
    }

    console.log('🤖 Gerando 3 variações com Lovable AI...')
    
    const [professional, friendly, enthusiast] = await Promise.all([
      generateMessage('professional'),
      generateMessage('friendly'),
      generateMessage('enthusiast'),
    ])

    const messages = {
      professional,
      friendly,
      enthusiast,
      generated_at: new Date().toISOString()
    }

    console.log('💾 Salvando mensagens...')

    await supabaseClient
      .from('prospects_qualificados')
      .update({ mensagens_geradas: messages })
      .eq('id', prospect_id)

    console.log('✅ Mensagens geradas com sucesso!')

    return new Response(
      JSON.stringify({ success: true, messages, prospect: { nome: socio.nome, score: prospect.score } }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ ERRO:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})