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

    // Buscar config do usuário
    const { data: config, error: configError } = await supabase
      .from('google_ads_config')
      .select('*')
      .eq('user_id', userId)
      .single()

    if (configError || !config) {
      throw new Error('Google Ads não conectado. Conecte sua conta primeiro.')
    }

    console.log('📋 Config encontrada, Customer ID:', config.customer_id)

    // Verificar se token expirou
    let accessToken = config.access_token
    if (new Date(config.token_expires_at) < new Date()) {
      console.log('🔄 Token expirado, renovando...')
      
      const refreshResponse = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
          client_id: Deno.env.get('GOOGLE_CLIENT_ID')!,
          client_secret: Deno.env.get('GOOGLE_CLIENT_SECRET')!,
          refresh_token: config.refresh_token,
          grant_type: 'refresh_token'
        })
      })

      const newTokens = await refreshResponse.json()
      
      if (!newTokens.access_token) {
        throw new Error('Falha ao renovar token. Reconecte sua conta Google Ads.')
      }

      accessToken = newTokens.access_token

      const expiresAt = new Date()
      expiresAt.setSeconds(expiresAt.getSeconds() + newTokens.expires_in)

      await supabase
        .from('google_ads_config')
        .update({
          access_token: accessToken,
          token_expires_at: expiresAt.toISOString()
        })
        .eq('user_id', userId)

      console.log('✅ Token renovado')
    }

    const developerToken = Deno.env.get('GOOGLE_ADS_DEVELOPER_TOKEN')
    const customerId = config.customer_id

    // Se não tiver developer token ou customer ID, salvar localmente apenas
    if (!developerToken || !customerId) {
      console.log('⚠️ Developer Token ou Customer ID não configurado. Salvando campanha localmente.')
      
      const campaignId = `local_${Date.now()}`
      
      const { data: campaign, error: insertError } = await supabase
        .from('google_ads_campaigns')
        .insert({
          user_id: userId,
          campaign_id: campaignId,
          name: campaignName,
          status: 'DRAFT',
          budget_daily: budgetDaily,
          budget_total: budgetTotal || null,
          start_date: startDate,
          end_date: endDate || null,
          keywords: keywords || [],
          targeting: targeting || {},
          produto_id: produtoId || null,
          biblioteca_campanha_id: bibliotecaCampanhaId || null,
          metrics: {}
        })
        .select()
        .single()

      if (insertError) throw insertError

      return new Response(JSON.stringify({
        success: true,
        campaignId,
        campaign,
        message: 'Campanha salva localmente. Configure o Developer Token para publicar no Google Ads.'
      }), {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    // Criar campanha no Google Ads
    console.log('🚀 Criando campanha no Google Ads...')

    // 1. Criar orçamento
    const budgetMicros = Math.round(budgetDaily * 1000000)

    const budgetResponse = await fetch(
      `https://googleads.googleapis.com/v15/customers/${customerId}/campaignBudgets:mutate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operations: [{
            create: {
              name: `Budget for ${campaignName}`,
              amountMicros: budgetMicros.toString(),
              deliveryMethod: 'STANDARD'
            }
          }]
        })
      }
    )

    const budgetResult = await budgetResponse.json()
    
    if (budgetResult.error) {
      console.error('❌ Erro ao criar orçamento:', budgetResult.error)
      throw new Error(budgetResult.error.message)
    }

    const budgetResourceName = budgetResult.results[0].resourceName
    console.log('✅ Orçamento criado:', budgetResourceName)

    // 2. Criar campanha
    const campaignResponse = await fetch(
      `https://googleads.googleapis.com/v15/customers/${customerId}/campaigns:mutate`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${accessToken}`,
          'developer-token': developerToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          operations: [{
            create: {
              name: campaignName,
              status: 'ENABLED',
              advertisingChannelType: 'SEARCH',
              campaignBudget: budgetResourceName,
              startDate: startDate.replace(/-/g, ''),
              endDate: endDate ? endDate.replace(/-/g, '') : undefined,
              networkSettings: {
                targetGoogleSearch: true,
                targetSearchNetwork: true,
                targetContentNetwork: false
              }
            }
          }]
        })
      }
    )

    const campaignResult = await campaignResponse.json()
    
    if (campaignResult.error) {
      console.error('❌ Erro ao criar campanha:', campaignResult.error)
      throw new Error(campaignResult.error.message)
    }

    const campaignResourceName = campaignResult.results[0].resourceName
    const campaignId = campaignResourceName.split('/')[3]
    console.log('✅ Campanha criada:', campaignId)

    // Salvar no banco
    const { data: dbCampaign, error: dbError } = await supabase
      .from('google_ads_campaigns')
      .insert({
        user_id: userId,
        campaign_id: campaignId,
        name: campaignName,
        status: 'ENABLED',
        budget_daily: budgetDaily,
        budget_total: budgetTotal || null,
        start_date: startDate,
        end_date: endDate || null,
        keywords: keywords || [],
        targeting: targeting || {},
        produto_id: produtoId || null,
        biblioteca_campanha_id: bibliotecaCampanhaId || null,
        metrics: {}
      })
      .select()
      .single()

    if (dbError) {
      console.error('⚠️ Campanha criada no Google Ads mas erro ao salvar no banco:', dbError)
    }

    // Atualizar biblioteca_campanhas se veio de remarketing
    if (bibliotecaCampanhaId) {
      await supabase
        .from('biblioteca_campanhas')
        .update({
          enviado_google_ads: true,
          google_ads_campaign_id: campaignId
        })
        .eq('id', bibliotecaCampanhaId)
    }

    console.log('✅ Campanha criada com sucesso!')

    return new Response(JSON.stringify({
      success: true,
      campaignId,
      campaign: dbCampaign,
      message: 'Campanha criada com sucesso no Google Ads!'
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
