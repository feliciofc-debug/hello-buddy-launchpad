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
    const { mensagemCliente, conversationId, userId, phone } = await req.json()
    
    const supabase = createClient(
      Deno.env.get('SUPABASE_URL')!,
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    )
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🤖 IA SIMPLES v2.0 - COM LINKS AUTOMÁTICOS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('💬 Mensagem:', mensagemCliente)
    console.log('📱 Phone:', phone)
    console.log('🆔 Conversation:', conversationId)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Buscar TODOS os produtos do usuário
    const { data: produtos, error: produtosError } = await supabase
      .from('produtos')
      .select('*')
      .eq('user_id', userId)
      .eq('ativo', true)
    
    if (produtosError) {
      console.error('❌ Erro ao buscar produtos:', produtosError)
    }
    
    console.log('📦 Total produtos:', produtos?.length || 0)
    produtos?.forEach((p, i) => {
      console.log(`   ${i + 1}. ${p.nome} - R$ ${p.preco} (ID: ${p.id})`)
    })
    
    // Buscar histórico da conversa
    const { data: messages } = await supabase
      .from('whatsapp_conversation_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('sent_at', { ascending: false })
      .limit(10)
    
    console.log('📜 Histórico:', messages?.length || 0, 'mensagens')
    
    const msgLower = mensagemCliente.toLowerCase()
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '') // Remove acentos para comparação
    
    // ═══════════════════════════════════════════════════════
    // LÓGICA 1: MAPEAMENTO DE PALAVRAS-CHAVE PARA PRODUTOS
    // ═══════════════════════════════════════════════════════
    
    // Palavras-chave específicas para cada tipo de produto
    const palavrasChaveProdutos: Record<string, string[]> = {
      'mandioca': ['mandioca', 'farinha de mandioca'],
      'trigo': ['trigo', 'farinha de trigo'],
      'arroz': ['arroz'],
      'feijao': ['feijao', 'feijão', 'feijao preto', 'feijão preto'],
      'milho': ['milho', 'flocao', 'flocão', 'flocao de milho'],
      'manteiga': ['manteiga'],
      'bico': ['bico', 'grao de bico', 'grão de bico', 'graodebico']
    }
    
    let produtoIdentificado: any = null
    let palavraEncontrada = ''
    let metodoIdentificacao = ''
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔍 ETAPA 1: Procurando na mensagem atual')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // PRIORIDADE 1: Procurar palavra-chave ESPECÍFICA na mensagem
    // Ordenar palavras-chave por tamanho (maior primeiro) para match mais específico
    const todasPalavras: {tipo: string, palavra: string}[] = []
    for (const [tipo, palavras] of Object.entries(palavrasChaveProdutos)) {
      for (const palavra of palavras) {
        todasPalavras.push({ tipo, palavra: palavra.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '') })
      }
    }
    todasPalavras.sort((a, b) => b.palavra.length - a.palavra.length)
    
    for (const { tipo, palavra } of todasPalavras) {
      if (msgLower.includes(palavra)) {
        palavraEncontrada = palavra
        console.log(`   ✅ Palavra-chave encontrada: "${palavra}" (tipo: ${tipo})`)
        
        // Buscar produto que contenha essa palavra no nome
        produtoIdentificado = produtos?.find(p => {
          const nomeLower = p.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
          return nomeLower.includes(palavra) || nomeLower.includes(tipo)
        })
        
        if (produtoIdentificado) {
          metodoIdentificacao = 'mensagem_atual'
          console.log(`   ✅ Produto encontrado: ${produtoIdentificado.nome}`)
          break
        } else {
          console.log(`   ⚠️ Palavra "${palavra}" encontrada mas sem produto correspondente`)
        }
      }
    }
    
    // PRIORIDADE 2: Se não encontrou na mensagem, buscar no histórico recente
    if (!produtoIdentificado && messages && messages.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🔍 ETAPA 2: Procurando no histórico')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      for (const msg of messages) {
        if (produtoIdentificado) break
        
        const msgHistorico = (msg.message || '').toLowerCase()
          .normalize('NFD')
          .replace(/[\u0300-\u036f]/g, '')
        
        for (const { tipo, palavra } of todasPalavras) {
          if (msgHistorico.includes(palavra)) {
            console.log(`   🔍 Histórico contém: "${palavra}"`)
            
            produtoIdentificado = produtos?.find(p => {
              const nomeLower = p.nome.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
              return nomeLower.includes(palavra) || nomeLower.includes(tipo)
            })
            
            if (produtoIdentificado) {
              metodoIdentificacao = 'historico'
              palavraEncontrada = palavra
              console.log(`   ✅ Produto do histórico: ${produtoIdentificado.nome}`)
              break
            }
          }
        }
      }
    }
    
    // PRIORIDADE 3: Buscar produto da conversa (metadata)
    if (!produtoIdentificado && conversationId) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🔍 ETAPA 3: Buscando na conversa')
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      
      const { data: conversa } = await supabase
        .from('whatsapp_conversations')
        .select('metadata, produto_id')
        .eq('id', conversationId)
        .single()
      
      if (conversa?.produto_id) {
        const { data: produtoConversa } = await supabase
          .from('produtos')
          .select('*')
          .eq('id', conversa.produto_id)
          .single()
        
        if (produtoConversa) {
          produtoIdentificado = produtoConversa
          metodoIdentificacao = 'conversa_metadata'
          console.log(`   ✅ Produto da conversa: ${produtoIdentificado.nome}`)
        }
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📦 RESULTADO IDENTIFICAÇÃO:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('   Produto:', produtoIdentificado?.nome || 'NENHUM')
    console.log('   Método:', metodoIdentificacao || 'N/A')
    console.log('   Palavra:', palavraEncontrada || 'N/A')
    
    // ═══════════════════════════════════════════════════════
    // LÓGICA 2: DETECTAR INTENÇÃO DO CLIENTE
    // ═══════════════════════════════════════════════════════
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🎯 DETECTANDO INTENÇÃO')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    const querComprar = 
      msgLower.includes('quero') ||
      msgLower.includes('vou levar') ||
      msgLower.includes('vou querer') ||
      msgLower.includes('quero comprar') ||
      msgLower.includes('gostaria de') ||
      msgLower.includes('pode ser') ||
      msgLower.includes('fechou') ||
      msgLower.includes('fecha') ||
      msgLower.includes('manda o link') ||
      msgLower.includes('manda link') ||
      msgLower.includes('como compro') ||
      (msgLower === 'sim') ||
      (msgLower === 'ok') ||
      (msgLower === 'beleza')
    
    const querPreco =
      msgLower.includes('preco') ||
      msgLower.includes('quanto custa') ||
      msgLower.includes('quanto e') ||
      msgLower.includes('valor') ||
      msgLower.includes('quanto')
    
    const querFoto =
      msgLower.includes('foto') ||
      msgLower.includes('imagem') ||
      msgLower.includes('ver produto')
    
    const temProduto = msgLower.includes('tem ')
    
    const saudacao =
      msgLower.includes('oi') ||
      msgLower.includes('ola') ||
      msgLower.includes('bom dia') ||
      msgLower.includes('boa tarde') ||
      msgLower.includes('boa noite') ||
      msgLower.includes('eae') ||
      msgLower.includes('e ai')
    
    const agradecimento =
      msgLower.includes('obrigad') ||
      msgLower.includes('valeu') ||
      msgLower.includes('thanks')
    
    console.log('   querComprar:', querComprar)
    console.log('   querPreco:', querPreco)
    console.log('   querFoto:', querFoto)
    console.log('   temProduto:', temProduto)
    console.log('   saudacao:', saudacao)
    console.log('   agradecimento:', agradecimento)
    
    // ═══════════════════════════════════════════════════════
    // LÓGICA 3: VERIFICAR SE É PRODUTO DE ALTO VALOR
    // ═══════════════════════════════════════════════════════
    
    const ehAltoValor = (produto: any) => {
      if (!produto) return false
      const precoNum = parseFloat(produto.preco) || 0
      
      // Se preço > R$ 10.000 = alto valor
      if (precoNum > 10000) return true
      
      // Ou se nome indica alto valor
      const nomeL = produto.nome.toLowerCase()
      if (nomeL.includes('imóvel') || 
          nomeL.includes('imovel') || 
          nomeL.includes('casa') || 
          nomeL.includes('apartamento') ||
          nomeL.includes('carro') ||
          nomeL.includes('veículo') ||
          nomeL.includes('veiculo')) {
        return true
      }
      
      return false
    }
    
    // ═══════════════════════════════════════════════════════
    // LÓGICA 4: GERAR RESPOSTA COM LINKS AUTOMÁTICOS
    // ═══════════════════════════════════════════════════════
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('💬 GERANDO RESPOSTA PREMIUM COM LINKS')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    let resposta = ''
    let enviarLink = false
    let enviarFoto = false
    let linkMensagem = ''
    
    // Formatar preço
    const formatarPreco = (preco: number) => {
      return preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }
    
    // ═══════════════════════════════════════════════════════
    // REGRA #1: SEMPRE INCLUIR LINK QUANDO MENCIONAR PRODUTO
    // ═══════════════════════════════════════════════════════
    const gerarLinkProduto = (produto: any): string => {
      const link = produto.checkout_url || produto.link_marketplace || produto.link
      if (!link) return ''
      return `\n👉 Ver produto: ${link}`
    }
    
    const gerarLinkMensagem = (produto: any, altoValor: boolean) => {
      const preco = formatarPreco(produto.preco || 0)
      const link = produto.checkout_url || produto.link_marketplace || produto.link || 'https://amzofertas.com.br/checkout'
      
      if (altoValor) {
        return `📋 *${produto.nome}*
💰 *${preco}*

🔗 *Mais informações e fotos:*
${link}

Entre em contato para mais detalhes! 📞`
      } else {
        return `🛒 *Finalize sua compra:*

${link}

📦 *${produto.nome}*
💰 *${preco}*

_Escolha quantidade e finalize!_ ✅

O frete aparece na finalização! 😊`
      }
    }
    
    // Gerar resposta com informações técnicas se perguntado
    const perguntaTecnica = 
      msgLower.includes('ingrediente') ||
      msgLower.includes('nutricional') ||
      msgLower.includes('calorias') ||
      msgLower.includes('proteina') ||
      msgLower.includes('ficha') ||
      msgLower.includes('especificacao') ||
      msgLower.includes('tecnico') ||
      msgLower.includes('detalhe') ||
      msgLower.includes('informacao') ||
      msgLower.includes('composicao') ||
      msgLower.includes('gluten') ||
      msgLower.includes('lactose') ||
      msgLower.includes('modo de uso') ||
      msgLower.includes('como usa') ||
      msgLower.includes('beneficio')
    
    const perguntaEstoque =
      msgLower.includes('estoque') ||
      msgLower.includes('disponivel') ||
      msgLower.includes('disponível') ||
      msgLower.includes('tem em estoque') ||
      msgLower.includes('quantas unidades')
    
    const perguntaComparacao =
      msgLower.includes('diferenca') ||
      msgLower.includes('diferença') ||
      msgLower.includes('melhor') ||
      msgLower.includes('comparar') ||
      msgLower.includes('qual escolher')
    
    const perguntaRecomendacao =
      msgLower.includes('recomenda') ||
      msgLower.includes('indica') ||
      msgLower.includes('sugere') ||
      msgLower.includes('pra ganhar massa') ||
      msgLower.includes('para emagrecer') ||
      msgLower.includes('o que voce indica')
    
    // CASO 1: Cliente quer comprar E temos produto identificado
    if (querComprar && produtoIdentificado) {
      const altoValor = ehAltoValor(produtoIdentificado)
      const preco = formatarPreco(produtoIdentificado.preco || 0)
      
      if (altoValor) {
        resposta = `Ótimo! Vou te passar o link com todas as informações e fotos 😊`
      } else {
        resposta = `Perfeito! ${produtoIdentificado.nome} por ${preco}${gerarLinkProduto(produtoIdentificado)}`
      }
      
      enviarLink = true
      linkMensagem = gerarLinkMensagem(produtoIdentificado, altoValor)
      console.log('   📌 CASO: Quer comprar + produto identificado')
    }
    
    // CASO 2: Pergunta técnica (ingredientes, nutricional, modo de uso)
    else if (perguntaTecnica && produtoIdentificado) {
      const p = produtoIdentificado
      let detalhes = ''
      
      if (p.informacao_nutricional && (msgLower.includes('nutricional') || msgLower.includes('calorias') || msgLower.includes('proteina'))) {
        detalhes = `📊 *Informação Nutricional:*\n${p.informacao_nutricional}`
      } else if (p.ingredientes && (msgLower.includes('ingrediente') || msgLower.includes('composicao') || msgLower.includes('gluten') || msgLower.includes('lactose'))) {
        detalhes = `🧪 *Ingredientes:*\n${p.ingredientes}`
      } else if (p.modo_uso && (msgLower.includes('modo de uso') || msgLower.includes('como usa'))) {
        detalhes = `📋 *Modo de Uso:*\n${p.modo_uso}`
      } else if (p.beneficios && msgLower.includes('beneficio')) {
        detalhes = `✨ *Benefícios:*\n${p.beneficios}`
      } else if (p.ficha_tecnica) {
        detalhes = `📋 *Ficha Técnica:*\n${p.ficha_tecnica}`
      } else if (p.especificacoes) {
        detalhes = `📋 *Especificações:*\n${p.especificacoes}`
      } else {
        detalhes = `📦 ${p.nome}\n${p.descricao || 'Produto de qualidade!'}`
      }
      
      const preco = formatarPreco(p.preco || 0)
      resposta = `${detalhes}\n\n💰 ${preco}${gerarLinkProduto(p)}`
      
      enviarLink = true
      linkMensagem = gerarLinkMensagem(p, ehAltoValor(p))
      console.log('   📌 CASO: Pergunta técnica')
    }
    
    // CASO 3: Pergunta sobre estoque
    else if (perguntaEstoque && produtoIdentificado) {
      const p = produtoIdentificado
      const preco = formatarPreco(p.preco || 0)
      const estoque = p.estoque || 0
      
      if (estoque > 10) {
        resposta = `Temos bastante estoque de ${p.nome}! 📦\n💰 ${preco}${gerarLinkProduto(p)}`
      } else if (estoque > 0) {
        resposta = `Temos ${estoque} unidades de ${p.nome}! ⚠️ Corre que tá acabando!\n💰 ${preco}${gerarLinkProduto(p)}`
      } else {
        resposta = `Poxa, ${p.nome} está em falta no momento 😔 Mas posso te avisar quando chegar!`
      }
      
      if (estoque > 0) {
        enviarLink = true
        linkMensagem = gerarLinkMensagem(p, ehAltoValor(p))
      }
      console.log('   📌 CASO: Pergunta estoque')
    }
    
    // CASO 4: Recomendação
    else if (perguntaRecomendacao && produtos && produtos.length > 0) {
      // Recomendar até 3 produtos relevantes
      const produtosRecomendados = produtos.slice(0, 3)
      let recomendacao = `Olha só o que eu recomendo! 💡\n\n`
      
      produtosRecomendados.forEach((p, i) => {
        const preco = formatarPreco(p.preco || 0)
        const link = p.checkout_url || p.link_marketplace || p.link
        recomendacao += `${i + 1}️⃣ *${p.nome}* - ${preco}\n`
        if (p.descricao) recomendacao += `   ${p.descricao.substring(0, 80)}...\n`
        if (link) recomendacao += `   👉 ${link}\n`
        recomendacao += `\n`
      })
      
      recomendacao += `Qual te interessa mais? 😊`
      resposta = recomendacao
      console.log('   📌 CASO: Recomendação')
    }
    
    // CASO 5: Cliente pergunta preço E temos produto
    else if (querPreco && produtoIdentificado) {
      const preco = formatarPreco(produtoIdentificado.preco || 0)
      const estoque = produtoIdentificado.estoque || 0
      
      let infoEstoque = ''
      if (estoque > 10) {
        infoEstoque = ' Temos em estoque! 📦'
      } else if (estoque > 0) {
        infoEstoque = ` Últimas ${estoque} unidades! ⚠️`
      } else {
        infoEstoque = ' (Produto em falta no momento)'
      }
      
      resposta = `${produtoIdentificado.nome} custa ${preco}.${infoEstoque}${gerarLinkProduto(produtoIdentificado)}`
      
      if (estoque > 0) {
        enviarLink = true
        linkMensagem = gerarLinkMensagem(produtoIdentificado, ehAltoValor(produtoIdentificado))
      }
      console.log('   📌 CASO: Pergunta preço')
    }
    
    // CASO 6: Cliente quer foto E temos produto
    else if (querFoto && produtoIdentificado) {
      resposta = `Te envio a foto agora! 📸${gerarLinkProduto(produtoIdentificado)}`
      enviarFoto = true
      enviarLink = true
      linkMensagem = gerarLinkMensagem(produtoIdentificado, ehAltoValor(produtoIdentificado))
      console.log('   📌 CASO: Quer foto + link')
    }
    
    // CASO 7: Cliente pergunta se tem produto E encontramos
    else if (temProduto && produtoIdentificado) {
      const preco = formatarPreco(produtoIdentificado.preco || 0)
      const estoque = produtoIdentificado.estoque || 0
      
      if (estoque > 0) {
        resposta = `Sim! ${produtoIdentificado.nome} por ${preco} 😊${gerarLinkProduto(produtoIdentificado)}`
        enviarFoto = true
        enviarLink = true
        linkMensagem = gerarLinkMensagem(produtoIdentificado, ehAltoValor(produtoIdentificado))
      } else {
        resposta = `${produtoIdentificado.nome} está em falta no momento 😔 Mas posso te avisar quando chegar!`
      }
      console.log('   📌 CASO: Pergunta se tem produto')
    }
    
    // CASO 8: Saudação simples
    else if (saudacao && !produtoIdentificado) {
      resposta = `Oi! 😊 Como posso ajudar? Temos ${produtos?.length || 0} produtos disponíveis!`
      console.log('   📌 CASO: Saudação')
    }
    
    // CASO 9: Agradecimento
    else if (agradecimento) {
      resposta = `Por nada! 😊 Qualquer dúvida é só chamar!`
      console.log('   📌 CASO: Agradecimento')
    }
    
    // CASO 10: Mencionou produto mas sem intenção clara → foto + link automático
    else if (produtoIdentificado) {
      const preco = formatarPreco(produtoIdentificado.preco || 0)
      const estoque = produtoIdentificado.estoque || 0
      
      if (estoque > 0) {
        resposta = `${produtoIdentificado.nome} está ${preco}! 😊${gerarLinkProduto(produtoIdentificado)}`
        enviarFoto = true
        enviarLink = true
        linkMensagem = gerarLinkMensagem(produtoIdentificado, ehAltoValor(produtoIdentificado))
      } else {
        resposta = `${produtoIdentificado.nome} está em falta no momento 😔 Posso te avisar quando chegar?`
      }
      console.log('   📌 CASO: Produto identificado → foto + link automático')
    }
    
    // CASO 11: Não entendeu
    else {
      if (produtos && produtos.length > 0) {
        const lista = produtos.slice(0, 5).map(p => `• ${p.nome}`).join('\n')
        resposta = `Temos esses produtos disponíveis:\n${lista}\n\nQual te interessa? 😊`
      } else {
        resposta = `Desculpe, não entendi. Pode me dizer qual produto você quer? 😊`
      }
      console.log('   📌 CASO: Não entendeu')
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📤 RESPOSTA FINAL PREMIUM:')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('   Mensagem:', resposta)
    console.log('   Produto:', produtoIdentificado?.nome || 'NENHUM')
    console.log('   Enviar Link:', enviarLink)
    console.log('   Enviar Foto:', enviarFoto)
    console.log('   Checkout URL:', produtoIdentificado?.checkout_url || 'N/A')
    console.log('   Link Marketplace:', produtoIdentificado?.link_marketplace || 'N/A')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    return new Response(JSON.stringify({
      success: true,
      mensagem: resposta,
      produto_recomendado: produtoIdentificado,
      produto_recomendado_id: produtoIdentificado?.id || null,
      produto_recomendado_nome: produtoIdentificado?.nome || null,
      enviar_link: enviarLink,
      enviar_foto: enviarFoto,
      checkout_url: produtoIdentificado?.checkout_url || produtoIdentificado?.link_marketplace || null,
      link_mensagem: linkMensagem || null,
      metodo_identificacao: metodoIdentificacao,
      palavra_chave: palavraEncontrada
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.error('❌ ERRO NA IA SIMPLES:', error)
    console.error('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    return new Response(JSON.stringify({
      success: true,
      mensagem: 'Desculpe, tive um probleminha. Pode repetir? 😊',
      enviar_link: false,
      enviar_foto: false
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
