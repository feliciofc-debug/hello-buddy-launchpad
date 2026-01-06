import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.39.3'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

// URLs das extensões Chrome (armazenadas no Supabase Storage ou URLs públicas)
const EXTENSOES = {
  amazon: {
    nome: '🛒 Extensão Amazon',
    descricao: 'Capture produtos da Amazon e gere links de afiliado automaticamente',
    downloadUrl: 'https://jibpvpqgplmahjhswiza.supabase.co/storage/v1/object/public/extensoes/amz-affiliate-extension.zip',
    videoTutorial: 'https://youtube.com/watch?v=exemplo'
  },
  mercadolivre: {
    nome: '🏪 Extensão Mercado Livre',
    descricao: 'Importe produtos do Mercado Livre com links de afiliado prontos',
    downloadUrl: 'https://jibpvpqgplmahjhswiza.supabase.co/storage/v1/object/public/extensoes/ml-affiliate-extension.zip',
    videoTutorial: 'https://youtube.com/watch?v=exemplo2'
  },
  magalu: {
    nome: '🛍️ Extensão Magazine Luiza',
    descricao: 'Capture ofertas do Magalu com categorização automática',
    downloadUrl: 'https://jibpvpqgplmahjhswiza.supabase.co/storage/v1/object/public/extensoes/magalu-affiliate-extension.zip',
    videoTutorial: 'https://youtube.com/watch?v=exemplo3'
  },
  shopee: {
    nome: '🧡 Extensão Shopee',
    descricao: 'Importe produtos da Shopee com links de afiliado',
    downloadUrl: 'https://jibpvpqgplmahjhswiza.supabase.co/storage/v1/object/public/extensoes/shopee-affiliate-extension.zip',
    videoTutorial: 'https://youtube.com/watch?v=exemplo4'
  }
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const CONTABO_WUZAPI_URL = Deno.env.get('CONTABO_WUZAPI_URL') || 'https://api2.amzofertas.com.br'
    const SUPABASE_URL = Deno.env.get('SUPABASE_URL')!
    const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY)

    const body = await req.json()
    const { action, cliente_afiliado_id, user_id, extensoes_selecionadas } = body

    console.log('📧 Ação:', action, 'Cliente:', cliente_afiliado_id || user_id)

    // Ação: Enviar extensões via WhatsApp após pagamento
    if (action === 'enviar-extensoes') {
      // Buscar dados do cliente
      let cliente
      if (cliente_afiliado_id) {
        const { data, error } = await supabase
          .from('clientes_afiliados')
          .select('*')
          .eq('id', cliente_afiliado_id)
          .single()
        if (error) throw new Error('Cliente não encontrado')
        cliente = data
      } else if (user_id) {
        const { data, error } = await supabase
          .from('clientes_afiliados')
          .select('*')
          .eq('user_id', user_id)
          .single()
        if (error) throw new Error('Cliente não encontrado por user_id')
        cliente = data
      } else {
        throw new Error('cliente_afiliado_id ou user_id é obrigatório')
      }

      if (!cliente.telefone) {
        throw new Error('Cliente não tem telefone cadastrado')
      }

      // Token do admin/sistema para enviar mensagens de boas vindas
      // Usamos o token master da AMZ Ofertas
      const ADMIN_TOKEN = Deno.env.get('CONTABO_WUZAPI_ADMIN_TOKEN') || 'FDjUTGXYOt6Bp3TtYjSsjZlWOAPuxnPY'
      
      const telefone = cliente.telefone.replace(/\D/g, '')
      const telefoneFormatado = telefone.startsWith('55') ? telefone : `55${telefone}`

      console.log('📱 Enviando extensões para:', telefoneFormatado)

      // Mensagem de boas-vindas
      const msgBoasVindas = `🎉 *Parabéns ${cliente.nome}!*

Seu acesso ao AMZ Ofertas foi ativado com sucesso! 🚀

Agora você faz parte da nossa comunidade de afiliados que faturam divulgando produtos pelo WhatsApp.

Abaixo vou te enviar as extensões Chrome para você começar a capturar produtos:

*📌 Próximos passos:*
1. Baixe as extensões abaixo
2. Instale no Chrome (arraste para chrome://extensions)
3. Conecte seu WhatsApp no painel
4. Comece a capturar produtos e enviar ofertas!

Qualquer dúvida, me chama aqui! 💬`

      // Enviar mensagem de boas-vindas
      const response1 = await fetch(`${CONTABO_WUZAPI_URL}/chat/send/text`, {
        method: 'POST',
        headers: {
          'Token': ADMIN_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Phone: telefoneFormatado,
          Body: msgBoasVindas
        })
      })

      const result1 = await response1.json()
      console.log('📤 Mensagem boas-vindas:', result1)

      // Delay entre mensagens
      await new Promise(r => setTimeout(r, 2000))

      // Enviar links das extensões
      const extensoesParaEnviar = extensoes_selecionadas || ['amazon', 'mercadolivre', 'magalu', 'shopee']
      
      for (const extKey of extensoesParaEnviar) {
        const ext = EXTENSOES[extKey as keyof typeof EXTENSOES]
        if (!ext) continue

        const msgExtensao = `${ext.nome}

${ext.descricao}

📥 *Download:* ${ext.downloadUrl}

📺 *Tutorial:* ${ext.videoTutorial}`

        await fetch(`${CONTABO_WUZAPI_URL}/chat/send/text`, {
          method: 'POST',
          headers: {
            'Token': ADMIN_TOKEN,
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            Phone: telefoneFormatado,
            Body: msgExtensao
          })
        })

        console.log(`📤 Extensão ${extKey} enviada`)
        await new Promise(r => setTimeout(r, 1500))
      }

      // Mensagem final com link do painel
      const msgFinal = `✅ *Tudo pronto!*

Acesse seu painel para conectar o WhatsApp e começar:
👉 https://amzofertas.com.br/painel-afiliado

*Dica:* Já tenho alguns eBooks prontos para você usar como isca digital e capturar leads qualificados. Pergunte sobre nosso eBook de Receitas AirFryer! 🍳

Boas vendas! 🤝💰`

      await new Promise(r => setTimeout(r, 2000))
      
      await fetch(`${CONTABO_WUZAPI_URL}/chat/send/text`, {
        method: 'POST',
        headers: {
          'Token': ADMIN_TOKEN,
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          Phone: telefoneFormatado,
          Body: msgFinal
        })
      })

      // Registrar envio no banco
      await supabase
        .from('clientes_afiliados')
        .update({ 
          status: 'ativo',
          updated_at: new Date().toISOString()
        })
        .eq('id', cliente.id)

      console.log('✅ Extensões enviadas com sucesso!')

      return new Response(
        JSON.stringify({ 
          success: true, 
          message: 'Extensões enviadas via WhatsApp',
          telefone: telefoneFormatado
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    // Ação: Listar extensões disponíveis
    if (action === 'listar-extensoes') {
      return new Response(
        JSON.stringify({ 
          success: true, 
          extensoes: EXTENSOES
        }),
        { status: 200, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
      )
    }

    return new Response(
      JSON.stringify({ success: false, error: 'Ação não reconhecida' }),
      { status: 400, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )

  } catch (error: any) {
    console.error('❌ Erro:', error)
    return new Response(
      JSON.stringify({ success: false, error: error.message }),
      { status: 500, headers: { ...corsHeaders, 'Content-Type': 'application/json' } }
    )
  }
})
