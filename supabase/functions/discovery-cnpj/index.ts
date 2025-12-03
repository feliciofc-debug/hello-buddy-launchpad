// ============================================
// EDGE FUNCTION: discovery-cnpj
// Busca empresas via Brasil API + ReceitaWS (fallback)
// Inclui busca LinkedIn dos sócios
// ============================================

import { serve } from 'https://deno.land/std@0.190.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// Função para buscar CNPJ com fallback
async function buscarCNPJ(cleanCNPJ: string): Promise<any> {
  console.log(`📡 Tentando Brasil API...`)
  
  // Tentar Brasil API primeiro
  try {
    const brasilApiUrl = `https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`
    const response = await fetch(brasilApiUrl)
    
    if (response.ok) {
      const data = await response.json()
      console.log(`✅ Brasil API OK`)
      return { source: 'brasilapi', data }
    }
    
    console.log(`⚠️ Brasil API falhou: ${response.status}`)
  } catch (e) {
    console.log(`⚠️ Brasil API erro: ${e}`)
  }
  
  // Fallback: ReceitaWS
  console.log(`📡 Tentando ReceitaWS (fallback)...`)
  try {
    const receitaWsUrl = `https://receitaws.com.br/v1/cnpj/${cleanCNPJ}`
    const response = await fetch(receitaWsUrl, {
      headers: { 'Accept': 'application/json' }
    })
    
    if (response.ok) {
      const data = await response.json()
      if (data.status !== 'ERROR') {
        console.log(`✅ ReceitaWS OK`)
        return { source: 'receitaws', data: normalizeReceitaWS(data) }
      }
    }
    
    console.log(`⚠️ ReceitaWS falhou: ${response.status}`)
  } catch (e) {
    console.log(`⚠️ ReceitaWS erro: ${e}`)
  }
  
  // Fallback: CNPJ.ws
  console.log(`📡 Tentando CNPJ.ws (fallback 2)...`)
  try {
    const cnpjWsUrl = `https://publica.cnpj.ws/cnpj/${cleanCNPJ}`
    const response = await fetch(cnpjWsUrl)
    
    if (response.ok) {
      const data = await response.json()
      console.log(`✅ CNPJ.ws OK`)
      return { source: 'cnpjws', data: normalizeCNPJWS(data) }
    }
    
    console.log(`⚠️ CNPJ.ws falhou: ${response.status}`)
  } catch (e) {
    console.log(`⚠️ CNPJ.ws erro: ${e}`)
  }
  
  throw new Error('Todas as APIs de CNPJ falharam. Tente novamente em alguns minutos.')
}

// Normalizar dados da ReceitaWS para formato padrão
function normalizeReceitaWS(data: any): any {
  return {
    cnpj: data.cnpj?.replace(/\D/g, ''),
    razao_social: data.nome,
    nome_fantasia: data.fantasia || data.nome,
    capital_social: parseFloat(data.capital_social?.replace(/\D/g, '') || '0') / 100,
    porte: data.porte,
    natureza_juridica: data.natureza_juridica,
    data_inicio_atividade: data.abertura,
    ddd_telefone_1: data.telefone,
    email: data.email,
    descricao_situacao_cadastral: data.situacao,
    cep: data.cep,
    logradouro: data.logradouro,
    numero: data.numero,
    complemento: data.complemento,
    bairro: data.bairro,
    municipio: data.municipio,
    uf: data.uf,
    cnae_fiscal: data.atividade_principal?.[0]?.code,
    cnae_fiscal_descricao: data.atividade_principal?.[0]?.text,
    cnaes_secundarios: data.atividades_secundarias?.map((a: any) => ({
      codigo: a.code,
      descricao: a.text
    })) || [],
    qsa: data.qsa?.map((s: any) => ({
      nome_socio: s.nome,
      qualificacao_socio: s.qual
    })) || []
  }
}

