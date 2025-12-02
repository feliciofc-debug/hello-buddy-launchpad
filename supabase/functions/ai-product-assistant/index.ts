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

    // Buscar TODOS os produtos do usuário
    const { data: produtos, error: produtosError } = await supabase
      .from('produtos')
      .select('*')
      .eq('user_id', userId)
      .eq('ativo', true)

    if (produtosError) {
      console.error('Erro ao buscar produtos:', produtosError)
      throw produtosError
    }

    console.log('📦 Produtos disponíveis:', produtos?.length || 0)

    // Buscar histórico da conversa (últimas 5 mensagens)
    const { data: messages } = await supabase
      .from('whatsapp_conversation_messages')
      .select('role, content')
      .eq('conversation_id', conversationId)
      .order('created_at', { ascending: true })
      .limit(5)

    const historico = messages?.map(m => 
      `${m.role === 'user' ? '👤 Cliente' : '🤖 Assistente'}: ${m.content}`
    ).join('\n') || ''

    // Criar contexto de produtos para IA
    const catalogoProdutos = produtos?.map(p => `
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
PRODUTO: ${p.nome}
Tipo: ${p.tipo === 'fisico' ? '📦 Produto Físico' : '🛠️ Serviço'}
Preço: R$ ${p.preco || '0'}
Estoque: ${p.estoque || 0} unidades
${p.descricao ? `Descrição: ${p.descricao}` : ''}
${p.ficha_tecnica ? `\n📋 FICHA TÉCNICA:\n${p.ficha_tecnica}` : ''}
${p.informacao_nutricional ? `\n🥗 INFORMAÇÃO NUTRICIONAL:\n${p.informacao_nutricional}` : ''}
${p.ingredientes ? `\n🧪 INGREDIENTES:\n${p.ingredientes}` : ''}
${p.modo_uso ? `\n📖 MODO DE USO:\n${p.modo_uso}` : ''}
${p.beneficios ? `\n✨ BENEFÍCIOS:\n${p.beneficios}` : ''}
${p.garantia ? `\n🛡️ GARANTIA: ${p.garantia}` : ''}
${p.dimensoes ? `\n📐 DIMENSÕES: ${p.dimensoes}` : ''}
${p.peso ? `\n⚖️ PESO: ${p.peso}` : ''}
${p.cor ? `\n🎨 CORES: ${p.cor}` : ''}
${p.tamanhos ? `\n📏 TAMANHOS: ${p.tamanhos}` : ''}
ID_PRODUTO: ${p.id}
IMAGEM: ${p.imagem_url || 'Não disponível'}
LINK_PAGAMENTO: ${p.link_marketplace || 'Não disponível'}
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    `).join('\n\n') || 'Nenhum produto cadastrado'

    // Chamar Lovable AI
    const LOVABLE_API_KEY = Deno.env.get('LOVABLE_API_KEY')
    
    const prompt = `Você é um assistente de vendas inteligente e HUMANIZADO.

═══════════════════════════════════════════════════════════
📚 CATÁLOGO COMPLETO DE PRODUTOS:
═══════════════════════════════════════════════════════════
${catalogoProdutos}

═══════════════════════════════════════════════════════════
💬 HISTÓRICO DA CONVERSA:
═══════════════════════════════════════════════════════════
${historico}

═══════════════════════════════════════════════════════════
✉️ MENSAGEM DO CLIENTE:
═══════════════════════════════════════════════════════════
${mensagemCliente}

═══════════════════════════════════════════════════════════
🎯 SUAS INSTRUÇÕES:
═══════════════════════════════════════════════════════════

1. 🔍 ANÁLISE: Se o cliente pergunta sobre:
   - FICHA TÉCNICA, ESPECIFICAÇÕES, DADOS TÉCNICOS → Use os detalhes técnicos do produto
   - INFORMAÇÃO NUTRICIONAL, TABELA NUTRICIONAL → Use info_nutricional
   - INGREDIENTES, COMPOSIÇÃO → Use ingredientes
   - MODO DE USO, COMO USAR → Use modo_uso
   - BENEFÍCIOS, VANTAGENS → Use beneficios
   - GARANTIA → Use garantia
   - TAMANHOS, CORES, DIMENSÕES, PESO → Use os campos específicos

2. 🔄 TROCA DE PRODUTO: Se cliente pede OUTRO PRODUTO diferente:
   - Identifique qual produto ele quer do catálogo
   - Recomende com entusiasmo
   - IMPORTANTE: Retorne o product_id no JSON

3. ⚖️ COMPARAÇÃO: Se cliente compara produtos → Mostre diferenças claras

4. 📦 RECOMENDAÇÃO: Quando recomendar produto, SEMPRE inclua:
   - Nome do produto
   - Preço
   - Descrição principal
   - Benefícios principais
   - Diga: "Posso te enviar a foto?"

5. 💬 TOM: HUMANIZADO, breve (2-4 linhas), natural, use "vc", "tá", emojis moderados

═══════════════════════════════════════════════════════════
📤 FORMATO DE RESPOSTA (JSON):
═══════════════════════════════════════════════════════════
{
  "mensagem": "sua resposta humanizada ao cliente",
  "produto_recomendado_id": "id_do_produto ou null",
  "enviar_foto": true ou false,
  "tipo_informacao": "tecnica" | "nutricional" | "geral" | "outro_produto" | "comparacao"
}

SEJA NATURAL E VENDEDOR! 🚀`

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
        max_tokens: 1000,
        temperature: 0.8
      })
    })

    if (!response.ok) {
      throw new Error(`AI API error: ${response.status}`)
    }

    const aiData = await response.json()
    const aiText = aiData.choices[0].message.content

    console.log('🤖 Resposta IA:', aiText)

    // Tentar parse JSON
    let resposta
    try {
      resposta = JSON.parse(aiText)
    } catch {
      // Se não é JSON, criar estrutura
      resposta = {
        mensagem: aiText,
        produto_recomendado_id: null,
        enviar_foto: false,
        tipo_informacao: 'geral'
      }
    }

    // Se IA recomendou produto, buscar detalhes
    let produtoDetalhes = null
    if (resposta.produto_recomendado_id) {
      const { data: produto } = await supabase
        .from('produtos')
        .select('*')
        .eq('id', resposta.produto_recomendado_id)
        .single()
      
      produtoDetalhes = produto
      console.log('📦 Produto recomendado:', produto?.nome)
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
    console.error('❌ Erro:', error)
    return new Response(JSON.stringify({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error'
    }), { 
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
