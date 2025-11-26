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

    console.log('🔗 Código do convite:', inviteCode)

    const wuzapiUrl = Deno.env.get('WUZAPI_URL')
    const wuzapiToken = Deno.env.get('WUZAPI_TOKEN')

    if (!wuzapiUrl || !wuzapiToken) {
      throw new Error('Credenciais Wuzapi não configuradas')
    }

    const baseUrl = wuzapiUrl.endsWith('/') ? wuzapiUrl.slice(0, -1) : wuzapiUrl

    let joinData = null
    let groupId = null
    let groupName = null

    // TENTAR ENDPOINT 1: /group/acceptInvite
    try {
      console.log('🔍 Tentando endpoint: /group/acceptInvite')
      
      const response1 = await fetch(`${baseUrl}/group/acceptInvite`, {
        method: 'POST',
        headers: {
          'Token': wuzapiToken,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ code: inviteCode })
      })

      console.log('📡 Status:', response1.status)
      const text1 = await response1.text()
      console.log('📝 Resposta:', text1)

      if (response1.ok) {
        joinData = JSON.parse(text1)
        groupId = joinData.data?.jid || joinData.data?.id
        groupName = joinData.data?.subject || joinData.data?.name
      }
    } catch (e: any) {
      console.log('❌ Endpoint 1 falhou:', e.message)
    }

    // TENTAR ENDPOINT 2: /group/join - ENDPOINT CORRETO! (se o primeiro falhou)
    if (!groupId) {
      try {
        console.log('🔍 Tentando endpoint: /group/join')
        
        const response2 = await fetch(`${baseUrl}/group/join`, {
          method: 'POST',
          headers: {
            'Token': wuzapiToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ Code: inviteCode })  // Parâmetro correto: "Code" com C maiúsculo
        })

        console.log('📡 Status:', response2.status)
        const text2 = await response2.text()
        console.log('📝 Resposta:', text2)

        if (response2.ok) {
          joinData = JSON.parse(text2)
          groupId = joinData.data?.jid || joinData.data?.id
          groupName = joinData.data?.subject || joinData.data?.name
        }
      } catch (e: any) {
        console.log('❌ Endpoint 2 falhou:', e.message)
      }
    }

    // TENTAR ENDPOINT 3: /acceptInvite (se os anteriores falharam)
    if (!groupId) {
      try {
        console.log('🔍 Tentando endpoint: /acceptInvite')
        
        const response3 = await fetch(`${baseUrl}/acceptInvite`, {
          method: 'POST',
          headers: {
            'Token': wuzapiToken,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({ inviteCode: inviteCode })
        })

        console.log('📡 Status:', response3.status)
        const text3 = await response3.text()
        console.log('📝 Resposta:', text3)

        if (response3.ok) {
          joinData = JSON.parse(text3)
          groupId = joinData.data?.jid || joinData.data?.id
          groupName = joinData.data?.subject || joinData.data?.name
        }
      } catch (e: any) {
        console.log('❌ Endpoint 3 falhou:', e.message)
      }
    }

    // Se nenhum endpoint funcionou
    if (!groupId) {
      throw new Error('Não foi possível entrar no grupo. Verifique se o link está correto e tente novamente.')
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
        group_name: groupName || 'Grupo sem nome',
        member_count: 0,
        status: 'active'
      }, {
        onConflict: 'user_id,group_id'
      })

    if (insertError) {
      console.error('❌ Erro ao salvar grupo:', insertError)
      throw insertError
    }

    console.log('✅ Grupo conectado e salvo com sucesso!')

    return new Response(
      JSON.stringify({
        success: true,
        groupId: groupId,
        groupName: groupName || 'Grupo sem nome'
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
