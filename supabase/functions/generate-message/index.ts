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

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const { prospect_id } = await req.json()
    if (!prospect_id) throw new Error('prospect_id required')

    console.log(`✍️ Generating messages for prospect: ${prospect_id}`)

    // Buscar prospect
    const { data: prospect } = await supabaseClient
      .from('prospects_qualificados')
      .select('*, socio:socios(*, empresa:empresas(*))')
      .eq('id', prospect_id)
      .single()

    if (!prospect) throw new Error('Prospect not found')

    const firstName = prospect.socio.nome.split(' ')[0]
    const empresa = prospect.socio.empresa.nome_fantasia || prospect.socio.empresa.razao_social

    const messages = {
      professional: `Oi ${firstName}!\n\nVi que você é ${prospect.socio.qualificacao} na ${empresa}. Parabéns!\n\nTenho uma proposta que pode interessar.\n\nPodemos conversar?\n\nAbs,\nJoão - AMZ`,
      friendly: `E aí ${firstName}!\n\nAchei seu perfil da ${empresa}!\n\nTenho algo legal pra te mostrar.\n\nBora trocar uma ideia? 😊\n\nAbs,\nJoão`,
      enthusiast: `${firstName}! 🚀\n\nSua empresa ${empresa} está incrível!\n\nQuero te apresentar algo especial.\n\nTopa?\n\nAbs,\nJoão`,
      generated_at: new Date().toISOString()
    }

    console.log(`💾 Salvando mensagens...`)

    // Salvar
    await supabaseClient
      .from('prospects_qualificados')
      .update({ mensagens_geradas: messages })
      .eq('id', prospect_id)

    console.log(`✅ Messages generated for: ${prospect.socio.nome}`)

    return new Response(
      JSON.stringify({
        success: true,
        messages,
        prospect: {
          id: prospect_id,
          nome: prospect.socio.nome,
          score: prospect.score
        }
      }),
      { 
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )

  } catch (error: any) {
    console.error('❌ Error:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { 
        status: 200, // Retornar 200 mesmo com erro
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})