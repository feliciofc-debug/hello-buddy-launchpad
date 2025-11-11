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
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { cnpj, concessionaria_id } = await req.json()

    if (!cnpj || !concessionaria_id) {
      throw new Error('CNPJ and concessionaria_id are required')
    }

    console.log(`🔍 Discovering CNPJ: ${cnpj}`)

    // Fetch from Brasil API
    const cleanCNPJ = cnpj.replace(/\D/g, '')
    const brasilApiResponse = await fetch(
      `https://brasilapi.com.br/api/cnpj/v1/${cleanCNPJ}`
    )

    if (!brasilApiResponse.ok) {
      throw new Error(`Brasil API error: ${brasilApiResponse.status}`)
    }

    const empresaData: BrasilAPIResponse = await brasilApiResponse.json()
    console.log(`✅ Found: ${empresaData.nome_fantasia}`)

    // Initialize Supabase client
    const supabaseUrl = Deno.env.get('SUPABASE_URL')!
    const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const supabase = createClient(supabaseUrl, supabaseKey)

    // Save empresa
    const { data: empresa, error: empresaError } = await supabase
      .from('empresas')
      .upsert({
        concessionaria_id,
        cnpj: empresaData.cnpj,
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

    console.log(`💾 Empresa saved: ${empresa.id}`)

    // Filter and save qualified socios (decision makers only)
    const qualifiedSocios = (empresaData.qsa || []).filter((s) =>
      s.qualificacao_socio?.includes('Administrador') ||
      s.qualificacao_socio?.includes('Diretor') ||
      s.qualificacao_socio?.includes('Presidente') ||
      s.qualificacao_socio?.includes('Sócio')
    )

    const sociosToInsert = qualifiedSocios.map((s) => ({
      empresa_id: empresa.id,
      nome: s.nome_socio,
      cpf_parcial: s.cpf_cnpj_socio,
      qualificacao: s.qualificacao_socio,
      participacao_capital: s.percentual_capital_social || 0,
      data_entrada_sociedade: s.data_entrada_sociedade,
      patrimonio_estimado: (empresaData.capital_social * (s.percentual_capital_social || 0)) / 100,
    }))

    let socios = []
    if (sociosToInsert.length > 0) {
      const { data: savedSocios, error: sociosError } = await supabase
        .from('socios')
        .upsert(sociosToInsert, { onConflict: 'empresa_id,nome' })
        .select()

      if (sociosError) throw sociosError
      socios = savedSocios
      console.log(`👥 Saved ${socios.length} decision makers`)
    }

    return new Response(
      JSON.stringify({
        success: true,
        empresa,
        socios,
        socios_count: socios.length,
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  } catch (error) {
    console.error('❌ Discovery error:', error)
    return new Response(
      JSON.stringify({
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      }
    )
  }
})