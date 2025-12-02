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

  try {
    const { mensagemCliente, conversationId, userId } = await req.json()

    console.log('🤖 AI Product Assistant iniciado', { mensagemCliente, conversationId, userId })

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )

    // Buscar TODOS os produtos do usuário com TODOS os campos
    const { data: produtos, error: produtosError } = await supabase
      .from('produtos')
      .select('id, nome, descricao, preco, estoque, imagem_url, link_marketplace, tipo, ficha_tecnica, informacao_nutricional, ingredientes, modo_uso, beneficios, garantia, dimensoes, peso, cor, tamanhos, categoria, sku, tags')
      .eq('user_id', userId)
      .eq('ativo', true)

    if (produtosError) {
      console.error('❌ Erro ao buscar produtos:', produtosError)
      throw produtosError
    }

    console.log('📦 Produtos disponíveis:', produtos?.length || 0)

    // LOG DETALHADO DOS PRODUTOS PARA DEBUG
    produtos?.forEach((p, i) => {
      console.log(`📦 Produto ${i + 1}: ${p.nome}`)
      console.log(`   💰 Preço: R$ ${p.preco}`)
      console.log(`   ⚖️ Peso: ${p.peso || 'NÃO CADASTRADO'}`)
      console.log(`   📐 Dimensões: ${p.dimensoes || 'NÃO CADASTRADO'}`)
      console.log(`   🥗 Info Nutricional: ${p.informacao_nutricional ? 'SIM' : 'NÃO CADASTRADO'}`)
      console.log(`   📋 Ficha Técnica: ${p.ficha_tecnica ? 'SIM' : 'NÃO CADASTRADO'}`)
    })

    // Buscar histórico da conversa (últimas 10 mensagens)
    const { data: messages } = await supabase
      .from('whatsapp_conversation_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(10)

    const historico = messages?.map(m => 
      `${m.role === 'user' ? '👤 Cliente' : '🤖 Você respondeu'}: ${m.content}`
    ).join('\n') || 'Primeira mensagem do cliente'

    // Criar CATÁLOGO SUPER DETALHADO para IA
    const catalogoProdutos = produtos?.map(p => {
      let ficha = `
╔══════════════════════════════════════════════════════════╗
║ 📦 PRODUTO: ${p.nome}
║ 🆔 ID: ${p.id}
╠══════════════════════════════════════════════════════════╣
║ 💰 PREÇO: R$ ${p.preco || '0,00'}
║ 📊 ESTOQUE: ${p.estoque || 0} unidades disponíveis
║ 📂 TIPO: ${p.tipo === 'fisico' ? 'Produto Físico' : p.tipo === 'servico' ? 'Serviço' : 'Produto'}
${p.categoria ? `║ 🏷️ CATEGORIA: ${p.categoria}` : ''}
${p.sku ? `║ 🔢 SKU: ${p.sku}` : ''}
╠══════════════════════════════════════════════════════════╣`

      if (p.descricao) {
        ficha += `
║ 📝 DESCRIÇÃO:
║ ${p.descricao}
╠══════════════════════════════════════════════════════════╣`
      }

      // PESO E DIMENSÕES (EMBALAGEM)
      if (p.peso || p.dimensoes) {
        ficha += `
║ 📦 EMBALAGEM/PESO:
${p.peso ? `║ • Peso: ${p.peso}` : ''}
${p.dimensoes ? `║ • Dimensões: ${p.dimensoes}` : ''}
╠══════════════════════════════════════════════════════════╣`
      }

      // FICHA TÉCNICA
      if (p.ficha_tecnica) {
        ficha += `
║ 📋 FICHA TÉCNICA / ESPECIFICAÇÕES:
║ ${p.ficha_tecnica.split('\n').join('\n║ ')}
╠══════════════════════════════════════════════════════════╣`
      }

      // INFORMAÇÃO NUTRICIONAL
      if (p.informacao_nutricional) {
        ficha += `
║ 🥗 INFORMAÇÃO NUTRICIONAL:
║ ${p.informacao_nutricional.split('\n').join('\n║ ')}
╠══════════════════════════════════════════════════════════╣`
      }

      // INGREDIENTES
      if (p.ingredientes) {
        ficha += `
║ 🧪 INGREDIENTES/COMPOSIÇÃO:
║ ${p.ingredientes.split('\n').join('\n║ ')}
╠══════════════════════════════════════════════════════════╣`
      }

      // MODO DE USO
      if (p.modo_uso) {
        ficha += `
║ 📖 MODO DE USO:
║ ${p.modo_uso.split('\n').join('\n║ ')}
╠══════════════════════════════════════════════════════════╣`
      }

      // BENEFÍCIOS
      if (p.beneficios) {
        ficha += `
║ ✨ BENEFÍCIOS:
║ ${p.beneficios.split('\n').join('\n║ ')}
╠══════════════════════════════════════════════════════════╣`
      }

      // GARANTIA
      if (p.garantia) {
        ficha += `
║ 🛡️ GARANTIA: ${p.garantia}
╠══════════════════════════════════════════════════════════╣`
      }

      // CORES E TAMANHOS
      if (p.cor || p.tamanhos) {
        ficha += `
║ 🎨 VARIAÇÕES:
${p.cor ? `║ • Cores disponíveis: ${p.cor}` : ''}
${p.tamanhos ? `║ • Tamanhos disponíveis: ${p.tamanhos}` : ''}
╠══════════════════════════════════════════════════════════╣`
      }

      // LINKS
      ficha += `
║ 🖼️ IMAGEM: ${p.imagem_url || 'Não disponível'}
║ 🛒 LINK COMPRA: ${p.link_marketplace || 'Não disponível'}
╚══════════════════════════════════════════════════════════╝`

      return ficha
    }).join('\n\n') || '❌ Nenhum produto cadastrado no sistema'

    console.log('📋 Catálogo montado com sucesso')

    // Chamar Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    
    const prompt = `Você é um vendedor atencioso da AMZ Ofertas pelo WhatsApp.

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 REGRAS ABSOLUTAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ❌ NUNCA peça CEP, endereço ou calcule frete
2. ❌ NUNCA mencione estoque/quantidade
3. ❌ NUNCA dê informações que não foram pedidas
4. ✅ Responda APENAS o que foi perguntado
5. ✅ Seja breve, natural e humanizado
6. ✅ Use emojis COM MODERAÇÃO (máximo 1-2)
7. ✅ Sempre termine perguntando se quer algo mais

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 PRODUTOS DISPONÍVEIS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${catalogoProdutos}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 HISTÓRICO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${historico}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ CLIENTE PERGUNTOU:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"${mensagemCliente}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 GUIA DE RESPOSTAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SE PERGUNTA: "Tem [produto]?"
→ "Sim! [PRODUTO] por R$ [PREÇO] 😊 Quer?"

SE PERGUNTA: "Quanto custa?"
→ "R$ [PREÇO]. Quer levar?"

SE PERGUNTA: "Tem foto?"
→ "Claro! Já envio 📸"
→ RETORNE: enviar_foto: true

SE PERGUNTA: "Info nutricional?"
→ [Dê a informação nutricional do produto]

SE PERGUNTA: "Ingredientes?"
→ [Liste os ingredientes]

SE PERGUNTA: "Ficha técnica?"
→ [Dê as especificações técnicas]

SE PERGUNTA: "Como comprar?" ou "Quero comprar"
→ "Clica no link que te enviei antes: [link do produto]. Lá você finaliza a compra e vê o frete 😊"

SE PERGUNTA: "Quanto é o frete?" ou "CEP" ou "Entrega"
→ "O frete aparece na hora de fechar a compra no link 😊 Cada região tem um valor diferente."

SE PERGUNTA: "Oi" ou "Bom dia"
→ "Oi! 😊 Posso te ajudar?"

SE QUER OUTRO PRODUTO:
→ "Legal! Temos [PRODUTO] por R$ [PREÇO]. Quer ver?"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❌ NUNCA FAÇA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- ❌ "Pode me passar seu CEP?"
- ❌ "Vou calcular o frete pra você"
- ❌ "Temos 300 unidades"
- ❌ "Deixa eu ver o estoque"
- ❌ "O prazo de entrega é..."
- ❌ Dar informações não solicitadas
- ❌ Falar sobre entrega sem perguntar

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✅ SEMPRE FAÇA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

- ✅ Seja direto e objetivo
- ✅ Responda só o que foi pedido
- ✅ Para frete → Direcione pro checkout/link
- ✅ Seja natural como vendedor real
- ✅ Termine com pergunta simples

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 FORMATO DE RESPOSTA JSON:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "mensagem": "sua resposta CURTA",
  "produto_recomendado_id": "UUID se recomendar",
  "enviar_foto": true/false
}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ EXEMPLOS PERFEITOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cliente: "Quanto é o frete?"
✅ CORRETO: "O frete aparece na hora de fechar a compra no link 😊"
❌ ERRADO: "Me passa seu CEP que eu calculo o frete pra você"

Cliente: "Tem arroz?"
✅ CORRETO: "Sim! Arroz por R$ 3,90. Quer?"
❌ ERRADO: "Sim! Temos Arroz por R$ 3,90 e temos 500 unidades!"

Cliente: "Como compro?"
✅ CORRETO: "Clica no link que te enviei. Lá você finaliza e vê o frete 😊"
❌ ERRADO: "Me passa seu endereço que eu vejo o frete"

Cliente: "Tem foto?"
✅ CORRETO: "Já envio! 📸"
❌ ERRADO: "Sim! Vou te enviar a foto do produto agora mesmo!"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEMBRE-SE: MENOS É MAIS! Seja BREVE!

Responda AGORA em JSON:`

    const response = await fetch('https://ai.gateway.lovable.dev/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${LOVABLE_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        model: 'google/gemini-2.5-flash',
        messages: [{
          role: 'user',
          content: prompt
        }],
        max_tokens: 500,
        temperature: 0.7
      })
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('❌ Erro API Lovable:', response.status, errorText)
      throw new Error(`AI API error: ${response.status}`)
    }

    const aiData = await response.json()
    const aiText = aiData.choices[0]?.message?.content || ''

    console.log('🤖 Resposta IA bruta:', aiText)

    // Parse JSON - remover markdown se houver
    let resposta
    try {
      const textoLimpo = aiText
        .replace(/```json\n?/g, '')
        .replace(/```\n?/g, '')
        .trim()
      resposta = JSON.parse(textoLimpo)
      console.log('✅ JSON parseado com sucesso')
    } catch (parseError) {
      console.log('⚠️ Não foi JSON, usando texto direto')
      resposta = {
        mensagem: aiText.replace(/```json\n?/g, '').replace(/```\n?/g, '').replace(/[{}"\n]/g, ' ').trim(),
        produto_recomendado_id: null,
        enviar_foto: false,
        tipo_informacao: 'geral'
      }
    }

    // Se IA recomendou produto, buscar detalhes completos
    let produtoDetalhes = null
    if (resposta.produto_recomendado_id) {
      const { data: produto } = await supabase
        .from('produtos')
        .select('*')
        .eq('id', resposta.produto_recomendado_id)
        .single()
      
      produtoDetalhes = produto
      console.log('📦 Produto recomendado carregado:', produto?.nome)
    }

    return new Response(JSON.stringify({
      success: true,
      mensagem: resposta.mensagem,
      produto_recomendado: produtoDetalhes,
      enviar_foto: resposta.enviar_foto || false,
      tipo_informacao: resposta.tipo_informacao || 'geral'
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })

  } catch (error) {
    console.error('❌ Erro fatal:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      mensagem: 'Ops, tive um probleminha aqui! Pode repetir a pergunta? 😅'
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
