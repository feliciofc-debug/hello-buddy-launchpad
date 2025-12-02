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

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🤖 AI Product Assistant v2.0 - DETECÇÃO MELHORADA')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔍 MENSAGEM DO CLIENTE:', mensagemCliente)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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
      console.log(`📦 Produto ${i + 1}: ${p.nome} (ID: ${p.id})`)
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

    console.log('📜 Histórico da conversa:', historico)

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // IDENTIFICAÇÃO DE PRODUTO - LÓGICA SUPER MELHORADA v3.0
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    const msgLower = mensagemCliente.toLowerCase()
    let produtoIdentificado: any = null
    let metodoIdentificacao = ''
    
    // Lista expandida de palavras-chave de produtos
    const palavrasChave = [
      'manteiga', 'margarina', // PRIORIDADE para detectar manteiga
      'arroz', 'feijão', 'feijao', 'farinha', 'milho', 'flocão', 'flocao', 
      'açúcar', 'acucar', 'óleo', 'oleo', 'sal', 'macarrão', 'macarrao', 
      'leite', 'café', 'cafe', 'queijo', 'presunto',
      'pão', 'pao', 'biscoito', 'bolacha', 'chocolate', 'doce', 'salgado',
      'carne', 'frango', 'peixe', 'ovo', 'ovos', 'verdura', 'legume', 'fruta',
      'grão de bico', 'grao de bico', 'grão', 'grao'
    ]
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔍 IDENTIFICAÇÃO DE PRODUTO v3.0 - COM DETECÇÃO DE RECLAMAÇÃO')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // ⚠️ NOVA ETAPA 0: Detectar se cliente está RECLAMANDO de produto errado
    const padroesReclamacao = [
      /estou pedindo\s+(\w+)/i,
      /eu quero\s+(\w+)/i,
      /pedindo\s+(\w+)\s+e\s+(?:vc|você|voce)/i,
      /quero\s+(\w+)\s+(?:não|nao)/i,
      /(\w+)\s+(?:não|nao)\s+(?:é|e)\s+(?:isso|esse|arroz|feijão|feijao)/i,
      /me\s+(?:manda|envia|passa|da)\s+(?:o|a)?\s*(?:link|foto)?.*?(?:da|do|de)?\s+(\w+)/i,
      /quero\s+(?:a|o)?\s*(\w+)/i,
      /(\w+)\s+por\s+favor/i
    ]
    
    let produtoDesejado: string | null = null
    let produtoReclamado: string | null = null
    
    // Detectar padrão de reclamação "pedindo X e vc manda Y"
    const padraoReclamacaoCompleto = /(?:estou\s+)?pedindo\s+(\w+).*?(?:passando|mandando|enviando).*?(?:link|foto)?.*?(?:de|do|da)?\s*(\w+)/i
    const matchReclamacao = msgLower.match(padraoReclamacaoCompleto)
    
    if (matchReclamacao) {
      produtoDesejado = matchReclamacao[1]
      produtoReclamado = matchReclamacao[2]
      console.log('🚨 RECLAMAÇÃO DETECTADA!')
      console.log('   Cliente QUER:', produtoDesejado)
      console.log('   Sistema MANDOU ERRADO:', produtoReclamado)
    }
    
    // Se não encontrou padrão completo, procurar padrões simples de desejo
    if (!produtoDesejado) {
      for (const padrao of padroesReclamacao) {
        const match = msgLower.match(padrao)
        if (match && match[1]) {
          const palavraCapturada = match[1].toLowerCase()
          // Verificar se é uma palavra-chave de produto
          if (palavrasChave.some(p => palavraCapturada.includes(p) || p.includes(palavraCapturada))) {
            produtoDesejado = palavraCapturada
            console.log('🎯 Produto DESEJADO detectado:', produtoDesejado)
            break
          }
        }
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // ETAPA 1: Se detectou produto DESEJADO, usar esse PRIMEIRO (não o reclamado!)
    if (produtoDesejado) {
      console.log('🔍 ETAPA 1: Buscando produto DESEJADO:', produtoDesejado)
      
      const produtoEncontrado = produtos?.find(p => 
        p.nome.toLowerCase().includes(produtoDesejado!) ||
        produtoDesejado!.includes(p.nome.toLowerCase().split(' ')[0])
      )
      
      if (produtoEncontrado) {
        produtoIdentificado = produtoEncontrado
        metodoIdentificacao = `PRODUTO DESEJADO "${produtoDesejado}" (cliente pediu especificamente)`
        console.log(`✅ PRODUTO CORRETO IDENTIFICADO: ${produtoEncontrado.nome}`)
      }
    }
    
    // ETAPA 2: Se não encontrou pelo desejo, procurar palavra-chave normal (IGNORANDO produto reclamado)
    if (!produtoIdentificado) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🔍 ETAPA 2: Procurando palavra-chave na mensagem (ignorando reclamação)')
      
      for (const palavra of palavrasChave) {
        // IGNORAR se for o produto que cliente RECLAMOU
        if (produtoReclamado && palavra.includes(produtoReclamado)) {
          console.log(`⏭️ Ignorando "${palavra}" - é o produto reclamado`)
          continue
        }
        
        if (msgLower.includes(palavra)) {
          const produtoEncontrado = produtos?.find(p => 
            p.nome.toLowerCase().includes(palavra)
          )
          if (produtoEncontrado) {
            produtoIdentificado = produtoEncontrado
            metodoIdentificacao = `PALAVRA-CHAVE "${palavra}" na mensagem atual`
            console.log(`✅ Produto encontrado: "${palavra}" → ${produtoEncontrado.nome}`)
            break
          }
        }
      }
    }
    
    // ETAPA 3: Se não encontrou, verificar nome completo do produto na mensagem
    if (!produtoIdentificado) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🔍 ETAPA 3: Procurando nome completo na mensagem')
      
      for (const p of produtos || []) {
        // IGNORAR se for o produto reclamado
        if (produtoReclamado && p.nome.toLowerCase().includes(produtoReclamado)) {
          continue
        }
        
        const nomeWords = p.nome.toLowerCase().split(' ')
        for (const word of nomeWords) {
          if (word.length > 3 && msgLower.includes(word)) {
            produtoIdentificado = p
            metodoIdentificacao = `NOME DO PRODUTO "${word}" na mensagem`
            console.log(`✅ Produto encontrado: "${word}" → ${p.nome}`)
            break
          }
        }
        if (produtoIdentificado) break
      }
    }
    
    // ETAPA 4: Se não encontrou e cliente quer foto/imagem/embalagem, buscar no HISTÓRICO
    const querFoto = msgLower.includes('foto') || msgLower.includes('imagem') || 
                     msgLower.includes('embalagem') || msgLower.includes('ver') ||
                     msgLower.includes('manda') || msgLower.includes('envia') ||
                     msgLower.includes('mostra')
    
    if (!produtoIdentificado && querFoto) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🔍 ETAPA 4: Cliente quer foto, buscando produto no HISTÓRICO')
      
      const historicoLower = historico.toLowerCase()
      
      for (const palavra of palavrasChave) {
        if (historicoLower.includes(palavra)) {
          const produtoEncontrado = produtos?.find(p => 
            p.nome.toLowerCase().includes(palavra)
          )
          if (produtoEncontrado) {
            produtoIdentificado = produtoEncontrado
            metodoIdentificacao = `HISTÓRICO - última menção de "${palavra}"`
            console.log(`✅ Produto do histórico: "${palavra}" → ${produtoEncontrado.nome}`)
            break
          }
        }
      }
      
      if (!produtoIdentificado) {
        for (const p of produtos || []) {
          if (historicoLower.includes(p.nome.toLowerCase())) {
            produtoIdentificado = p
            metodoIdentificacao = `HISTÓRICO - menção de "${p.nome}"`
            console.log(`✅ Produto do histórico (nome completo): ${p.nome}`)
            break
          }
        }
      }
    }
    
    // ETAPA 5: Se AINDA não encontrou, pegar o último produto mencionado na conversa
    if (!produtoIdentificado && messages && messages.length > 0) {
      console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
      console.log('🔍 ETAPA 5: Buscando último produto mencionado na conversa')
      
      const messagesReversed = [...messages].reverse()
      
      for (const msg of messagesReversed) {
        const msgContentLower = msg.content.toLowerCase()
        
        for (const palavra of palavrasChave) {
          if (msgContentLower.includes(palavra)) {
            const produtoEncontrado = produtos?.find(p => 
              p.nome.toLowerCase().includes(palavra)
            )
            if (produtoEncontrado) {
              produtoIdentificado = produtoEncontrado
              metodoIdentificacao = `ÚLTIMA MENÇÃO na conversa: "${palavra}"`
              console.log(`✅ Último produto mencionado: "${palavra}" → ${produtoEncontrado.nome}`)
              break
            }
          }
        }
        if (produtoIdentificado) break
        
        for (const p of produtos || []) {
          if (msgContentLower.includes(p.nome.toLowerCase())) {
            produtoIdentificado = p
            metodoIdentificacao = `ÚLTIMA MENÇÃO na conversa: "${p.nome}"`
            console.log(`✅ Último produto mencionado (nome): ${p.nome}`)
            break
          }
        }
        if (produtoIdentificado) break
      }
    }
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📦 RESULTADO DA IDENTIFICAÇÃO:')
    console.log('   Produto:', produtoIdentificado?.nome || 'NENHUM IDENTIFICADO')
    console.log('   ID:', produtoIdentificado?.id || 'N/A')
    console.log('   Método:', metodoIdentificacao || 'N/A')
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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
⚠️ CRÍTICO - PRODUTO IDENTIFICADO PELO SISTEMA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${produtoIdentificado ? `
🎯 O CLIENTE ESTÁ FALANDO SOBRE: **${produtoIdentificado.nome}**

📦 DADOS DO PRODUTO:
- ID: ${produtoIdentificado.id}
- Nome: ${produtoIdentificado.nome}
- Preço: R$ ${produtoIdentificado.preco}
- Descrição: ${produtoIdentificado.descricao || 'N/A'}

⚠️ ATENÇÃO ABSOLUTA:
- SE FOR ENVIAR FOTO, USE ESTE ID: ${produtoIdentificado.id}
- SE FOR RECOMENDAR PRODUTO, USE ESTE ID: ${produtoIdentificado.id}
- NUNCA TROQUE O PRODUTO! O cliente quer ${produtoIdentificado.nome}!
` : `
⚠️ Nenhum produto específico identificado.
Se o cliente perguntar sobre algo, pergunte qual produto ele quer.
`}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 REGRAS ABSOLUTAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

