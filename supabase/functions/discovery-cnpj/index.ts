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
  natureza_juridica?: string
  descricao_situacao_cadastral?: string
  cnae_fiscal: number
  cnae_fiscal_descricao: string
  cnaes_secundarios?: Array<{
    codigo: number
    descricao: string
  }>
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
      .maybeSingle()

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
        cnpj: cleanCNPJ,
        razao_social: empresaData.razao_social,
        nome_fantasia: empresaData.nome_fantasia,
        capital_social: empresaData.capital_social,
        porte: empresaData.porte,
        natureza_juridica: empresaData.natureza_juridica,
        data_abertura: empresaData.data_inicio_atividade,
        telefone: empresaData.ddd_telefone_1,
        email: empresaData.email,
        situacao_cadastral: empresaData.descricao_situacao_cadastral,
        endereco: {
          cep: empresaData.cep,
          logradouro: empresaData.logradouro,
          numero: empresaData.numero,
          complemento: empresaData.complemento,
          bairro: empresaData.bairro,
          municipio: empresaData.municipio,
          uf: empresaData.uf,
        },
        atividade_principal: {
          codigo: empresaData.cnae_fiscal?.toString(),
          descricao: empresaData.cnae_fiscal_descricao,
        },
        atividades_secundarias: empresaData.cnaes_secundarios || [],
      })
      .select()
      .single()

    if (empresaError) {
      console.error('❌ Error saving empresa:', empresaError);
      throw empresaError;
    }

    if (!empresa) {
      console.error('❌ No empresa returned from insert');
      throw new Error('Failed to save company data');
    }

    console.log(`✅ Company saved:`, JSON.stringify(empresa, null, 2));

    // Extract and save socios
    const socios = empresaData.qsa || []
    const sociosRelevantes = socios.filter((s) =>
      s.qualificacao_socio?.includes('Administrador') ||
      s.qualificacao_socio?.includes('Diretor') ||
      s.qualificacao_socio?.includes('Presidente')
    )

    const sociosInserted = []

    for (const socio of sociosRelevantes) {
      const { data: socioData, error: socioError } = await supabaseClient
        .from('socios')
        .insert({
          empresa_id: empresa.id,
          nome: socio.nome_socio,
          cpf: socio.cpf_cnpj_socio,
          qualificacao: socio.qualificacao_socio,
          percentual_capital: socio.percentual_capital_social,
          data_entrada: socio.data_entrada_sociedade,
        })
        .select()
        .single()

      if (!socioError && socioData) {
        sociosInserted.push(socioData)
      }
    }

    console.log(`✅ ${sociosInserted.length} socios saved`)

    const response = {
      success: true,
      empresa: empresa,
      socios: sociosInserted,
    };

    console.log('📤 Returning response:', JSON.stringify(response, null, 2));

    return new Response(
      JSON.stringify(response),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error: any) {
    console.error('❌ Error:', error);
    
    let errorMessage = 'Unknown error';
    if (error instanceof Error) {
      errorMessage = error.message;
    } else if (error.message) {
      errorMessage = error.message;
    }
    
    return new Response(
      JSON.stringify({ 
        error: errorMessage,
        details: error.details || null,
        hint: 'Verifique se o CNPJ está correto e tente novamente'
      }),
      {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})