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

  console.log('🔍 enrich-socio INICIADO')

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

    console.log(`🔍 Buscando sócio: ${socio_id}`)

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

    // Dados mockados (sem chamar Google API por enquanto)
    const enrichmentData = {
      linkedin_url: null,
      linkedin_snippet: null,
      instagram_username: null,
      news_mentions: [],
      enriched_at: new Date().toISOString()
    }

    console.log('💾 Salvando enrichment_data...')

    // Salvar
    const { error: updateError } = await supabaseClient
      .from('socios')
      .update({ enrichment_data: enrichmentData })
      .eq('id', socio_id)

    if (updateError) {
      console.error('❌ Erro ao salvar:', updateError)
      throw new Error(`Erro ao salvar: ${updateError.message}`)
    }

    console.log('✅ enrichment_data salvo!')

    // Atualizar queue
    await supabaseClient
      .from('enrichment_queue')
      .update({ status: 'completed', processed_at: new Date().toISOString() })
      .eq('socio_id', socio_id)

    // Adicionar na qualification_queue
    await supabaseClient
      .from('qualification_queue')
      .insert({ socio_id, status: 'pending' })

    console.log('✅ Queues atualizadas!')

    // Retornar sucesso
    return new Response(
      JSON.stringify({
        success: true,
        enrichment: enrichmentData,
        message: 'Enriquecimento concluído (dados mockados)'
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('❌ ERRO GERAL:', error)
    
    // Retornar erro como 200 para não quebrar
    return new Response(
      JSON.stringify({ 
        success: false, 
        error: error.message,
        stack: error.stack
      }),
      { 
        status: 200, // IMPORTANTE: retornar 200 mesmo com erro
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})
