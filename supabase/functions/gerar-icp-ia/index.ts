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

    console.log('🤖 Analisando prompt:', prompt)
    
    const promptLower = prompt.toLowerCase()
    
    // Mapas de detecção - tipos de empresa
    const tipos: Record<string, string[]> = {
      'importadora': ['importador', 'importação', 'importam', 'importa', 'importadora', 'import'],
      'exportadora': ['exportador', 'exportação', 'exportam', 'exporta', 'exportadora', 'export'],
      'trading': ['trading', 'trader', 'comércio exterior', 'comex'],
      'distribuidora': ['distribuidor', 'distribuidora', 'distribuição', 'distribui'],
      'industria': ['indústria', 'fabrica', 'fábrica', 'industria', 'fabricante', 'manufatura'],
      'varejista': ['varejista', 'varejo', 'loja', 'lojas', 'comercio', 'comércio'],
      'atacadista': ['atacadista', 'atacado'],
      'transportadora': ['transportadora', 'transporte', 'logística', 'frete', 'logistica']
    }
    
    // Setores de atuação
    const setores: Record<string, string[]> = {
      'Alimentação': ['alimento', 'alimentação', 'comida', 'bebida', 'food', 'restaurante', 'frigorífico', 'carne'],
      'Agricultura': ['agrícola', 'agricultura', 'agro', 'grão', 'soja', 'milho', 'fazenda', 'agronegócio', 'fertilizante'],
      'Automotivo': ['automotivo', 'veículo', 'carro', 'autopeça', 'peça', 'automotive', 'auto'],
      'Construção': ['construção', 'material', 'cimento', 'obra', 'construtora', 'imobiliária'],
      'Tecnologia': ['tecnologia', 'software', 'hardware', 'eletrônico', 'tech', 'ti', 'computador'],
      'Têxtil': ['têxtil', 'roupa', 'tecido', 'vestuário', 'moda', 'confecção'],
      'Químico': ['químico', 'química', 'petroquímico'],
      'Farmacêutico': ['farmacêutico', 'remédio', 'medicamento', 'farmácia', 'saúde'],
      'Industrial': ['industrial', 'indústria', 'máquina', 'equipamento'],
      'Metalurgia': ['metalurgia', 'metal', 'aço', 'ferro', 'siderurgia'],
      'Energia': ['energia', 'elétrico', 'solar', 'eólica', 'petróleo', 'gás'],
      'Papel e Celulose': ['papel', 'celulose', 'madeira', 'florestal']
    }
    
    // Regiões/Cidades
    const regioes: Record<string, string[]> = {
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
    
    // Cargos decisores
    const cargosMap: Record<string, string[]> = {
      'CEO': ['ceo', 'presidente', 'fundador', 'owner', 'dono'],
      'Diretor': ['diretor', 'director', 'diretoria'],
      'Gerente': ['gerente', 'manager', 'gerência'],
      'Supervisor': ['supervisor', 'coordenador', 'líder'],
      'Compras': ['compras', 'procurement', 'suprimentos', 'buyer'],
      'Comercial': ['comercial', 'vendas', 'sales']
    }
    
    // Detectar configurações
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
    
    // Detectar tipos de empresa
    for (const [tipo, keywords] of Object.entries(tipos)) {
      if (keywords.some(kw => promptLower.includes(kw))) {
        config.tipos.push(tipo)
      }
    }
    
    // Detectar setores
    for (const [setor, keywords] of Object.entries(setores)) {
      if (keywords.some(kw => promptLower.includes(kw))) {
        config.setores.push(setor)
      }
    }
    
    // Detectar localização
    for (const [regiao, keywords] of Object.entries(regioes)) {
      if (keywords.some(kw => promptLower.includes(kw))) {
        config.localizacao = regiao
        
        // Mapear estado
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
        
        // Se for cidade específica
        if (['Santos', 'Guarulhos', 'Campinas'].includes(regiao)) {
          config.cidade = regiao
          config.localizacao = 'São Paulo'
        }
        
        break
      }
    }
    
    // Detectar cargos específicos
    const cargosDetectados: string[] = []
    for (const [cargo, keywords] of Object.entries(cargosMap)) {
      if (keywords.some(kw => promptLower.includes(kw))) {
        cargosDetectados.push(cargo)
      }
    }
    if (cargosDetectados.length > 0) {
      config.cargos = cargosDetectados
    }
    
    // Detectar B2B vs B2C
    if (promptLower.includes('pessoa física') || promptLower.includes('consumidor') || promptLower.includes('b2c')) {
      config.tipoProspeccao = 'b2c'
    } else if (promptLower.includes('b2b') || promptLower.includes('empresa') || config.tipos.length > 0) {
      config.tipoProspeccao = 'b2b'
    }
    
    // Gerar nome automático
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
    
    // Gerar descrição
    config.descricao = `Prospecção de ${config.tipos.join(', ') || 'empresas'} ${config.setores.length > 0 ? 'do setor de ' + config.setores.join(', ') : ''} na região de ${config.localizacao}.`
    
    console.log('✅ Configuração gerada:', config)
    
    return new Response(JSON.stringify({
      success: true,
      configuracao: config,
      analise: {
        tipos_detectados: config.tipos.length,
        setores_detectados: config.setores.length,
        localizacao_detectada: config.localizacao !== 'Brasil',
        cargos_personalizados: cargosDetectados.length > 0
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
