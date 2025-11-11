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

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    const { socio_id } = await req.json()

    if (!socio_id) {
      throw new Error('socio_id is required')
    }

    console.log(`🤖 Qualifying prospect: ${socio_id}`)

    // Fetch complete prospect data
    const { data: socio, error: socioError } = await supabaseClient
      .from('socios')
      .select(`
        *,
        empresa:empresas(*),
        enrichment:socios_enriquecidos(*)
      `)
      .eq('id', socio_id)
      .single()

    if (socioError || !socio) throw new Error('Socio not found')

    // Build AI prompt
    const prompt = `You are an expert lead qualifier for luxury car dealerships (Porsche, BMW, Mercedes).

Analyze this prospect and assign a score from 0-100:

PROSPECT DATA:
Name: ${socio.nome}
Position: ${socio.qualificacao}
Company: ${socio.empresa.nome_fantasia}
Company Sector: ${socio.empresa.descricao_cnae || 'N/A'}
Company Capital: R$ ${socio.empresa.capital_social?.toLocaleString('pt-BR')}
Ownership: ${socio.participacao_capital}%
Estimated Wealth: R$ ${socio.patrimonio_estimado?.toLocaleString('pt-BR')}
Location: ${socio.empresa.municipio}, ${socio.empresa.uf}

ENRICHMENT DATA:
LinkedIn: ${socio.enrichment?.linkedin_url || 'Not found'}
LinkedIn Bio: ${socio.enrichment?.linkedin_snippet || 'N/A'}
Instagram: @${socio.enrichment?.instagram_username || 'Not found'}

Recent News (last 12 months):
${socio.enrichment?.news_mentions?.map((n: any) => `- ${n.titulo}`).join('\n') || 'No mentions'}

Government Contracts:
${socio.enrichment?.diario_oficial?.map((d: any) => `- ${d.titulo}`).join('\n') || 'None'}

SCORING CRITERIA:

1. PODER AQUISITIVO (0-25 points):
   - Estimated wealth > R$ 10M: 25 points
   - R$ 5M - R$ 10M: 20 points
   - R$ 2M - R$ 5M: 15 points
   - R$ 1M - R$ 2M: 10 points
   - < R$ 1M: 5 points

2. MOMENTO CERTO (0-25 points):
   - Recent promotion/achievement: +10
   - Company won large contract: +10
   - Recent positive news mentions: +5
   - Company capital increase: +5
   - Industry expansion: +5

3. FIT COM PRODUTO (0-25 points):
   - C-level executive: 25 points
   - Director: 20 points
   - Manager: 15 points
   - High-growth industry (tech, finance): +5
   - Major city location: +5

4. SINAIS DE COMPRA (0-25 points):
   - LinkedIn mentions cars/luxury: +10
   - Instagram shows luxury lifestyle: +10
   - Recent major purchase indicator: +5
   - Competitor interaction: +5

RESPONSE FORMAT (JSON only, no markdown):
{
  "score": 85,
  "breakdown": {
    "poder_aquisitivo": 23,
    "momento_certo": 21,
    "fit_produto": 22,
    "sinais_compra": 19
  },
  "justificativa": "High-net-worth CEO with recent company growth and strong buying signals...",
  "insights": [
    "Company received R$ 50M investment",
    "Executive profile matches ideal buyer",
    "Located near dealership"
  ],
  "recomendacao": "contatar_agora"
}

RECOMMENDATIONS:
- "contatar_agora": Score 80-100 (hot lead)
- "aguardar": Score 60-79 (warm lead)
- "descartar": Score <60 (not qualified)

Analyze carefully and provide accurate scoring.`

    // Call Lovable AI (uses built-in LOVABLE_API_KEY)
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    
    if (!LOVABLE_API_KEY) {
      throw new Error('LOVABLE_API_KEY not configured')
    }

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [
          { role: 'user', content: prompt }
        ],
      }),
    })

    if (!aiResponse.ok) {
      if (aiResponse.status === 429) {
        throw new Error('Rate limit exceeded. Please try again later.')
      }
      if (aiResponse.status === 402) {
        throw new Error('AI credits depleted. Please add credits to continue.')
      }
      throw new Error(`Lovable AI error: ${aiResponse.status}`)
    }

    const aiData = await aiResponse.json()
    const resultText = aiData.choices[0].message.content

    // Parse JSON response
    const cleanedText = resultText
      .replace(/```json\n?/g, '')
      .replace(/```\n?/g, '')
      .trim()

    const analysis = JSON.parse(cleanedText)

    // Save qualification
    const { data: qualified, error: qualifyError } = await supabaseClient
      .from('prospects_qualificados')
      .upsert({
        socio_id,
        concessionaria_id: socio.empresa.concessionaria_id,
        score: analysis.score,
        breakdown: analysis.breakdown,
        justificativa: analysis.justificativa,
        insights: analysis.insights,
        recomendacao: analysis.recomendacao,
      })
      .select()
      .single()

    if (qualifyError) throw qualifyError

    // Update queue
    await supabaseClient
      .from('qualification_queue')
      .update({ status: 'completed', processado_em: new Date().toISOString() })
      .eq('socio_id', socio_id)

    console.log(`✅ Qualified: ${socio.nome} - Score: ${analysis.score}`)

    return new Response(
      JSON.stringify({ success: true, qualification: qualified }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ error: error instanceof Error ? error.message : 'Unknown error' }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
