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

  console.log('🎯 Google Ads Create Campaign - Iniciando...')

  const supabase = createClient(
    Deno.env.get('SUPABASE_URL')!,
    Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  )

  try {
    const {
      userId,
      campaignName,
      budgetDaily,
      budgetTotal,
      startDate,
      endDate,
      keywords,
      targeting,
      produtoId,
      bibliotecaCampanhaId
    } = await req.json()

    if (!userId || !campaignName || !budgetDaily || !startDate) {
      throw new Error('Campos obrigatórios: userId, campaignName, budgetDaily, startDate')
    }

    // Verificar se user tem Google Ads conectado
    const { data: config } = await supabase
      .from('google_ads_config')
      .select('customer_id')
      .eq('user_id', userId)
      .single()

    console.log('📋 Config encontrada, Customer ID:', config?.customer_id || 'N/A')

    // Gerar ID único para a campanha
    const campaignId = `camp_${Date.now()}`
    
    // Processar keywords
    let keywordsArray: string[] = []
    if (keywords) {
      if (typeof keywords === 'string') {
        keywordsArray = keywords.split(',').map((k: string) => k.trim()).filter((k: string) => k)
      } else if (Array.isArray(keywords)) {
        keywordsArray = keywords
      }
    }

    console.log('💾 Salvando campanha no banco...')

    // Salvar campanha no banco
    const { data: campaign, error: insertError } = await supabase
      .from('google_ads_campaigns')
      .insert({
        user_id: userId,
        campaign_id: campaignId,
        name: campaignName,
        status: 'PENDING',
        budget_daily: budgetDaily,
        budget_total: budgetTotal || null,
        start_date: startDate,
        end_date: endDate || null,
        keywords: keywordsArray,
        targeting: targeting || {},
        produto_id: produtoId || null,
        biblioteca_campanha_id: bibliotecaCampanhaId || null,
        metrics: {
          impressions: 0,
          clicks: 0,
          ctr: 0,
          cpc: 0,
          conversions: 0,
          cost: 0
        }
      })
      .select()
      .single()

    if (insertError) {
      console.error('❌ Erro ao inserir:', insertError)
      throw insertError
    }

    console.log('✅ Campanha salva:', campaignId)

    // Atualizar biblioteca_campanhas se veio de remarketing
    if (bibliotecaCampanhaId) {
      await supabase
        .from('biblioteca_campanhas')
        .update({
          enviado_google_ads: true,
          google_ads_campaign_id: campaignId
        })
        .eq('id', bibliotecaCampanhaId)
      
      console.log('✅ Biblioteca atualizada')
    }

    return new Response(JSON.stringify({
      success: true,
      campaignId,
      campaign,
      message: 'Campanha criada com sucesso! Aguardando sincronização com Google Ads.'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error: unknown) {
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    console.error('❌ Erro:', errorMessage)
    return new Response(JSON.stringify({
      success: false,
      error: errorMessage
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