1. ❌ NUNCA peça CEP, endereço ou calcule frete
2. ❌ NUNCA mencione estoque/quantidade
3. ❌ NUNCA dê informações que não foram pedidas
4. ❌ NUNCA TROQUE O PRODUTO - se sistema identificou ARROZ, responda sobre ARROZ!
5. ✅ Responda APENAS o que foi perguntado
6. ✅ Seja breve, natural e humanizado
7. ✅ Use emojis COM MODERAÇÃO (máximo 1-2)
8. ✅ Sempre termine perguntando se quer algo mais

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
🎯 DETECTAR INTENÇÃO DE COMPRA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SINAIS de que cliente QUER COMPRAR:
- "Quero" / "Quero levar"
- "Sim" (após você oferecer)
- "Vou levar"
- "Como compro?" / "Como faço pra comprar?"
- "Manda o link"
- "Quero comprar"
- "Fecha aí"
- "Pode enviar"
- "Vou querer"
- "Fechou"
- "Beleza"
- "Ok, quero"

QUANDO DETECTAR INTENÇÃO DE COMPRA:
→ Responda: "Ótimo! Te envio o link agora 😊"
→ RETORNE no JSON: "enviar_link": true

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📦 CATÁLOGO COMPLETO:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${catalogoProdutos}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
💬 HISTÓRICO DA CONVERSA:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

