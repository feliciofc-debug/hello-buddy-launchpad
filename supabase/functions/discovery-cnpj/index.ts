import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

interface BrasilAPIResponse {
  cnpj: string
  razao_social: string
  nome_fantasia: string
  capital_social: number
  porte: string
  cnae_fiscal: number
  cnae_fiscal_descricao: string
  data_inicio_atividade: string
  ddd_telefone_1: string
  email: string
  cep: string
  logradouro: string
  numero: string
  complemento: string
  bairro: string
  municipio: string
  uf: string
  qsa: Array<{
    nome_socio: string
    cpf_cnpj_socio: string
    qualificacao_socio: string
    percentual_capital_social: number
    data_entrada_sociedade: string
  }>
}

serve(async (req) => {
  // Handle CORS
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    // Create Supabase client
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      {
        global: {
          headers: { Authorization: req.headers.get('Authorization')! },
        },
      }
    )

    // Get request body
    const { cnpj, concessionaria_id } = await req.json()

    if (!cnpj) {
      throw new Error('CNPJ is required')
    }

    console.log(`🔍 Searching CNPJ: ${cnpj}`)

    // Clean CNPJ
    const cleanCNPJ = cnpj.replace(/\D/g, '')

    // Check if already exists
    const { data: existing } = await supabaseClient
      .from('empresas')
      .select('id')
      .eq('cnpj', cleanCNPJ)
      .single()

    if (existing) {
      return new Response(
        JSON.stringify({ message: 'Company already exists', empresa_id: existing.id }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Fetch from Brasil API
    const brasilApiResponse = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`
    )

    if (!brasilApiResponse.ok) {
      throw new Error(`Brasil API error: ${brasilApiResponse.status}`)
    }

    const empresaData: BrasilAPIResponse = await brasilApiResponse.json()

    // Save empresa
    const { data: empresa, error: empresaError } = await supabaseClient
      .from('empresas')
      .insert({
        concessionaria_id,
        cnpj: cleanCNPJ,
        razao_social: empresaData.razao_social,
        nome_fantasia: empresaData.nome_fantasia,
        capital_social: empresaData.capital_social,
        porte: empresaData.porte,
        cnae_principal: empresaData.cnae_fiscal?.toString(),
        descricao_cnae: empresaData.cnae_fiscal_descricao,
        data_abertura: empresaData.data_inicio_atividade,
        telefone: empresaData.ddd_telefone_1,
        email: empresaData.email,
        cep: empresaData.cep,
        logradouro: empresaData.logradouro,
        numero: empresaData.numero,
        complemento: empresaData.complemento,
        bairro: empresaData.bairro,
        municipio: empresaData.municipio,
        uf: empresaData.uf,
        dados_completos: empresaData,
      })
      .select()
      .single()

    if (empresaError) throw empresaError

    console.log(`✅ Company saved: ${empresa.id}`)

    // Extract and save socios
    const socios = empresaData.qsa || []
    const sociosRelevantes = socios.filter((s) =>
      s.qualificacao_socio?.includes('Administrador') ||
      s.qualificacao_socio?.includes('Diretor') ||
      s.qualificacao_socio?.includes('Presidente')
    )

    const sociosInserted = []

    for (const socio of sociosRelevantes) {
      const patrimonio = (empresaData.capital_social * (socio.percentual_capital_social || 0)) / 100

      const { data: socioData, error: socioError } = await supabaseClient
        .from('socios')
        .insert({
          empresa_id: empresa.id,
          nome: socio.nome_socio,
          cpf_parcial: socio.cpf_cnpj_socio,
          qualificacao: socio.qualificacao_socio,
          participacao_capital: socio.percentual_capital_social,
          data_entrada_sociedade: socio.data_entrada_sociedade,
          patrimonio_estimado: patrimonio,
        })
        .select()
        .single()

      if (!socioError && socioData) {
        sociosInserted.push(socioData)

        // Add to enrichment queue
        await supabaseClient.from('enrichment_queue').insert({
          socio_id: socioData.id,
          status: 'pending',
        })
      }
    }

    console.log(`✅ ${sociosInserted.length} socios saved and queued for enrichment`)

    return new Response(
      JSON.stringify({
        success: true,
        empresa,
        socios: sociosInserted,
      }),
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