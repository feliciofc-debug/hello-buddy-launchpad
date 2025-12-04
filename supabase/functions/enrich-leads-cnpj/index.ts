import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { lead_ids, lead_tipo } = await req.json()
    
    console.log('═══════════════════════════════════════════════════════')
    console.log('💎 ENRICH-LEADS-CNPJ - Enriquecimento Completo')
    console.log('═══════════════════════════════════════════════════════')
    console.log(`📊 Leads para processar: ${lead_ids?.length || 0}`)
    console.log(`📋 Tipo: ${lead_tipo}`)

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')
    const GOOGLE_API_KEY = Deno.env.get('GOOGLE_API_KEY')

    if (!lead_ids || lead_ids.length === 0) {
      return new Response(JSON.stringify({ 
        error: 'Nenhum lead para processar' 
      }), { 
        status: 400, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      })
    }

    // Buscar leads do banco
    const tabela = lead_tipo === 'b2b' ? 'leads_b2b' : 'leads_b2c'
    const { data: leads, error: leadsError } = await supabase
      .from(tabela)
      .select('*')
      .in('id', lead_ids)

    if (leadsError || !leads) {
      console.error('❌ Erro ao buscar leads:', leadsError)
      return new Response(JSON.stringify({ error: 'Erro ao buscar leads' }), {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log(`✅ ${leads.length} leads carregados do banco`)

    const resultados = {
      total: leads.length,
      enriquecidos: 0,
      cnpj_encontrados: 0,
      socios_encontrados: 0,
      linkedin_encontrados: 0,
      erros: 0
    }

    for (const lead of leads) {
      console.log(`\n🔍 Processando: ${lead.razao_social || lead.nome_fantasia || lead.nome_completo}`)
      
      try {
        const nomeEmpresa = lead.razao_social || lead.nome_fantasia || ''
        
        // ═══════════════════════════════════════════════════════
        // ETAPA 1: Buscar CNPJ se não tiver
        // ═══════════════════════════════════════════════════════
        
        let cnpj = lead.cnpj
        
        if (!cnpj || cnpj.includes('00000000')) {
          console.log('🔎 Buscando CNPJ...')
          cnpj = await buscarCNPJ(nomeEmpresa, SERPAPI_KEY)
          
          if (cnpj) {
            console.log(`✅ CNPJ encontrado: ${cnpj}`)
            resultados.cnpj_encontrados++
          } else {
            console.log('⚠️ CNPJ não encontrado')
          }
        } else {
          console.log(`📋 CNPJ já existe: ${cnpj}`)
        }

        // ═══════════════════════════════════════════════════════
        // ETAPA 2: Buscar dados completos via BrasilAPI
        // ═══════════════════════════════════════════════════════
        
        let dadosEmpresa = null
        
        if (cnpj && cnpj.length >= 14) {
          console.log('🏢 Buscando dados da empresa...')
          dadosEmpresa = await buscarDadosEmpresa(cnpj.replace(/\D/g, ''))
          
          if (dadosEmpresa) {
            console.log(`✅ Dados encontrados: ${dadosEmpresa.razao_social}`)
            console.log(`   Sócios: ${dadosEmpresa.socios?.length || 0}`)
          }
        }

        // ═══════════════════════════════════════════════════════
        // ETAPA 3: Buscar LinkedIn dos sócios
        // ═══════════════════════════════════════════════════════
        
        const sociosComLinkedIn = []
        
        if (dadosEmpresa?.socios && dadosEmpresa.socios.length > 0) {
          console.log('👥 Buscando LinkedIn dos sócios...')
          resultados.socios_encontrados += dadosEmpresa.socios.length
          
          // Top 3 sócios
          for (const socio of dadosEmpresa.socios.slice(0, 3)) {
            const linkedin = await buscarLinkedInSocio(
              socio.nome, 
              nomeEmpresa, 
              SERPAPI_KEY
            )
            
            sociosComLinkedIn.push({
              ...socio,
              linkedin_url: linkedin
            })
            
            if (linkedin) {
              console.log(`   ✅ LinkedIn: ${socio.nome}`)
              resultados.linkedin_encontrados++
            }
            
            // Rate limit
            await new Promise(r => setTimeout(r, 1500))
          }
        }

        // ═══════════════════════════════════════════════════════
        // ETAPA 4: Atualizar lead no banco
        // ═══════════════════════════════════════════════════════
        
        const updateData: any = {
          enriched_at: new Date().toISOString(),
          enrichment_data: {
            cnpj_buscado: cnpj !== lead.cnpj,
            dados_empresa: dadosEmpresa ? true : false,
            socios_encontrados: sociosComLinkedIn.length,
            linkedin_encontrados: sociosComLinkedIn.filter(s => s.linkedin_url).length
          }
        }

        if (cnpj && cnpj !== lead.cnpj) {
          updateData.cnpj = cnpj
        }

        if (dadosEmpresa) {
          if (dadosEmpresa.razao_social) updateData.razao_social = dadosEmpresa.razao_social
          if (dadosEmpresa.nome_fantasia) updateData.nome_fantasia = dadosEmpresa.nome_fantasia
          if (dadosEmpresa.porte) updateData.porte = dadosEmpresa.porte
          if (dadosEmpresa.capital_social) updateData.capital_social = dadosEmpresa.capital_social
          if (dadosEmpresa.natureza_juridica) updateData.natureza_juridica = dadosEmpresa.natureza_juridica
          if (dadosEmpresa.situacao) updateData.situacao = dadosEmpresa.situacao
          if (dadosEmpresa.email) updateData.email = dadosEmpresa.email
          if (dadosEmpresa.telefone) updateData.telefone = dadosEmpresa.telefone
          
          if (sociosComLinkedIn.length > 0) {
            updateData.socios = sociosComLinkedIn
            
            // Pegar decisor principal (primeiro sócio administrador)
            const decisor = sociosComLinkedIn.find(s => 
              s.qualificacao?.toLowerCase().includes('administrador') ||
              s.qualificacao?.toLowerCase().includes('diretor')
            ) || sociosComLinkedIn[0]
            
            if (decisor) {
              updateData.decisor_nome = decisor.nome
              updateData.decisor_cargo = decisor.qualificacao
              if (decisor.linkedin_url) {
                updateData.linkedin_url = decisor.linkedin_url
              }
            }
          }
        }

        // Calcular score bonus
        let scoreBonus = 0
        if (cnpj) scoreBonus += 10
        if (dadosEmpresa) scoreBonus += 15
        if (sociosComLinkedIn.length > 0) scoreBonus += 10
        if (sociosComLinkedIn.some(s => s.linkedin_url)) scoreBonus += 15
        
        updateData.score = (lead.score || 0) + scoreBonus

        const { error: updateError } = await supabase
          .from(tabela)
          .update(updateData)
          .eq('id', lead.id)

        if (updateError) {
          console.error('❌ Erro ao atualizar lead:', updateError)
          resultados.erros++
        } else {
          console.log(`💎 Lead enriquecido! Score: +${scoreBonus}`)
          resultados.enriquecidos++
        }

        // Rate limit entre leads
        await new Promise(r => setTimeout(r, 2000))

      } catch (error) {
        console.error(`❌ Erro processando lead:`, error)
        resultados.erros++
      }
    }

    console.log('\n═══════════════════════════════════════════════════════')
    console.log('✅ PROCESSAMENTO CONCLUÍDO!')
    console.log('═══════════════════════════════════════════════════════')
    console.log(`📊 Total: ${resultados.total}`)
    console.log(`💎 Enriquecidos: ${resultados.enriquecidos}`)
    console.log(`🔍 CNPJs encontrados: ${resultados.cnpj_encontrados}`)
    console.log(`👥 Sócios encontrados: ${resultados.socios_encontrados}`)
    console.log(`👤 LinkedIns: ${resultados.linkedin_encontrados}`)
    console.log(`❌ Erros: ${resultados.erros}`)

    return new Response(JSON.stringify({
      success: true,
      resultados
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: any) {
    console.error('❌ Erro geral:', error)
    return new Response(JSON.stringify({ 
      error: error.message || 'Erro desconhecido'
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})

// ═══════════════════════════════════════════════════════
// FUNÇÃO: Buscar CNPJ - MÚLTIPLAS ESTRATÉGIAS
// ═══════════════════════════════════════════════════════

async function buscarCNPJ(nomeEmpresa: string, serpApiKey: string | undefined): Promise<string | null> {
  if (!nomeEmpresa) return null
  
  console.log(`🔎 Iniciando busca CNPJ para: "${nomeEmpresa}"`)

  // ESTRATÉGIA 1: Buscar CNPJ diretamente no Google
  if (serpApiKey) {
    try {
      // Queries mais específicas
      const queries = [
        `"${nomeEmpresa}" CNPJ site:cnpj.info`,
        `"${nomeEmpresa}" CNPJ site:consultacnpj.com`,
        `"${nomeEmpresa}" CNPJ site:casadosdados.com.br`,
        `CNPJ "${nomeEmpresa}" receita federal`,
        `"${nomeEmpresa}" CNPJ`
      ]
      
      for (const query of queries) {
        console.log(`   🔍 Query: ${query}`)
        
        const url = `https://serpapi.com/search?q=${encodeURIComponent(query)}&num=10&gl=br&hl=pt&api_key=${serpApiKey}`
        
        const response = await fetch(url)
        const data = await response.json()
        
        // Log completo para debug
        console.log(`   📊 Resultados: ${data.organic_results?.length || 0}`)
        
        // Buscar padrão CNPJ em TODO o JSON
        const textoCompleto = JSON.stringify(data)
        
        // Regex para CNPJ com ou sem formatação
        const regexCNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g
        const matches = textoCompleto.match(regexCNPJ)
        
        if (matches && matches.length > 0) {
          // Filtrar CNPJs únicos e válidos
          const cnpjsUnicos = [...new Set(matches.map(m => m.replace(/\D/g, '')))]
          
          for (const cnpj of cnpjsUnicos) {
            // Validar se CNPJ tem 14 dígitos e não é só zeros
            if (cnpj.length === 14 && !/^0+$/.test(cnpj)) {
              console.log(`   ✅ CNPJ encontrado: ${formatarCNPJ(cnpj)}`)
              
              // Validar se CNPJ é real consultando BrasilAPI
              const valido = await validarCNPJ(cnpj)
              if (valido) {
                console.log(`   ✅ CNPJ validado na BrasilAPI!`)
                return cnpj
              } else {
                console.log(`   ⚠️ CNPJ não encontrado na BrasilAPI, tentando próximo...`)
              }
            }
          }
        }
        
        // Rate limit entre queries
        await new Promise(r => setTimeout(r, 1000))
      }
    } catch (error) {
      console.log('⚠️ Erro busca CNPJ SerpAPI:', error)
    }
  }

  // ESTRATÉGIA 2: Buscar no Google Maps para pegar mais detalhes
  if (serpApiKey) {
    try {
      console.log(`   🗺️ Tentando Google Maps...`)
      const url = `https://serpapi.com/search?engine=google_maps&q=${encodeURIComponent(nomeEmpresa)}&ll=-22.9068467,-43.1728965,15z&type=search&api_key=${serpApiKey}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.local_results && data.local_results.length > 0) {
        const local = data.local_results[0]
        console.log(`   📍 Local encontrado: ${local.title}`)
        
        // Às vezes o CNPJ aparece na descrição ou extensões
        const textoLocal = JSON.stringify(local)
        const regexCNPJ = /\d{2}\.?\d{3}\.?\d{3}\/?\d{4}-?\d{2}/g
        const matches = textoLocal.match(regexCNPJ)
        
        if (matches && matches.length > 0) {
          const cnpj = matches[0].replace(/\D/g, '')
          if (cnpj.length === 14) {
            console.log(`   ✅ CNPJ do Maps: ${formatarCNPJ(cnpj)}`)
            return cnpj
          }
        }
      }
    } catch (error) {
      console.log('⚠️ Erro Google Maps:', error)
    }
  }

  console.log(`   ❌ CNPJ não encontrado para: ${nomeEmpresa}`)
  return null
}

// Validar CNPJ na BrasilAPI
async function validarCNPJ(cnpj: string): Promise<boolean> {
  try {
    const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`
    const response = await fetch(url)
    return response.ok
  } catch {
    return false
  }
}

// Formatar CNPJ para exibição
function formatarCNPJ(cnpj: string): string {
  return cnpj.replace(/^(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})$/, '$1.$2.$3/$4-$5')
}

// ═══════════════════════════════════════════════════════
// FUNÇÃO: Buscar dados da empresa via BrasilAPI
// ═══════════════════════════════════════════════════════

async function buscarDadosEmpresa(cnpj: string): Promise<any | null> {
  try {
    // BrasilAPI - gratuita!
    const url = `https://brasilapi.com.br/api/cnpj/v1/${cnpj}`
    const response = await fetch(url)
    
    if (!response.ok) {
      console.log('⚠️ BrasilAPI não encontrou CNPJ')
      return null
    }
    
    const data = await response.json()
    
    return {
      razao_social: data.razao_social,
      nome_fantasia: data.nome_fantasia,
      porte: data.porte || data.descricao_porte,
      capital_social: data.capital_social,
      natureza_juridica: data.natureza_juridica,
      situacao: data.descricao_situacao_cadastral || data.situacao_cadastral,
      email: data.email,
      telefone: data.ddd_telefone_1 ? `(${data.ddd_telefone_1.slice(0,2)}) ${data.ddd_telefone_1.slice(2)}` : null,
      endereco: {
        logradouro: data.logradouro,
        numero: data.numero,
        bairro: data.bairro,
        municipio: data.municipio,
        uf: data.uf,
        cep: data.cep
      },
      atividade_principal: data.cnae_fiscal_descricao,
      socios: data.qsa?.map((s: any) => ({
        nome: s.nome_socio,
        cpf: s.cnpj_cpf_do_socio,
        qualificacao: s.qualificacao_socio
      })) || []
    }
  } catch (error) {
    console.error('⚠️ Erro BrasilAPI:', error)
    return null
  }
}

// ═══════════════════════════════════════════════════════
// FUNÇÃO: Buscar LinkedIn do sócio
// ═══════════════════════════════════════════════════════

async function buscarLinkedInSocio(
  nomeSocio: string, 
  nomeEmpresa: string, 
  serpApiKey: string | undefined
): Promise<string | null> {
  if (!serpApiKey || !nomeSocio) return null

  const queries = [
    `"${nomeSocio}" "${nomeEmpresa}" site:linkedin.com/in/`,
    `"${nomeSocio}" site:linkedin.com/in/`
  ]

  for (const query of queries) {
    try {
      const url = `https://serpapi.com/search?q=${encodeURIComponent(query)}&num=3&api_key=${serpApiKey}`
      
      const response = await fetch(url)
      const data = await response.json()
      
      if (data.organic_results && data.organic_results.length > 0) {
        const linkedin = data.organic_results.find((r: any) => 
          r.link?.includes('linkedin.com/in/')
        )
        
        if (linkedin) {
          return linkedin.link
        }
      }
    } catch (error) {
      console.log('⚠️ Erro busca LinkedIn:', error)
    }
    
    await new Promise(r => setTimeout(r, 1000))
  }

  return null
}
