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
    const { userId, inviteCode } = await req.json()

    console.log('🔗 Tentando entrar no grupo com código:', inviteCode)

    const wuzapiUrl = Deno.env.get('WUZAPI_URL')
    const wuzapiToken = Deno.env.get('WUZAPI_TOKEN')

    if (!wuzapiUrl || !wuzapiToken) {
      throw new Error('Credenciais Wuzapi não configuradas')
    }

    const baseUrl = wuzapiUrl.endsWith('/') ? wuzapiUrl.slice(0, -1) : wuzapiUrl

    // Entrar no grupo via link
    const joinResponse = await fetch(`${baseUrl}/group/join`, {
      method: 'POST',
      headers: {
        'Token': wuzapiToken,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({
        code: inviteCode
      })
    })

    console.log('📡 Status do join:', joinResponse.status)

    if (!joinResponse.ok) {
      const errorText = await joinResponse.text()
      console.error('❌ Erro ao entrar no grupo:', errorText)
      throw new Error(`Erro ao entrar no grupo: ${errorText}`)
    }

    const joinData = await joinResponse.json()
    console.log('✅ Resposta do join:', joinData)

    // Extrair informações do grupo
    const groupId = joinData.data?.groupId || joinData.data?.jid || joinData.groupId
    const groupName = joinData.data?.subject || joinData.data?.name || 'Grupo sem nome'

    if (!groupId) {
      throw new Error('ID do grupo não retornado pela API')
    }

    // Salvar grupo no banco
    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { error: insertError } = await supabaseAdmin
      .from('whatsapp_groups')
      .upsert({
        user_id: userId,
        group_id: groupId,
        group_name: groupName,
        member_count: 0,
        status: 'active'
      }, {
        onConflict: 'user_id,group_id'
      })

    if (insertError) {
      console.error('❌ Erro ao salvar grupo:', insertError)
      throw insertError
    }

    console.log('💾 Grupo salvo no banco de dados')

    return new Response(
      JSON.stringify({
        success: true,
        groupId: groupId,
        groupName: groupName
      }),
      {
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    console.error('❌ Erro geral:', error)

    return new Response(
      JSON.stringify({
        success: false,
        error: error.message || 'Erro desconhecido'
      }),
      {
        status: 500,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      }
    )
  }
})
