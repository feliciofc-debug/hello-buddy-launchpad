// ============================================
// EDGE FUNCTION: discovery-cnpj
// Busca empresas via Brasil API e salva no DB
// VERSÃO CORRIGIDA - Trata resposta completa
// ============================================

import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
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

    const { cnpj } = await req.json()

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
      
      // Retornar dados completos da empresa existente
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

    // Buscar dados na Brasil API
    console.log(`📡 Consultando Brasil API: ${cleanCNPJ}`)
    
    const brasilApiUrl = `https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`
    const brasilApiResponse = await fetch(brasilApiUrl)

    if (!brasilApiResponse.ok) {
      const errorText = await brasilApiResponse.text()
      console.error(`❌ Brasil API Error: ${brasilApiResponse.status}`, errorText)
      throw new Error(`CNPJ não encontrado ou inválido (${brasilApiResponse.status})`)
    }

    const empresaData = await brasilApiResponse.json()

    console.log(`📊 Dados recebidos:`, {
      razao_social: empresaData.razao_social,
      cnpj: empresaData.cnpj,
      qsa_length: empresaData.qsa?.length
    })

    // Validar dados essenciais
    if (!empresaData.cnpj || !empresaData.razao_social) {
      console.error('❌ Dados incompletos:', empresaData)
      throw new Error('Dados da empresa incompletos na resposta da API')
    }

    // Preparar endereço
    const endereco = {
      cep: empresaData.cep || null,
      logradouro: empresaData.logradouro || empresaData.descricao_tipo_logradouro || null,
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
        porte: empresaData.porte || empresaData.descricao_porte || null,
        natureza_juridica: empresaData.natureza_juridica || null,
        data_abertura: empresaData.data_inicio_atividade || empresaData.data_abertura || null,
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
        qualificacao.toLowerCase().includes('sócio')
      )
    })

    console.log(`🎯 ${sociosRelevantes.length} sócios decisores encontrados`)

    const sociosInseridos = []

    for (const socioData of sociosRelevantes) {
      try {
        const { data: socio, error: socioError } = await supabaseClient
          .from('socios')
          .insert({
            empresa_id: empresa.id,
            nome: socioData.nome_socio || socioData.nome,
            cpf: socioData.cpf_cnpj_socio || null,
            qualificacao: socioData.qualificacao_socio || socioData.qualificacao,
            percentual_capital: socioData.percentual_capital_social || 0,
            data_entrada: socioData.data_entrada_sociedade || null
          })
          .select()
          .single()

        if (socioError) {
          console.error(`⚠️ Erro ao salvar sócio:`, socioError)
          continue
        }

        sociosInseridos.push(socio)
        console.log(`✅ Sócio salvo: ${socio.nome}`)

      } catch (error) {
        console.error(`⚠️ Erro ao processar sócio:`, error)
      }
    }

    console.log(`✅ ${sociosInseridos.length} sócios salvos com sucesso`)

    // Retornar resposta de sucesso
    const response = {
      success: true,
      message: 'Empresa e sócios cadastrados com sucesso',
      empresa: empresa,
      socios: sociosInseridos
    }

    console.log('📤 Retornando resposta:', {
      success: response.success,
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
