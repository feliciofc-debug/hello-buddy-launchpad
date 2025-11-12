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

  console.log('🤖 qualify-prospect INICIADO')

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const body = await req.json()
    console.log('📦 Body recebido:', body)

    const { socio_id } = body

    if (!socio_id) {
      console.error('❌ socio_id não fornecido')
      throw new Error('socio_id é obrigatório')
    }

    console.log(`🤖 Buscando sócio: ${socio_id}`)

    // Buscar sócio
    const { data: socio, error: socioError } = await supabaseClient
      .from('socios')
      .select('*, empresa:empresas(*)')
      .eq('id', socio_id)
      .single()

    if (socioError) {
      console.error('❌ Erro ao buscar sócio:', socioError)
      throw new Error(`Erro ao buscar sócio: ${socioError.message}`)
    }

    if (!socio) {
      console.error('❌ Sócio não encontrado')
      throw new Error('Sócio não encontrado')
    }

    console.log(`✅ Sócio encontrado: ${socio.nome}`)

    // Calcular score simples
    let score = 60

    if (socio.patrimonio_estimado > 5000000) score += 20
    else if (socio.patrimonio_estimado > 1000000) score += 10

    const cargo = (socio.qualificacao || '').toLowerCase()
    if (cargo.includes('administrador') || cargo.includes('diretor')) score += 15

    if (socio.empresa.capital_social > 1000000) score += 5

    score = Math.min(100, Math.max(0, score))

    const qualificationData = {
      socio_id,
      score,
      justificativa: `${socio.qualificacao} na ${socio.empresa.nome_fantasia}. Capital social de R$ ${(socio.empresa.capital_social || 0).toLocaleString('pt-BR')}.`,
      insights: [
        `Cargo: ${socio.qualificacao}`,
        `Empresa: ${socio.empresa.nome_fantasia}`,
        `Capital: R$ ${(socio.empresa.capital_social || 0).toLocaleString('pt-BR')}`
      ]
    }

    console.log(`💾 Salvando qualificação (Score: ${score})...`)

    // Get user_id from auth
    const authHeader = req.headers.get('Authorization')
    const token = authHeader?.replace('Bearer ', '')
    const { data: { user } } = await supabaseClient.auth.getUser(token)
    
    if (!user) {
      throw new Error('User not authenticated')
    }

    // Verificar se já existe
    const { data: existing } = await supabaseClient
      .from('prospects_qualificados')
      .select('id')
      .eq('socio_id', socio_id)
      .maybeSingle()

    let qualified

    if (existing) {
      // Atualizar
      const { data, error } = await supabaseClient
        .from('prospects_qualificados')
        .update(qualificationData)
        .eq('id', existing.id)
        .select()
        .single()

      if (error) throw error
      qualified = data
    } else {
      // Inserir
      const { data, error } = await supabaseClient
        .from('prospects_qualificados')
        .insert({ ...qualificationData, user_id: user.id })
        .select()
        .single()

      if (error) throw error
      qualified = data
    }

    console.log('✅ Qualificação salva!')

    // Atualizar queue
    await supabaseClient
      .from('qualification_queue')
      .update({ status: 'completed', processed_at: new Date().toISOString() })
      .eq('socio_id', socio_id)

    console.log('✅ Queue atualizada!')

    return new Response(
      JSON.stringify({
        success: true,
        qualification: qualified,
        message: 'Qualificação concluída (cálculo simples)'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('❌ ERRO GERAL:', error)
    
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
