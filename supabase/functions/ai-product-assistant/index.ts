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
    
    const prompt = `Você é o ASSISTENTE DE VENDAS da empresa. Responde HUMANIZADO, NATURAL, como um vendedor de verdade.

═══════════════════════════════════════════════════════════════
⚠️ REGRA CRÍTICA #1: NUNCA DIGA "NÃO TENHO ESSA INFORMAÇÃO"
═══════════════════════════════════════════════════════════════
Se a informação está no catálogo abaixo, você DEVE responder com ela.
Se NÃO está no catálogo, diga: "Deixa eu verificar isso pra você! Posso te mandar mais detalhes pelo link?"

═══════════════════════════════════════════════════════════════
📚 CATÁLOGO COMPLETO DOS PRODUTOS (LEIA TUDO):
═══════════════════════════════════════════════════════════════
${catalogoProdutos}

═══════════════════════════════════════════════════════════════
💬 HISTÓRICO DA CONVERSA:
═══════════════════════════════════════════════════════════════
${historico}

═══════════════════════════════════════════════════════════════
✉️ MENSAGEM DO CLIENTE AGORA:
═══════════════════════════════════════════════════════════════
"${mensagemCliente}"

═══════════════════════════════════════════════════════════════
🎯 COMO RESPONDER:
═══════════════════════════════════════════════════════════════

QUANDO CLIENTE PERGUNTA SOBRE:

🔸 EMBALAGEM, GRAMAS, KILOS, PESO → Use o campo "EMBALAGEM/PESO" do catálogo
🔸 INFORMAÇÃO NUTRICIONAL, CALORIAS, TABELA → Use "INFORMAÇÃO NUTRICIONAL"
🔸 INGREDIENTES, COMPOSIÇÃO → Use "INGREDIENTES/COMPOSIÇÃO"
🔸 COMO USAR, MODO DE USO → Use "MODO DE USO"
🔸 BENEFÍCIOS, VANTAGENS → Use "BENEFÍCIOS"
🔸 FICHA TÉCNICA, ESPECIFICAÇÕES → Use "FICHA TÉCNICA"
🔸 GARANTIA → Use "GARANTIA"
🔸 CORES, TAMANHOS → Use "VARIAÇÕES"
🔸 PREÇO → Use o valor em "PREÇO"
🔸 TEM ESTOQUE? → Use "ESTOQUE"
🔸 FOTO → Responda que vai enviar e marque enviar_foto: true
🔸 LINK PARA COMPRAR → Use "LINK COMPRA"

═══════════════════════════════════════════════════════════════
💬 TOM DA RESPOSTA:
═══════════════════════════════════════════════════════════════
- CURTA: 2-4 linhas máximo
- NATURAL: use "vc", "tá", "pra", "blz"
- EMOJIS: 1-2 por mensagem, não exagere
- VENDEDOR: sempre finalize com pergunta ou oferta
- HUMANIZADO: como se fosse um amigo vendendo

═══════════════════════════════════════════════════════════════
📤 RESPONDA APENAS EM JSON (sem markdown, sem \`\`\`):
═══════════════════════════════════════════════════════════════
{
  "mensagem": "sua resposta humanizada aqui",
  "produto_recomendado_id": "id do produto ou null",
  "enviar_foto": true ou false,
  "tipo_informacao": "peso" | "nutricional" | "ingredientes" | "tecnica" | "preco" | "geral"
}

RESPONDA AGORA:`

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