// Normalizar dados do CNPJ.ws para formato padrão
function normalizeCNPJWS(data: any): any {
  return {
    cnpj: data.estabelecimento?.cnpj || data.cnpj_raiz,
    razao_social: data.razao_social,
    nome_fantasia: data.estabelecimento?.nome_fantasia || data.razao_social,
    capital_social: data.capital_social || 0,
    porte: data.porte?.descricao,
    natureza_juridica: data.natureza_juridica?.descricao,
    data_inicio_atividade: data.estabelecimento?.data_inicio_atividade,
    ddd_telefone_1: data.estabelecimento?.ddd1 ? `${data.estabelecimento.ddd1}${data.estabelecimento.telefone1}` : null,
    email: data.estabelecimento?.email,
    descricao_situacao_cadastral: data.estabelecimento?.situacao_cadastral,
    cep: data.estabelecimento?.cep,
    logradouro: `${data.estabelecimento?.tipo_logradouro || ''} ${data.estabelecimento?.logradouro || ''}`.trim(),
    numero: data.estabelecimento?.numero,
    complemento: data.estabelecimento?.complemento,
    bairro: data.estabelecimento?.bairro,
    municipio: data.estabelecimento?.cidade?.nome,
    uf: data.estabelecimento?.estado?.sigla,
    cnae_fiscal: data.estabelecimento?.atividade_principal?.subclasse,
    cnae_fiscal_descricao: data.estabelecimento?.atividade_principal?.descricao,
    cnaes_secundarios: data.estabelecimento?.atividades_secundarias?.map((a: any) => ({
      codigo: a.subclasse,
      descricao: a.descricao
    })) || [],
    qsa: data.socios?.map((s: any) => ({
      nome_socio: s.nome,
      qualificacao_socio: s.qualificacao_socio?.descricao,
      cpf_cnpj_socio: s.cpf_cnpj_socio
    })) || []
  }
}