${historico}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
❓ MENSAGEM ATUAL DO CLIENTE:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

"${mensagemCliente}"

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📋 GUIA DE RESPOSTAS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

SE PERGUNTA: "Tem [produto]?"
→ "Sim! [PRODUTO] por R$ [PREÇO] 😊 Quer?"

SE PERGUNTA: "Quanto custa?"
→ "R$ [PREÇO]. Quer levar?"

SE PERGUNTA: "Tem foto?" / "Manda foto" / "Ver embalagem"
→ "Claro! Já envio 📸"
→ RETORNE: enviar_foto: true
→ produto_recomendado_id: "${produtoIdentificado?.id || ''}"

SE PERGUNTA: "Info nutricional?"
→ [Dê a informação nutricional do produto]

SE PERGUNTA: "Ingredientes?"
→ [Liste os ingredientes]

SE PERGUNTA: "Ficha técnica?"
→ [Dê as especificações técnicas]

SE CLIENTE DIZ: "Quero" / "Sim" / "Vou levar" / "Manda o link"
→ "Ótimo! Te envio o link agora 😊"
→ RETORNE: enviar_link: true

SE PERGUNTA: "Como comprar?" ou "Quero comprar"
→ "Te envio o link agora! 😊"
→ RETORNE: enviar_link: true

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
- ❌ TROCAR O PRODUTO (se cliente fala de arroz, não mande feijão!)

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
📤 FORMATO DE RESPOSTA JSON:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

