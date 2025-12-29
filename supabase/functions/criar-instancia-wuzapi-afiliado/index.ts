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
    const CONTABO_WUZAPI_URL = Deno.env.get('CONTABO_WUZAPI_URL')
    const CONTABO_WUZAPI_ADMIN_TOKEN = Deno.env.get('CONTABO_WUZAPI_ADMIN_TOKEN')
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    if (!CONTABO_WUZAPI_URL || !CONTABO_WUZAPI_ADMIN_TOKEN) {
      return new Response(
        JSON.stringify({ success: false, error: 'Configuração Wuzapi Contabo não encontrada' }),
        { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    // Autenticar usuário
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

    // Ação: Criar nova instância para cliente afiliado
    if (action === 'criar-instancia') {
      // 1. Verificar se cliente já existe
      const { data: existingCliente } = await supabase
        .from('clientes_afiliados')
        .select('*')
        .eq('user_id', user.id)
        .maybeSingle()

      if (existingCliente && existingCliente.wuzapi_token) {
        return new Response(
          JSON.stringify({ 
            success: true, 
            message: 'Cliente já possui instância',
            cliente: existingCliente 
          }),
          { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      // 2. Buscar token disponível
      const { data: tokenData, error: tokenError } = await supabase
        .from('wuzapi_tokens_afiliados')
        .select('*')
        .eq('em_uso', false)
        .is('cliente_afiliado_id', null)
        .limit(1)
        .maybeSingle()

      if (tokenError || !tokenData) {
        console.error('❌ Nenhum token disponível:', tokenError)
        return new Response(
          JSON.stringify({ success: false, error: 'Nenhum slot disponível. Entre em contato com o suporte.' }),
          { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }

      console.log('🎫 Token selecionado:', tokenData.token.substring(0, 8) + '...')

      // 3. Verificar afiliado que indicou (se houver)
      let afiliadoId = null
      if (afiliado_codigo) {
        const { data: afiliado } = await supabase
          .from('afiliados')
          .select('id')
          .eq('codigo_referencia', afiliado_codigo)
          .maybeSingle()
        
        if (afiliado) {
          afiliadoId = afiliado.id
          console.log('👥 Afiliado encontrado:', afiliadoId)
        }
      }

      // 4. Criar usuário no Wuzapi Contabo
      console.log('🔧 Criando usuário no Wuzapi Contabo...')
      
      const wuzapiResponse = await fetch(`${CONTABO_WUZAPI_URL}/admin/users`, {
        method: 'POST',
        headers: {
          'Authorization': CONTABO_WUZAPI_ADMIN_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          name: nome || user.email,
          token: tokenData.token
        })
      })

      const wuzapiResult = await wuzapiResponse.json()
      console.log('📡 Resposta Wuzapi:', wuzapiResult)

      // Se retornar 409 (user already exists), o token já está ativo no Wuzapi - isso é OK
      if (!wuzapiResponse.ok && wuzapiResult.code !== 409) {
        console.error('❌ Erro Wuzapi:', wuzapiResult)
        return new Response(
          JSON.stringify({ success: false, error: 'Erro ao criar instância no servidor' }),
          { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
        )
      }
      
      if (wuzapiResult.code === 409) {
        console.log('ℹ️ Token já existe no Wuzapi - continuando...')
      }

      // 5. Criar ou atualizar cliente_afiliado
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

      // 6. Marcar token como em uso
      await supabase
        .from('wuzapi_tokens_afiliados')
        .update({ em_uso: true, cliente_afiliado_id: cliente.id })
        .eq('id', tokenData.id)

      // 7. Atualizar contador do afiliado
      if (afiliadoId) {
        await supabase.rpc('increment_afiliado_indicacoes', { afiliado_uuid: afiliadoId })
        
        // Criar comissão inicial
        await supabase
          .from('comissoes')
          .insert({
            afiliado_id: afiliadoId,
            cliente_id: cliente.id,
            valor: 59.70, // 30% de R$ 199
            mes_referencia: new Date().toISOString().substring(0, 7),
            status: 'pendente'
          })
      }

      console.log('✅ Cliente criado com sucesso!')

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Instância criada com sucesso!',
          cliente: cliente
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ação: Conectar WhatsApp (obter QR Code)
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

      console.log('🔄 Forçando logout antes de gerar QR...')
      
      // 1) Força logout pra garantir QR novo
      try {
        await fetch(`${CONTABO_WUZAPI_URL}/session/logout`, {
          method: 'POST',
          headers: { 'Token': cliente.wuzapi_token }
        })
        console.log('✅ Logout executado')
      } catch (err) {
        console.log('⚠️ Erro no logout (normal se não estava conectado):', err)
      }

      // Aguarda 2 segundos para limpar sessão
      await new Promise((r) => setTimeout(r, 2000))

      // 2) Conecta (gera nova sessão)
      console.log('🔌 Conectando para gerar QR...')
      const connectResponse = await fetch(`${CONTABO_WUZAPI_URL}/session/connect`, {
        method: 'POST',
        headers: {
          'Token': cliente.wuzapi_token,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({})
      })
      const connectResultText = await connectResponse.text()
      console.log('📡 Resposta connect (raw):', connectResultText)

      // 3) Tenta pegar o QR algumas vezes (às vezes demora 1-2s)
      console.log('📷 Buscando QR Code...')
      let qrCode: string | null = null
      
      for (let i = 0; i < 5; i++) {
        const qrResponse = await fetch(`${CONTABO_WUZAPI_URL}/session/qr`, {
          method: 'GET',
          headers: { 'Token': cliente.wuzapi_token }
        })
        const qrText = await qrResponse.text()
        console.log(`📷 QR tentativa ${i + 1} (raw):`, qrText.substring(0, 100))

        try {
          const qrJson = JSON.parse(qrText)
          qrCode = qrJson?.QRCode || qrJson?.qrcode || null
        } catch {
          qrCode = null
        }

        if (qrCode) {
          console.log('✅ QR Code obtido com sucesso!')
          break
        }
        
        console.log(`⏳ Aguardando 1.2s antes de tentar novamente...`)
        await new Promise((r) => setTimeout(r, 1200))
      }

      if (!qrCode) {
        console.error('❌ QR Code não disponível após 5 tentativas')
      }

      return new Response(
        JSON.stringify({
          success: !!qrCode,
          qrCode,
          message: qrCode 
            ? 'Escaneie o QR Code com seu WhatsApp' 
            : 'QR Code não disponível. Aguarde 10 segundos e tente novamente.'
        }),
        { 
          status: qrCode ? 200 : 500, 
          headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
        }
      )
    }

    // Ação: Verificar status da conexão
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
        headers: {
          'Token': cliente.wuzapi_token
        }
      })

      const statusResult = await statusResponse.json()
      console.log('📊 Status:', statusResult)

      const isConnected = statusResult.LoggedIn === true || statusResult.loggedIn === true

      // Atualizar data de conexão se conectou
      if (isConnected && !cliente.data_conexao_whatsapp) {
        await supabase
          .from('clientes_afiliados')
          .update({ 
            data_conexao_whatsapp: new Date().toISOString(),
            wuzapi_jid: statusResult.Jid || statusResult.jid
          })
          .eq('id', cliente.id)
      }

      return new Response(
        JSON.stringify({ 
          success: true, 
          connected: isConnected,
          jid: statusResult.Jid || statusResult.jid,
          phone: statusResult.Phone || statusResult.phone
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ação: Desconectar WhatsApp
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
        headers: {
          'Token': cliente.wuzapi_token
        }
      })

      await supabase
        .from('clientes_afiliados')
        .update({ 
          data_conexao_whatsapp: null,
          wuzapi_jid: null
        })
        .eq('id', cliente.id)

      return new Response(
        JSON.stringify({ success: true, message: 'Desconectado com sucesso' }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Erro geral:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