// Buscar LinkedIn do sócio via SerpAPI
async function buscarLinkedIn(nomeSocio: string, empresaNome: string): Promise<string | null> {
  const SERPAPI_KEY = Deno.env.get('SERPAPI_KEY')
  
  if (!SERPAPI_KEY) {
    console.log(`⚠️ SERPAPI_KEY não configurada`)
    return null
  }
  
  try {
    const query = encodeURIComponent(`${nomeSocio} ${empresaNome} site:linkedin.com/in/`)
    const url = `https://serpapi.com/search.json?q=${query}&api_key=${SERPAPI_KEY}&num=3`
    
    console.log(`🔍 Buscando LinkedIn: ${nomeSocio}`)
    
    const response = await fetch(url)
    
    if (!response.ok) {
      console.log(`⚠️ SerpAPI erro: ${response.status}`)
      return null
    }
    
    const data = await response.json()
    const results = data.organic_results || []
    
    // Procurar link do LinkedIn
    for (const result of results) {
      const link = result.link || ''
      if (link.includes('linkedin.com/in/')) {
        console.log(`✅ LinkedIn encontrado: ${link}`)
        return link
      }
    }
    
    console.log(`⚠️ LinkedIn não encontrado para ${nomeSocio}`)
    return null
    
  } catch (e) {
    console.log(`⚠️ Erro ao buscar LinkedIn: ${e}`)
    return null
  }
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client with user auth
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get authenticated user
    const { data: { user }, error: userError } = await supabaseClient.auth.getUser()
    
    if (userError || !user) {
      throw new Error('Usuário não autenticado')
    }

    const { cnpj, buscarLinkedin = true } = await req.json()

    if (!cnpj) {
      throw new Error('CNPJ é obrigatório')
    }

    console.log(`🔍 Buscando CNPJ: ${cnpj}`)

    // Limpar CNPJ (remover caracteres especiais)
    const cleanCNPJ = cnpj.replace(/\D/g, '')

    if (cleanCNPJ.length !== 14) {
      throw new Error('CNPJ deve ter 14 dígitos')
    }

    // Verificar se empresa já existe
    const { data: existing } = await supabaseClient
      .from('empresas')
      .select(`
        *,
        socios:socios(*)
      `)
      .eq('cnpj', cleanCNPJ)
      .maybeSingle()

    if (existing) {
      console.log(`⚠️ Empresa já existe: ${existing.razao_social}`)
      
      // Se não tem sócios, buscar e salvar
      if (!existing.socios || existing.socios.length === 0) {
        console.log(`👥 Empresa sem sócios - buscando na API...`)
        
        try {
          const { source, data: empresaData } = await buscarCNPJ(cleanCNPJ)
          const qsa = empresaData.qsa || []
          
          console.log(`📊 ${qsa.length} sócios encontrados na ${source}`)
          
          const sociosRelevantes = qsa.filter((s: any) => {
            const qualificacao = s.qualificacao_socio || s.qualificacao || ''
            return (
              qualificacao.toLowerCase().includes('administrador') ||
              qualificacao.toLowerCase().includes('diretor') ||
              qualificacao.toLowerCase().includes('presidente') ||
              qualificacao.toLowerCase().includes('sócio') ||
              qualificacao.toLowerCase().includes('socio')
            )
          })
          
          const sociosInseridos = []
          
          for (const socioData of sociosRelevantes) {
            const nomeSocio = socioData.nome_socio || socioData.nome
            
            // Buscar LinkedIn
            let linkedinUrl = null
            if (buscarLinkedin && nomeSocio) {
              linkedinUrl = await buscarLinkedIn(nomeSocio, existing.razao_social)
            }
            
            const { data: socio, error: socioError } = await supabaseClient
              .from('socios')
              .insert({
                empresa_id: existing.id,
                nome: nomeSocio,
                cpf: socioData.cpf_cnpj_socio || null,
                qualificacao: socioData.qualificacao_socio || socioData.qualificacao,
                percentual_capital: socioData.percentual_capital_social || 0,
                data_entrada: socioData.data_entrada_sociedade || null,
                enrichment_data: linkedinUrl ? { linkedin_url: linkedinUrl } : {}
              })
              .select()
              .single()
            
            if (!socioError && socio) {
              sociosInseridos.push(socio)
              console.log(`✅ Sócio salvo: ${socio.nome}`)
            }
          }
          
          return new Response(
            JSON.stringify({
              success: true,
              message: `Sócios adicionados (${sociosInseridos.length})`,
              empresa: existing,
              socios: sociosInseridos
            }),
            { 
              status: 200,
              headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
            }
          )
          
        } catch (e) {
          console.error('❌ Erro ao buscar sócios:', e)
        }
      }
      
      return new Response(
        JSON.stringify({
          success: false,
          message: 'Empresa já cadastrada',
          empresa: existing,
          socios: existing.socios || []
        }),
        { 
          status: 200,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Buscar dados do CNPJ (com fallback automático)
    const { source, data: empresaData } = await buscarCNPJ(cleanCNPJ)
    
    console.log(`📊 Dados de ${source}:`, {
      razao_social: empresaData.razao_social,
      cnpj: empresaData.cnpj,
      qsa_length: empresaData.qsa?.length
    })

    // Validar dados essenciais
    if (!empresaData.razao_social) {
      throw new Error('Dados da empresa incompletos na resposta da API')
    }

    // Preparar endereço
    const endereco = {
      cep: empresaData.cep || null,
      logradouro: empresaData.logradouro || null,
      numero: empresaData.numero || null,
      complemento: empresaData.complemento || null,
      bairro: empresaData.bairro || null,
      municipio: empresaData.municipio || null,
      uf: empresaData.uf || null
    }

    // Preparar atividade principal
    const atividadePrincipal = empresaData.cnae_fiscal ? {
      codigo: empresaData.cnae_fiscal.toString(),
      descricao: empresaData.cnae_fiscal_descricao || null
    } : null

    // Preparar atividades secundárias
    const atividadesSecundarias = empresaData.cnaes_secundarios || []

    // Inserir empresa
    console.log(`💾 Salvando empresa: ${empresaData.razao_social}`)
    
    const { data: empresa, error: empresaError } = await supabaseClient
      .from('empresas')
      .insert({
        cnpj: cleanCNPJ,
        razao_social: empresaData.razao_social,
        nome_fantasia: empresaData.nome_fantasia || empresaData.razao_social,
        capital_social: empresaData.capital_social || 0,
        porte: empresaData.porte || null,
        natureza_juridica: empresaData.natureza_juridica || null,
        data_abertura: empresaData.data_inicio_atividade || null,
        telefone: empresaData.ddd_telefone_1 || null,
        email: empresaData.email || null,
        situacao_cadastral: empresaData.descricao_situacao_cadastral || null,
        endereco: endereco,
        atividade_principal: atividadePrincipal,
        atividades_secundarias: atividadesSecundarias
      })
      .select()
      .single()

    if (empresaError) {
      console.error('❌ Erro ao salvar empresa:', empresaError)
      throw new Error(`Erro ao salvar empresa: ${empresaError.message}`)
    }

    console.log(`✅ Empresa salva: ${empresa.id}`)

    // Extrair e salvar sócios
    const qsa = empresaData.qsa || []
    console.log(`👥 Processando ${qsa.length} sócios...`)

    // Filtrar sócios relevantes (decisores)
    const sociosRelevantes = qsa.filter((s: any) => {
      const qualificacao = s.qualificacao_socio || s.qualificacao || ''
      return (
        qualificacao.toLowerCase().includes('administrador') ||
        qualificacao.toLowerCase().includes('diretor') ||
        qualificacao.toLowerCase().includes('presidente') ||
        qualificacao.toLowerCase().includes('sócio') ||
        qualificacao.toLowerCase().includes('socio')
      )
    })

    console.log(`🎯 ${sociosRelevantes.length} sócios decisores encontrados`)

    const sociosInseridos = []

    for (const socioData of sociosRelevantes) {
      try {
        const nomeSocio = socioData.nome_socio || socioData.nome
        
        // Buscar LinkedIn (se habilitado)
        let linkedinUrl = null
        if (buscarLinkedin && nomeSocio) {
          linkedinUrl = await buscarLinkedIn(nomeSocio, empresaData.razao_social)
        }
        
        const { data: socio, error: socioError } = await supabaseClient
          .from('socios')
          .insert({
            empresa_id: empresa.id,
            nome: nomeSocio,
            cpf: socioData.cpf_cnpj_socio || null,
            qualificacao: socioData.qualificacao_socio || socioData.qualificacao,
            percentual_capital: socioData.percentual_capital_social || 0,
            data_entrada: socioData.data_entrada_sociedade || null,
            enrichment_data: linkedinUrl ? { linkedin_url: linkedinUrl } : {}
          })
          .select()
          .single()

        if (socioError) {
          console.error(`⚠️ Erro ao salvar sócio:`, socioError)
          continue
        }

        sociosInseridos.push(socio)
        console.log(`✅ Sócio salvo: ${socio.nome}${linkedinUrl ? ' (LinkedIn encontrado)' : ''}`)

      } catch (error) {
        console.error(`⚠️ Erro ao processar sócio:`, error)
      }
    }

    console.log(`✅ ${sociosInseridos.length} sócios salvos com sucesso`)

    // Retornar resposta de sucesso
    const response = {
      success: true,
      message: 'Empresa e sócios cadastrados com sucesso',
      source: source,
      empresa: empresa,
      socios: sociosInseridos
    }

    console.log('📤 Retornando resposta:', {
      success: response.success,
      source: source,
      empresa_id: empresa.id,
      razao_social: empresa.razao_social,
      socios_count: sociosInseridos.length
    })

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )

  } catch (error: any) {
    console.error('❌ Error:', error)
    
    let errorMessage = 'Erro desconhecido'
    if (error instanceof Error) {
      errorMessage = error.message
    } else if (error.message) {
      errorMessage = error.message
    }
    
    return new Response(
      JSON.stringify({ 
        success: false,
        error: errorMessage,
        details: error.details || null
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})
