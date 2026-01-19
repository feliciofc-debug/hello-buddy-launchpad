import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const CONTABO_WUZAPI_URL = Deno.env.get('CONTABO_WUZAPI_URL') || 'https://api2.amzofertas.com.br'
    const CONTABO_WUZAPI_ADMIN_TOKEN = Deno.env.get('CONTABO_WUZAPI_ADMIN_TOKEN')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL') || 
                        Deno.env.get('PROJECT_URL') || 
                        Deno.env.get('URL_DO_PROJETO') || 
                        'https://zunuqaidxffuhwmvcwul.supabase.co'
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') || 
                                     Deno.env.get('SERVICE_ROLE_KEY') || 
                                     Deno.env.get('CHAVE_FUNÇÃO_DE_SERVIÇO') || ''

    if (!CONTABO_WUZAPI_ADMIN_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração Wuzapi Contabo não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    if (!SUPABASE_SERVICE_ROLE_KEY) {
      return new Response(
        JSON.stringify({ success: false, error: 'Chave de serviço Supabase não configurada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const authHeader = req.headers.get('Authorization')
    if (!authHeader) {
      return new Response(
        JSON.stringify({ success: false, error: 'Não autenticado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const token = authHeader.replace('Bearer ', '')
    const { data: { user }, error: userError } = await supabase.auth.getUser(token)

    if (userError || !user) {
      return new Response(
        JSON.stringify({ success: false, error: 'Usuário não encontrado' }),
        { status: 401, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const body = await req.json()
    const { action, nome, email, telefone, afiliado_codigo } = body

    console.log('📡 Ação:', action, 'User:', user.id)

    // CRIAR INSTÂNCIA
    if (action === 'criar-instancia') {
      const { data: existingCliente } = await supabase
        .from('clientes_afiliados')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingCliente && existingCliente.wuzapi_token) {
        return new Response(
          JSON.stringify({ success: true, message: 'Cliente já possui instância', cliente: existingCliente }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const { data: tokenData, error: tokenError } = await supabase
        .from('wuzapi_tokens_afiliados')
        .select('*')
        .eq('em_uso', false)
        .is('cliente_afiliado_id', null)
        .limit(1)
        .maybeSingle()

      if (tokenError || !tokenData) {
        return new Response(
          JSON.stringify({ success: false, error: 'Nenhum slot disponível.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      let afiliadoId = null
      if (afiliado_codigo) {
        const { data: afiliado } = await supabase
          .from('afiliados')
          .select('id')
          .eq('codigo_referencia', afiliado_codigo)
          .maybeSingle()
        if (afiliado) afiliadoId = afiliado.id
      }

      const wuzapiResponse = await fetch(`${CONTABO_WUZAPI_URL}/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': CONTABO_WUZAPI_ADMIN_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({ name: nome || user.email, token: tokenData.token })
      })

      const wuzapiResult = await wuzapiResponse.json()

      if (!wuzapiResponse.ok && wuzapiResult.code !== 409) {
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar instância no servidor' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const clienteData = {
        user_id: user.id,
        nome: nome || user.email?.split('@')[0] || 'Cliente',
        email: email || user.email,
        telefone: telefone || '',
        wuzapi_token: tokenData.token,
        wuzapi_instance_id: wuzapiResult.id || null,
        status: 'ativo',
        afiliado_id: afiliadoId
      }

      let cliente
      if (existingCliente) {
        const { data, error } = await supabase
          .from('clientes_afiliados')
          .update(clienteData)
          .eq('id', existingCliente.id)
          .select()
          .single()
        if (error) throw error
        cliente = data
      } else {
        const { data, error } = await supabase
          .from('clientes_afiliados')
          .insert(clienteData)
          .select()
          .single()
        if (error) throw error
        cliente = data
      }

      await supabase
        .from('wuzapi_tokens_afiliados')
        .update({ em_uso: true, cliente_afiliado_id: cliente.id })
        .eq('id', tokenData.id)

      if (afiliadoId) {
        await supabase.rpc('increment_afiliado_indicacoes', { afiliado_uuid: afiliadoId })
        await supabase.from('comissoes').insert({
          afiliado_id: afiliadoId,
          cliente_id: cliente.id,
          valor: 59.70,
          mes_referencia: new Date().toISOString().substring(0, 7),
          status: 'pendente'
        })
      }

      return new Response(
        JSON.stringify({ success: true, message: 'Instância criada!', cliente }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // CONECTAR (QR CODE)
    if (action === 'conectar') {
      const { data: cliente } = await supabase
        .from('clientes_afiliados')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!cliente || !cliente.wuzapi_token) {
        return new Response(
          JSON.stringify({ success: false, error: 'Cliente não tem instância configurada' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      try {
        await fetch(`${CONTABO_WUZAPI_URL}/session/logout`, {
          method: 'POST',
          headers: { 'Token': cliente.wuzapi_token }
        })
      } catch (err) {}

      await new Promise((r) => setTimeout(r, 2000))

      await fetch(`${CONTABO_WUZAPI_URL}/session/connect`, {
        method: 'POST',
        headers: { 'Token': cliente.wuzapi_token, 'Content-Type': 'application/json' },
        body: JSON.stringify({})
      })

      let qrCode: string | null = null
      for (let i = 0; i < 5; i++) {
        const qrResponse = await fetch(`${CONTABO_WUZAPI_URL}/session/qr`, {
          method: 'GET',
          headers: { 'Token': cliente.wuzapi_token }
        })
        const qrText = await qrResponse.text()

        try {
          const qrJson = JSON.parse(qrText)
          const raw = qrJson?.data?.QRCode || qrJson?.data?.qrcode || qrJson?.QRCode || qrJson?.qrcode || null

          if (typeof raw === 'string' && raw.startsWith('data:image')) {
            const idx = raw.indexOf('base64,')
            qrCode = idx >= 0 ? raw.slice(idx + 'base64,'.length) : raw
          } else {
            qrCode = raw
          }
        } catch {
          qrCode = null
        }

        if (qrCode) break
        await new Promise((r) => setTimeout(r, 1200))
      }

      return new Response(
        JSON.stringify({
          success: !!qrCode,
          qrCode,
          message: qrCode ? 'Escaneie o QR Code' : 'QR Code não disponível. Tente novamente.'
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // STATUS
    if (action === 'status') {
      const { data: cliente } = await supabase
        .from('clientes_afiliados')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!cliente || !cliente.wuzapi_token) {
        return new Response(
          JSON.stringify({ success: false, connected: false, error: 'Sem instância' }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      const statusResponse = await fetch(`${CONTABO_WUZAPI_URL}/session/status`, {
        method: 'GET',
        headers: { 'Token': cliente.wuzapi_token }
      })

      const statusResult = await statusResponse.json()
      const data = statusResult.data || statusResult
      const isConnected = data.loggedIn === true || data.LoggedIn === true || data.connected === true
      const jid = data.jid || data.Jid || null
      const phone = jid ? jid.split(':')[0] : null

      if (isConnected && jid) {
        await supabase
          .from('clientes_afiliados')
          .update({ data_conexao_whatsapp: new Date().toISOString(), wuzapi_jid: jid })
          .eq('id', cliente.id)
      }

      return new Response(
        JSON.stringify({ success: true, connected: isConnected, jid, phone }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // DESCONECTAR
    if (action === 'desconectar') {
      const { data: cliente } = await supabase
        .from('clientes_afiliados')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (!cliente || !cliente.wuzapi_token) {
        return new Response(
          JSON.stringify({ success: false, error: 'Sem instância' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      await fetch(`${CONTABO_WUZAPI_URL}/session/logout`, {
        method: 'POST',
        headers: { 'Token': cliente.wuzapi_token }
      })

      await supabase
        .from('clientes_afiliados')
        .update({ data_conexao_whatsapp: null, wuzapi_jid: null })
        .eq('id', cliente.id)

      return new Response(
        JSON.stringify({ success: true, message: 'Desconectado' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
