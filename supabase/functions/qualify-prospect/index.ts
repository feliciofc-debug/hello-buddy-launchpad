import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  console.log('🤖 qualify-prospect INICIADO (Lovable AI)')

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { socio_id } = await req.json()
    if (!socio_id) throw new Error('socio_id é obrigatório')

    console.log(`🤖 Buscando sócio: ${socio_id}`)

    // Buscar sócio completo
    const { data: socio, error: socioError } = await supabaseClient
      .from('socios')
      .select('*, empresa:empresas(*)')
      .eq('id', socio_id)
      .single()

    if (socioError || !socio) {
      throw new Error(`Erro ao buscar sócio: ${socioError?.message || 'Não encontrado'}`)
    }

    console.log(`✅ Sócio: ${socio.nome}`)

    const enrichment = socio.enrichment_data || {}
    const empresa = socio.empresa

    // CRITICAL: Verificar se há dados enriquecidos
    const temEnriquecimento = enrichment.linkedin_url || enrichment.instagram_username || 
                              (enrichment.news_mentions && enrichment.news_mentions.length > 0)
    
    if (!temEnriquecimento) {
      console.error('❌ Sem dados de enriquecimento. Qualificação impossível.')
      
      await supabaseClient
        .from('qualification_queue')
        .update({ 
          status: 'failed', 
          processed_at: new Date().toISOString(),
          error_message: 'Dados de enriquecimento insuficientes para qualificação'
        })
        .eq('socio_id', socio_id)

      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'Enriquecimento falhou. Não é possível qualificar sem dados das redes sociais.' 
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Get user_id from auth
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)
    
    if (!user) throw new Error('User not authenticated')

    // Preparar contexto para IA
    const contexto = `
PROSPECT:
Nome: ${socio.nome}
Cargo: ${socio.qualificacao}
Patrimônio Estimado: R$ ${(socio.patrimonio_estimado || 0).toLocaleString('pt-BR')}

EMPRESA:
Razão Social: ${empresa.razao_social}
Nome Fantasia: ${empresa.nome_fantasia || 'N/A'}
Capital Social: R$ ${(empresa.capital_social || 0).toLocaleString('pt-BR')}
Porte: ${empresa.porte || 'N/A'}
Localização: ${empresa.endereco?.municipio || 'N/A'}, ${empresa.endereco?.uf || 'N/A'}
Situação: ${empresa.situacao_cadastral || 'N/A'}

DADOS ENRIQUECIDOS:
LinkedIn: ${enrichment.linkedin_url || 'Não encontrado'}
${enrichment.linkedin_snippet ? `Bio: ${enrichment.linkedin_snippet}` : ''}
Instagram: ${enrichment.instagram_username ? `@${enrichment.instagram_username}` : 'Não encontrado'}

${enrichment.news_mentions && enrichment.news_mentions.length > 0 ? 
  `NOTÍCIAS RECENTES:\n${enrichment.news_mentions.map((n: any) => `- ${n.titulo}`).join('\n')}` : 
  'Sem notícias recentes'}
`.trim()

    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')

    if (!LOVABLE_API_KEY) {
      console.warn('⚠️ Lovable AI não disponível, usando cálculo simples')
      
      // Fallback simples
      let score = 60
      if (socio.patrimonio_estimado > 5000000) score += 20
      else if (socio.patrimonio_estimado > 1000000) score += 10
      const cargo = (socio.qualificacao || '').toLowerCase()
      if (cargo.includes('administrador') || cargo.includes('diretor')) score += 15
      if (empresa.capital_social > 1000000) score += 5
      score = Math.min(100, Math.max(0, score))

      const qualificationData = {
        socio_id,
        score,
        justificativa: `${socio.qualificacao} na ${empresa.nome_fantasia || empresa.razao_social}. Capital social de R$ ${(empresa.capital_social || 0).toLocaleString('pt-BR')}.`,
        insights: [
          `Cargo: ${socio.qualificacao}`,
          `Empresa: ${empresa.nome_fantasia || empresa.razao_social}`,
          `Capital: R$ ${(empresa.capital_social || 0).toLocaleString('pt-BR')}`
        ]
      }

      const { data: existing } = await supabaseClient
        .from('prospects_qualificados')
        .select('id')
        .eq('socio_id', socio_id)
        .maybeSingle()

      let qualified
      if (existing) {
        const { data } = await supabaseClient
          .from('prospects_qualificados')
          .update(qualificationData)
          .eq('id', existing.id)
          .select()
          .single()
        qualified = data
      } else {
        const { data } = await supabaseClient
          .from('prospects_qualificados')
          .insert({ ...qualificationData, user_id: user.id })
          .select()
          .single()
        qualified = data
      }

      await supabaseClient
        .from('qualification_queue')
        .update({ status: 'completed', processed_at: new Date().toISOString() })
        .eq('socio_id', socio_id)

      return new Response(
        JSON.stringify({ success: true, qualification: qualified, message: 'Qualificação simples' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Usar Lovable AI para qualificação
    console.log('🤖 Qualificando com Lovable AI...')

    const aiResponse = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
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
            content: `Você é um especialista em qualificação de prospects B2B de alto valor.

Sua tarefa é analisar perfis e retornar um JSON com:
{
  "score": 0-100,
  "poder_aquisitivo": 0-25,
  "momento_certo": 0-25,
  "fit_produto": 0-25,
  "sinais_compra": 0-25,
  "justificativa": "texto em português, 2-3 frases",
  "insights": ["insight 1", "insight 2", "insight 3"],
  "recomendacao": "contatar_agora" | "aguardar" | "descartar"
}

Critérios de pontuação:
- Poder Aquisitivo (25pts): Capital social, patrimônio, porte empresa
- Momento Certo (25pts): Situação cadastral, notícias recentes, crescimento
- Fit Produto (25pts): Setor, cargo, perfil LinkedIn
- Sinais de Compra (25pts): Presença digital, notícias, expansão

Retorne APENAS o JSON, sem markdown.`
          },
          {
            role: 'user',
            content: `Analise este prospect:\n\n${contexto}`
          }
        ],
        temperature: 0.7,
      })
    })

    if (!aiResponse.ok) {
      throw new Error(`Lovable AI error: ${aiResponse.status}`)
    }

    const aiData = await aiResponse.json()
    const aiContent = aiData.choices[0].message.content.trim()
    
    // Parse JSON da resposta
    let analysis
    try {
      const jsonMatch = aiContent.match(/\{[\s\S]*\}/)
      analysis = JSON.parse(jsonMatch ? jsonMatch[0] : aiContent)
    } catch {
      throw new Error('Falha ao parsear resposta da IA')
    }

    const qualificationData = {
      socio_id,
      score: analysis.score || 50,
      justificativa: analysis.justificativa || 'Análise gerada por IA',
      insights: analysis.insights || []
    }

    console.log(`💾 Salvando qualificação (Score: ${qualificationData.score})...`)

    const { data: existing } = await supabaseClient
      .from('prospects_qualificados')
      .select('id')
      .eq('socio_id', socio_id)
      .maybeSingle()

    let qualified
    if (existing) {
      const { data } = await supabaseClient
        .from('prospects_qualificados')
        .update(qualificationData)
        .eq('id', existing.id)
        .select()
        .single()
      qualified = data
    } else {
      const { data } = await supabaseClient
        .from('prospects_qualificados')
        .insert({ ...qualificationData, user_id: user.id })
        .select()
        .single()
      qualified = data
    }

    await supabaseClient
      .from('qualification_queue')
      .update({ status: 'completed', processed_at: new Date().toISOString() })
      .eq('socio_id', socio_id)

    console.log('✅ Qualificação com IA completa!')

    return new Response(
      JSON.stringify({ success: true, qualification: qualified, analysis }),
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