{
  "mensagem": "sua resposta CURTA",
  "produto_recomendado_id": "${produtoIdentificado?.id || 'null'}",
  "produto_recomendado_nome": "${produtoIdentificado?.nome || ''}",
  "enviar_foto": true/false,
  "enviar_link": true/false
}

⚠️ IMPORTANTE:
- produto_recomendado_id DEVE SER: "${produtoIdentificado?.id || 'null'}"
- produto_recomendado_nome DEVE SER: "${produtoIdentificado?.nome || ''}"
- NÃO TROQUE O PRODUTO!
- SE CLIENTE QUER COMPRAR → enviar_link: true

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
✨ EXEMPLOS:
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cliente: "Quanto é o frete?"
✅ CORRETO: "O frete aparece na hora de fechar a compra no link 😊"

Cliente: "Tem arroz?"
✅ CORRETO: "Sim! Arroz por R$ 3,90. Quer?"

Cliente: "Manda foto"
✅ CORRETO: {"mensagem": "Já envio! 📸", "produto_recomendado_id": "[ID]", "enviar_foto": true}

Cliente: "Quero" / "Sim" / "Vou levar"
✅ CORRETO: {"mensagem": "Ótimo! Te envio o link agora 😊", "enviar_link": true}

Cliente: "Como compro?"
✅ CORRETO: {"mensagem": "Te envio o link! 😊", "enviar_link": true}

━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

LEMBRE-SE: 
- MENOS É MAIS! Seja BREVE!
- NUNCA TROQUE O PRODUTO!
- CLIENTE QUER COMPRAR? → enviar_link: true

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

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🤖 RESPOSTA DA IA:')
    console.log(aiText)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

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
        produto_recomendado_id: produtoIdentificado?.id || null,
        produto_recomendado_nome: produtoIdentificado?.nome || null,
        enviar_foto: false
      }
    }

    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    // VALIDAÇÃO CRÍTICA: Garantir produto correto
    // ━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━
    
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('🔒 VALIDAÇÃO DE PRODUTO:')
    console.log('   IA retornou ID:', resposta.produto_recomendado_id)
    console.log('   IA retornou Nome:', resposta.produto_recomendado_nome)
    console.log('   Sistema identificou ID:', produtoIdentificado?.id)
    console.log('   Sistema identificou Nome:', produtoIdentificado?.nome)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    
    // Se sistema identificou um produto mas IA retornou outro, FORÇAR o correto
    if (produtoIdentificado && resposta.produto_recomendado_id !== produtoIdentificado.id) {
      console.log('⚠️ IA RETORNOU PRODUTO ERRADO! CORRIGINDO...')
      console.log(`   IA queria: ${resposta.produto_recomendado_nome}`)
      console.log(`   Correto é: ${produtoIdentificado.nome}`)
      
      resposta.produto_recomendado_id = produtoIdentificado.id
      resposta.produto_recomendado_nome = produtoIdentificado.nome
      
      console.log('✅ PRODUTO CORRIGIDO PARA:', produtoIdentificado.nome)
    }

    // Se IA recomendou produto, buscar detalhes completos
    let produtoDetalhes = null
    const idParaBuscar = resposta.produto_recomendado_id || produtoIdentificado?.id
    
    if (idParaBuscar) {
      const { data: produto } = await supabase
        .from('produtos')
        .select('*')
        .eq('id', idParaBuscar)
        .single()
      
      produtoDetalhes = produto
      console.log('📦 Produto final para envio:', produto?.nome)
    }

    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')
    console.log('📤 RESPOSTA FINAL:')
    console.log('   Mensagem:', resposta.mensagem)
    console.log('   Produto ID:', produtoDetalhes?.id || 'NENHUM')
    console.log('   Produto Nome:', produtoDetalhes?.nome || 'NENHUM')
    console.log('   Enviar Foto:', resposta.enviar_foto)
    console.log('   Enviar Link:', resposta.enviar_link)
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━')

    return new Response(JSON.stringify({
      success: true,
      mensagem: resposta.mensagem,
      produto_recomendado: produtoDetalhes,
      enviar_foto: resposta.enviar_foto || false,
      enviar_link: resposta.enviar_link || false,
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
