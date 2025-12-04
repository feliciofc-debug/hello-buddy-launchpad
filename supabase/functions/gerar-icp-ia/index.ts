import { serve } from 'https://deno.land/std@0.168.0/http/server.ts'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const { prompt } = await req.json()
    
    if (!prompt) {
      return new Response(JSON.stringify({ error: 'Prompt é obrigatório' }), {
        status: 400,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' }
      })
    }

    console.log('🤖 Analisando prompt:', JSON.stringify(prompt))
    
    const promptLower = prompt.toLowerCase()
    
    // ========== ANÁLISE DE CONTEXTO ==========
    // Detectar O QUE O USUÁRIO É (para excluir)
    const contextoProprio = {
      patterns: [
        /somos\s+uma?\s+empresa\s+de\s+(\w+)/gi,
        /nossa\s+empresa\s+(?:é|trabalha\s+com)\s+(\w+)/gi,
        /minha\s+empresa\s+(?:é|trabalha\s+com)\s+(\w+)/gi,
        /trabalhamos?\s+com\s+(\w+)/gi,
        /atuamos?\s+(?:em|com)\s+(\w+)/gi
      ],
      tiposExcluir: [] as string[]
    }
    
    // Detectar O QUE O USUÁRIO QUER ENCONTRAR
    const contextoAlvo = {
      patterns: [
        /(?:queremos?|quero)\s+encontrar\s+(?:empresas?\s+(?:que\s+(?:são|sao)|de))?\s*(\w+)/gi,
        /(?:procuramos?|procuro)\s+(?:empresas?\s+(?:que\s+(?:são|sao)|de))?\s*(\w+)/gi,
        /(?:buscar?|buscamos?)\s+(?:empresas?\s+(?:que\s+(?:são|sao)|de))?\s*(\w+)/gi,
        /clientes?\s+(?:que\s+(?:são|sao))?\s*(\w+)/gi,
        /empresas?\s+que\s+(?:são|sao)\s+(\w+)/gi
      ],
      tiposIncluir: [] as string[]
    }
    
    // Mapas de detecção - tipos de empresa
    const tiposMap: Record<string, string[]> = {
      'importadora': ['importador', 'importação', 'importam', 'importa', 'importadora', 'import'],
      'exportadora': ['exportador', 'exportação', 'exportam', 'exporta', 'exportadora', 'export'],
      'trading': ['trading', 'trader', 'comércio exterior', 'comex'],
      'distribuidora': ['distribuidor', 'distribuidora', 'distribuição', 'distribui'],
      'industria': ['indústria', 'industria', 'industrial', 'industriais', 'fabrica', 'fábrica', 'fabricante', 'manufatura'],
      'varejista': ['varejista', 'varejo', 'loja', 'lojas', 'comercio', 'comércio'],
      'atacadista': ['atacadista', 'atacado'],
      'transportadora': ['transportadora', 'transporte', 'logística', 'logistica', 'frete', 'rodoviária', 'rodoviario']
    }
    
    // Detectar contexto próprio (o que o usuário É)
    const frasesProprias = [
      'somos uma empresa',
      'nossa empresa',
      'minha empresa',
      'trabalhamos com',
      'atuamos em',
      'atuamos com',
      'trabalha com'
    ]
    
    // Encontrar o que o usuário É e EXCLUIR
    for (const frase of frasesProprias) {
      const idx = promptLower.indexOf(frase)
      if (idx !== -1) {
        // Pegar 50 caracteres após a frase para análise
        const contexto = promptLower.substring(idx, idx + 80)
        console.log('📍 Contexto próprio detectado:', contexto)
        
        for (const [tipo, keywords] of Object.entries(tiposMap)) {
          if (keywords.some(kw => contexto.includes(kw))) {
            contextoProprio.tiposExcluir.push(tipo)
            console.log(`🚫 Excluindo tipo (é o próprio usuário): ${tipo}`)
          }
        }
      }
    }
    
    // Detectar contexto alvo (o que o usuário QUER encontrar)
    const frasesAlvo = [
      'queremos encontrar',
      'quero encontrar',
      'procuramos',
      'procuro',
      'buscamos',
      'buscar',
      'empresas que são',
      'empresas que sao',
      'clientes que são',
      'clientes que sao',
      'para fazermos',
      'que precisam de',
      'que necessitam'
    ]
    
    for (const frase of frasesAlvo) {
      const idx = promptLower.indexOf(frase)
      if (idx !== -1) {
        // Pegar 100 caracteres após a frase
        const contexto = promptLower.substring(idx, idx + 100)
        console.log('🎯 Contexto alvo detectado:', contexto)
        
        for (const [tipo, keywords] of Object.entries(tiposMap)) {
          if (keywords.some(kw => contexto.includes(kw))) {
            if (!contextoProprio.tiposExcluir.includes(tipo)) {
              contextoAlvo.tiposIncluir.push(tipo)
              console.log(`✅ Incluindo tipo alvo: ${tipo}`)
            }
          }
        }
      }
    }
    
    // Setores de atuação
    const setoresMap: Record<string, string[]> = {
      'Agricultura': ['agrícola', 'agricultura', 'agro', 'grão', 'grãos', 'graos', 'soja', 'milho', 'fazenda', 'agronegócio', 'fertilizante', 'agricultor', 'agricultores', 'produtor rural', 'rural'],
      'Alimentação': ['alimento', 'alimentação', 'comida', 'bebida', 'food', 'restaurante', 'frigorífico', 'carne'],
      'Automotivo': ['automotivo', 'veículo', 'carro', 'autopeça', 'peça', 'automotive', 'auto'],
      'Construção': ['construção', 'material', 'cimento', 'obra', 'construtora', 'imobiliária'],
      'Tecnologia': ['tecnologia', 'software', 'hardware', 'eletrônico', 'tech', ' ti ', 'computador', 'informática'],
      'Têxtil': ['têxtil', 'roupa', 'tecido', 'vestuário', 'moda', 'confecção'],
      'Químico': ['químico', 'química', 'petroquímico'],
      'Farmacêutico': ['farmacêutico', 'remédio', 'medicamento', 'farmácia', 'saúde'],
      'Metalurgia': ['metalurgia', 'metal', 'aço', 'ferro', 'siderurgia'],
      'Energia': ['energia', 'elétrico', 'solar', 'eólica', 'petróleo', 'gás'],
      'Papel e Celulose': ['papel', 'celulose', 'madeira', 'florestal']
    }
    
    // Regiões/Cidades
    const regioesMap: Record<string, string[]> = {
      'Rio de Janeiro': ['rio de janeiro', 'rio', ' rj', '/rj', 'carioca'],
      'São Paulo': ['são paulo', 'sao paulo', 'sp ', '/sp', 'sampa', 'paulista'],
      'Minas Gerais': ['minas gerais', 'minas', ' mg', '/mg', 'belo horizonte', 'bh'],
      'Bahia': ['bahia', ' ba', '/ba', 'salvador'],
      'Pernambuco': ['pernambuco', ' pe', '/pe', 'recife'],
      'Rio Grande do Sul': ['rio grande do sul', ' rs', '/rs', 'porto alegre', 'gaúcho'],
      'Paraná': ['paraná', 'parana', ' pr', '/pr', 'curitiba'],
      'Santa Catarina': ['santa catarina', ' sc', '/sc', 'florianópolis', 'joinville'],
      'Goiás': ['goiás', 'goias', ' go', '/go', 'goiânia'],
      'Espírito Santo': ['espírito santo', 'espirito santo', ' es', '/es', 'vitória'],
      'Santos': ['santos', 'porto de santos'],
      'Guarulhos': ['guarulhos'],
      'Campinas': ['campinas'],
      'Brasil': ['brasil', 'todo brasil', 'nacional', 'país inteiro']
    }
    
    // ========== CONSTRUIR CONFIGURAÇÃO ==========
    const config = {
      nome: '',
      descricao: '',
      tipos: [] as string[],
      setores: [] as string[],
      localizacao: 'Brasil',
      estado: 'SP',
      cidade: '',
      cargos: ['CEO', 'Diretor', 'Gerente Comercial'],
      tipoProspeccao: 'b2b' as 'b2b' | 'b2c' | 'ambos'
    }
    
    // Usar tipos do contexto alvo se detectados, senão busca geral
    if (contextoAlvo.tiposIncluir.length > 0) {
      config.tipos = [...new Set(contextoAlvo.tiposIncluir)]
    } else {
      // Busca geral mas excluindo o tipo próprio
      for (const [tipo, keywords] of Object.entries(tiposMap)) {
        if (keywords.some(kw => promptLower.includes(kw))) {
          if (!contextoProprio.tiposExcluir.includes(tipo)) {
            config.tipos.push(tipo)
          }
        }
      }
    }
    
    // Detectar setores - mas excluir se for mencionado apenas como "logística PARA"
    const setoresExcluirContexto = ['Tecnologia'] // Excluir tecnologia a menos que explicitamente mencionado
    
    for (const [setor, keywords] of Object.entries(setoresMap)) {
      const encontrado = keywords.some(kw => promptLower.includes(kw))
      
      if (encontrado) {
        // Verificar se é setor do cliente-alvo ou apenas contexto
        if (setor === 'Tecnologia') {
          // Só incluir tecnologia se EXPLICITAMENTE mencionado
          const techExplicito = ['setor de tecnologia', 'empresas de tecnologia', 'tech companies', 'empresas tech'].some(
            pattern => promptLower.includes(pattern)
          )
          if (techExplicito) {
            config.setores.push(setor)
          }
        } else {
          config.setores.push(setor)
        }
      }
    }
    
    // Se "indústrias em geral" mencionado, adicionar setor genérico
    if (promptLower.includes('indústrias em geral') || promptLower.includes('industrias em geral')) {
      // Não adicionar setor específico, deixar genérico
      if (!config.tipos.includes('industria')) {
        config.tipos.push('industria')
      }
    }
    
    // Detectar localização
    for (const [regiao, keywords] of Object.entries(regioesMap)) {
      if (keywords.some(kw => promptLower.includes(kw))) {
        config.localizacao = regiao
        
        const estadoMap: Record<string, string> = {
          'Rio de Janeiro': 'RJ',
          'São Paulo': 'SP',
          'Minas Gerais': 'MG',
          'Bahia': 'BA',
          'Pernambuco': 'PE',
          'Rio Grande do Sul': 'RS',
          'Paraná': 'PR',
          'Santa Catarina': 'SC',
          'Goiás': 'GO',
          'Espírito Santo': 'ES',
          'Santos': 'SP',
          'Guarulhos': 'SP',
          'Campinas': 'SP',
          'Brasil': 'SP'
        }
        config.estado = estadoMap[regiao] || 'SP'
        
        if (['Santos', 'Guarulhos', 'Campinas'].includes(regiao)) {
          config.cidade = regiao
          config.localizacao = 'São Paulo'
        }
        
        break
      }
    }
    
    // Detectar B2B vs B2C
    if (promptLower.includes('pessoa física') || promptLower.includes('consumidor') || promptLower.includes('b2c')) {
      config.tipoProspeccao = 'b2c'
    } else {
      config.tipoProspeccao = 'b2b'
    }
    
    // ========== GERAR NOME E DESCRIÇÃO ==========
    const tipoNome = config.tipos.length > 0 
      ? config.tipos.map(t => t.charAt(0).toUpperCase() + t.slice(1)).join(' + ')
      : 'Empresas'
    
    const setorNome = config.setores.length > 0
      ? config.setores.slice(0, 2).join(' e ')
      : ''
    
    if (setorNome) {
      config.nome = `${tipoNome} ${setorNome} - ${config.localizacao}`
    } else {
      config.nome = `${tipoNome} - ${config.localizacao}`
    }
    
    config.descricao = `Prospecção de ${config.tipos.join(', ') || 'empresas'} ${config.setores.length > 0 ? 'do setor de ' + config.setores.join(', ') : ''} na região de ${config.localizacao}.`
    
    console.log('✅ Configuração gerada:', JSON.stringify(config, null, 2))
    console.log('🚫 Tipos excluídos (próprio):', contextoProprio.tiposExcluir)
    console.log('🎯 Tipos incluídos (alvo):', contextoAlvo.tiposIncluir)
    
    return new Response(JSON.stringify({
      success: true,
      configuracao: config,
      analise: {
        tipos_detectados: config.tipos.length,
        setores_detectados: config.setores.length,
        localizacao_detectada: config.localizacao !== 'Brasil',
        tipos_excluidos: contextoProprio.tiposExcluir,
        contexto_entendido: contextoProprio.tiposExcluir.length > 0 || contextoAlvo.tiposIncluir.length > 0
      }
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
    
  } catch (error) {
    console.error('❌ Erro:', error)
    const errorMessage = error instanceof Error ? error.message : 'Erro desconhecido'
    return new Response(JSON.stringify({ error: errorMessage }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    })
  }
})
