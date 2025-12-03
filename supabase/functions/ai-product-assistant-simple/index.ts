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
    console.log('💬 GERANDO RESPOSTA')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    let resposta = ''
    let enviarLink = false
    let enviarFoto = false
    let linkMensagem = ''
    
    // Formatar preço
    const formatarPreco = (preco: number) => {
      return preco.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })
    }
    
    const gerarLinkMensagem = (produto: any, altoValor: boolean) => {
      const preco = formatarPreco(produto.preco || 0)
      const link = produto.checkout_url || produto.link_marketplace || 'https://amzofertas.com.br/checkout'
      
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

_Escolha quantidade e finalize!_ ✅`
      }
    }
    
    // CASO 1: Cliente quer comprar E temos produto identificado
    if (querComprar && produtoIdentificado) {
      const altoValor = ehAltoValor(produtoIdentificado)
      
      if (altoValor) {
        resposta = `Ótimo! Vou te passar o link com todas as informações e fotos 😊`
      } else {
        resposta = `Perfeito! Te envio o link de compra agora 😊`
      }
      
      enviarLink = true
      linkMensagem = gerarLinkMensagem(produtoIdentificado, altoValor)
      console.log('   📌 CASO: Quer comprar + produto identificado')
    }
    
    // CASO 2: Cliente pergunta preço E temos produto
    else if (querPreco && produtoIdentificado) {
      const preco = formatarPreco(produtoIdentificado.preco || 0)
      const link = produtoIdentificado.checkout_url || produtoIdentificado.link_marketplace
      
      resposta = `${produtoIdentificado.nome} custa ${preco}. Quer levar? 😊`
      
      // Sempre incluir link na mensagem de preço (exceto alto valor)
      if (link && !ehAltoValor(produtoIdentificado)) {
        enviarLink = true
        linkMensagem = gerarLinkMensagem(produtoIdentificado, false)
      }
      console.log('   📌 CASO: Pergunta preço')
    }
    
    // CASO 3: Cliente quer foto E temos produto
    else if (querFoto && produtoIdentificado) {
      resposta = `Te envio a foto agora! 📸`
      enviarFoto = true
      enviarLink = true // TAMBÉM enviar link junto com foto
      linkMensagem = gerarLinkMensagem(produtoIdentificado, ehAltoValor(produtoIdentificado))
      console.log('   📌 CASO: Quer foto + link')
    }
    
    // CASO 4: Cliente pergunta se tem produto E encontramos
    else if (temProduto && produtoIdentificado) {
      const preco = formatarPreco(produtoIdentificado.preco || 0)
      resposta = `Sim! ${produtoIdentificado.nome} por ${preco} 😊`
      
      // Enviar foto + link automaticamente quando menciona produto
      enviarFoto = true
      enviarLink = true
      linkMensagem = gerarLinkMensagem(produtoIdentificado, ehAltoValor(produtoIdentificado))
      console.log('   📌 CASO: Pergunta se tem produto → foto + link')
    }
    
    // CASO 5: Saudação simples
    else if (saudacao && !produtoIdentificado) {
      resposta = `Oi! 😊 Como posso ajudar?`
      console.log('   📌 CASO: Saudação')
    }
    
    // CASO 6: Agradecimento
    else if (agradecimento) {
      resposta = `Por nada! 😊 Qualquer dúvida é só chamar!`
      console.log('   📌 CASO: Agradecimento')
    }
    
    // CASO 7: Mencionou produto mas sem intenção clara → foto + link automático
    else if (produtoIdentificado) {
      const preco = formatarPreco(produtoIdentificado.preco || 0)
      resposta = `${produtoIdentificado.nome} está ${preco}. Já te envio foto e link! 😊`
      
      // Enviar foto + link automaticamente
      enviarFoto = true
      enviarLink = true
      linkMensagem = gerarLinkMensagem(produtoIdentificado, ehAltoValor(produtoIdentificado))
      console.log('   📌 CASO: Produto identificado → foto + link automático')
    }
    
    // CASO 8: Não entendeu
    else {
      resposta = `Desculpe, não entendi. Pode me dizer qual produto você quer? 😊`
      console.log('   📌 CASO: Não entendeu')
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📤 RESPOSTA FINAL:')
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
