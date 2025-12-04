import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Cargos de decisores para buscar
const cargosDecisores = [
  'CEO', 'Diretor', 'Diretor Comercial', 'Diretor Executivo',
  'Gerente', 'Gerente Comercial', 'Sócio', 'Proprietário',
  'Head', 'VP', 'Presidente'
]

// Extrair nome limpo do título do LinkedIn
const extrairNome = (title: string): string => {
  return title
    .split('|')[0]
    .split('-')[0]
    .replace(/\s*\(.*?\)\s*/g, '')
    .trim()
    .substring(0, 100)
}

// Gerar padrões de email baseado no domínio
const gerarEmailsPossiveis = (website: string): string[] => {
  try {
    const url = new URL(website.startsWith('http') ? website : `https://${website}`)
    const domain = url.hostname.replace('www.', '')
    
    return [
      `contato@${domain}`,
      `comercial@${domain}`,
      `vendas@${domain}`,
      `info@${domain}`,
      `sac@${domain}`,
      `atendimento@${domain}`
    ]
  } catch {
    return []
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  console.log('💎 [INICIO] Função enrich-empresa')
  
  const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')

  if (!SERPAPI_KEY) {
    console.error('❌ SERPAPI_KEY não configurada')
    return new Response(JSON.stringify({ success: false, error: 'API não configurada' }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
  
  try {
    const body = await req.json()
    console.log('📦 [BODY]', JSON.stringify(body, null, 2))

    const { lead_id, lead_tipo = 'b2b' } = body

    if (!lead_id) {
      throw new Error('lead_id é obrigatório')
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Buscar lead
    const tabela = lead_tipo === 'b2b' ? 'leads_b2b' : 'leads_b2c'
    const { data: lead, error: leadError } = await supabase
      .from(tabela)
      .select('*')
      .eq('id', lead_id)
      .single()

    if (leadError || !lead) {
      throw new Error('Lead não encontrado')
    }

    console.log('🏢 [EMPRESA]', lead.razao_social || lead.nome_fantasia || lead.nome_completo)

    const nomeEmpresa = lead.razao_social || lead.nome_fantasia || ''
    let decisorEncontrado = null
    let emailsPossiveis: string[] = []

    // 1. BUSCAR DECISOR NO LINKEDIN
    if (nomeEmpresa) {
      console.log('🔍 [BUSCA] Procurando decisores para:', nomeEmpresa)
      
      for (const cargo of cargosDecisores.slice(0, 5)) {
        const query = `"${cargo}" "${nomeEmpresa}" site:linkedin.com/in/`
        console.log('🔍 [QUERY]', query)
        
        try {
          const serpUrl = `https://serpapi.com/search.json?q=${encodeURIComponent(query)}&num=5&hl=pt&gl=br&api_key=${SERPAPI_KEY}`
          
          const response = await fetch(serpUrl)
          
          if (!response.ok) {
            console.error('❌ [SERPAPI] HTTP', response.status)
            continue
          }

          const data = await response.json()

          if (data.error) {
            console.error('❌ [SERPAPI] Erro:', data.error)
            continue
          }

          // Filtrar resultados do LinkedIn
          const linkedinResults = (data.organic_results || []).filter((r: any) => 
            r.link?.includes('linkedin.com/in/')
          )

          console.log(`📊 [SERPAPI] LinkedIn results: ${linkedinResults.length}`)

          if (linkedinResults.length > 0) {
            const melhorResultado = linkedinResults[0]
            const nomeDecisor = extrairNome(melhorResultado.title || '')
            
            // Verificar se o resultado realmente menciona a empresa
            const snippet = (melhorResultado.snippet || '').toLowerCase()
            const title = (melhorResultado.title || '').toLowerCase()
            const empresaConfirmada = 
              snippet.includes(nomeEmpresa.toLowerCase().substring(0, 10)) || 
              title.includes(nomeEmpresa.toLowerCase().substring(0, 10))
            
            decisorEncontrado = {
              nome: nomeDecisor,
              cargo: cargo,
              linkedin_url: melhorResultado.link,
              empresa_confirmada: empresaConfirmada,
              snippet: melhorResultado.snippet?.substring(0, 200)
            }
            
            console.log('✅ [DECISOR]', decisorEncontrado.nome, '|', cargo, '| Confirmado:', empresaConfirmada)
            break // Encontrou decisor, parar busca
          }
          
          // Rate limit
          await new Promise(r => setTimeout(r, 1000))
          
        } catch (error) {
          console.error('❌ [ERRO] Busca decisor:', error)
        }
      }
    }

    // 2. GERAR EMAILS POSSÍVEIS
    if (lead.site_url || lead.website) {
      emailsPossiveis = gerarEmailsPossiveis(lead.site_url || lead.website)
      console.log('📧 [EMAILS]', emailsPossiveis)
    }

    // 3. ATUALIZAR LEAD NO BANCO
    const updateData: any = {
      enriched_at: new Date().toISOString(),
      enrichment_data: {
        decisor: decisorEncontrado,
        emails_possiveis: emailsPossiveis,
        enriquecido_em: new Date().toISOString(),
        fonte_enriquecimento: 'serpapi_linkedin'
      },
      pipeline_status: 'enriquecido'
    }

    // Campos específicos para decisor
    if (decisorEncontrado) {
      updateData.decisor_nome = decisorEncontrado.nome
      updateData.decisor_cargo = decisorEncontrado.cargo
      updateData.contato_nome = decisorEncontrado.nome
      updateData.contato_cargo = decisorEncontrado.cargo
      updateData.contato_linkedin = decisorEncontrado.linkedin_url
      updateData.linkedin_url = decisorEncontrado.linkedin_url
    }

    // Email da empresa
    if (emailsPossiveis.length > 0 && !lead.email) {
      updateData.email = emailsPossiveis[0] // Primeiro email como principal
    }

    // Calcular novo score
    let scoreBonus = 0
    if (decisorEncontrado) scoreBonus += 20
    if (decisorEncontrado?.empresa_confirmada) scoreBonus += 10
    if (emailsPossiveis.length > 0) scoreBonus += 5
    if (lead.telefone) scoreBonus += 10
    
    updateData.score = Math.min((lead.score || 50) + scoreBonus, 100)

    const { error: updateError } = await supabase
      .from(tabela)
      .update(updateData)
      .eq('id', lead_id)

    if (updateError) {
      console.error('❌ [DB] Erro ao atualizar:', updateError.message)
      throw new Error('Erro ao salvar enriquecimento')
    }

    console.log('✅ [FIM] Enriquecimento concluído')

    return new Response(JSON.stringify({
      success: true,
      lead_id: lead_id,
      empresa: nomeEmpresa,
      decisor: decisorEncontrado,
      emails_possiveis: emailsPossiveis,
      novo_score: updateData.score,
      pipeline_status: 'enriquecido'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    const err = error as Error
    console.error('❌ [ERRO FATAL]', err.message)
    
    return new Response(JSON.stringify({
      success: false,
      error: err.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
