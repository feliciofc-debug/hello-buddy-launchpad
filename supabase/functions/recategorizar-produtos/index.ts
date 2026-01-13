import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

// Regras COMPLETAS de auto-categorização - ordem de prioridade (mais específicas primeiro)
const REGRAS_AUTO_CATEGORIA: { categoria: string; palavras: string[] }[] = [
  // 1. ELETRODOMÉSTICOS (prioridade alta - produtos específicos)
  { 
    categoria: 'Eletrodomésticos', 
    palavras: [
      'ar-condicionado', 'ar condicionado', 'split', 'btu',
      'geladeira', 'refrigerador', 'freezer',
      'fogão', 'cooktop',
      'micro-ondas', 'microondas',
      'máquina de lavar', 'máquina lavar', 'lavadora', 'secadora', 'lava e seca',
      'ferro de passar', 'ferro passar',
      'ventilador', 'circulador',
      'aquecedor', 'climatizador',
      'purificador', 'bebedouro',
      'exaustor', 'depurador', 'coifa',
      'forno elétrico', 'forno eletrico'
    ] 
  },
  
  // 2. COZINHA (panelas, utensílios, eletros pequenos)
  { 
    categoria: 'Cozinha', 
    palavras: [
      'panela', 'frigideira', 'caçarola', 'fervedor', 'caldeirão',
      'airfryer', 'air fryer', 'fritadeira',
      'liquidificador', 'batedeira', 'processador', 'mixer',
      'cafeteira', 'espremedor', 'sanduicheira', 'grill',
      'faca', 'talheres', 'faqueiro', 'garfo', 'colher',
      'prato', 'tigela', 'bowl', 'saladeira',
      'copo', 'taça', 'jarra', 'garrafa térmica',
      'xícara', 'caneca',
      'forma', 'assadeira', 'refratário', 'travessa',
      'espátula', 'concha', 'pegador', 'escumadeira',
      'escorredor', 'peneira', 'ralador',
      'pote', 'potes', 'porta condimento', 'porta tempero',
      'boleira', 'bandeja', 'petisqueira',
      'tábua de corte', 'tabua de corte',
      'aparelho de jantar', 'aparelho jantar',
      'jogo de panelas', 'jogo panelas',
      'jogo de copos', 'jogo copos',
      'jogo de talheres', 'jogo talheres',
      'conjunto de', 'kit cozinha'
    ] 
  },
  
  // 3. FERRAMENTAS E CONSTRUÇÃO
  { 
    categoria: 'Ferramentas e Construção', 
    palavras: [
      'furadeira', 'parafusadeira', 'esmerilhadeira', 'serra', 'lixadeira',
      'martelo', 'alicate', 'chave', 'soquete', 'catraca',
      'trena', 'nível', 'prumo',
      'broca', 'bits', 'disco',
      'caixa de ferramentas', 'maleta ferramentas', 'kit ferramentas', 'jogo ferramentas',
      'chave fenda', 'chave phillips', 'chave allen', 'chave torx',
      'fita isolante', 'fita veda rosca',
      'extensão elétrica', 'cabo elétrico',
      'torneira', 'registro', 'sifão',
      'tinta', 'pincel', 'rolo pintura'
    ] 
  },
  
  // 4. MODA (roupas, calçados, acessórios)
  { 
    categoria: 'Moda', 
    palavras: [
      'camiseta', 'camisa', 't-shirt',
      'calça', 'jeans', 'legging',
      'vestido', 'saia', 'short',
      'blusa', 'moletom', 'casaco', 'jaqueta', 'blazer',
      'tênis', 'sapatênis', 'sapato', 'bota',
      'sandália', 'rasteirinha', 'chinelo', 'havaianas', 'tamanco',
      'bolsa', 'mochila', 'carteira', 'necessaire',
      'cinto', 'gravata', 'lenço',
      'relógio', 'óculos', 'brinco', 'colar', 'pulseira', 'anel',
      'lingerie', 'cueca', 'calcinha', 'sutiã', 'meia',
      'pijama', 'roupão', 'camisola',
      'infantil menina', 'infantil menino', 'calçados'
    ] 
  },
  
  // 5. BELEZA
  { 
    categoria: 'Beleza', 
    palavras: [
      'maquiagem', 'batom', 'rímel', 'mascara', 'delineador',
      'base', 'corretivo', 'pó compacto', 'primer',
      'blush', 'bronzer', 'iluminador', 'contorno',
      'sombra', 'paleta', 'glitter',
      'perfume', 'colônia', 'eau de toilette', 'parfum',
      'creme', 'hidratante', 'sérum', 'loção',
      'protetor solar', 'filtro solar',
      'shampoo', 'condicionador', 'máscara capilar',
      'escova cabelo', 'pente',
      'secador', 'chapinha', 'babyliss', 'modelador',
      'depilador', 'barbeador',
      'esmalte', 'unha', 'acetona',
      'pincel maquiagem', 'aplicador'
    ] 
  },
  
  // 6. PAPELARIA E ESCRITÓRIO
  { 
    categoria: 'Papelaria e Escritório', 
    palavras: [
      'caderno', 'agenda', 'fichário', 'pasta',
      'lápis', 'caneta', 'lapiseira', 'marca texto', 'marcador',
      'borracha', 'apontador',
      'cola', 'fita adesiva', 'fita corretiva',
      'papel', 'sulfite', 'post-it', 'bloco adesivo',
      'régua', 'esquadro', 'compasso',
      'tesoura', 'estilete',
      'grampeador', 'grampo', 'clips', 'clipes',
      'estojo', 'mochila escolar',
      'guache', 'tinta escolar', 'aquarela',
      'lousa', 'quadro branco', 'apagador',
      'massinha', 'giz de cera', 'canetinha',
      'material escolar', 'volta às aulas'
    ] 
  },
  
  // 7. ELETRÔNICOS E CELULARES
  { 
    categoria: 'Eletrônicos e Celulares', 
    palavras: [
      'celular', 'smartphone', 'iphone', 'samsung galaxy', 'xiaomi', 'motorola',
      'tablet', 'ipad',
      'fone', 'earbuds', 'airpods', 'headphone', 'headset',
      'carregador', 'cabo usb', 'cabo lightning', 'cabo tipo c',
      'powerbank', 'power bank', 'bateria externa',
      'caixa de som', 'bluetooth', 'speaker', 'soundbar',
      'smartwatch', 'relógio smart', 'smartband',
      'película', 'capinha', 'case celular', 'capa celular',
      'drone', 'gopro', 'câmera ação',
      'kindle', 'e-reader',
      'tv', 'televisão', 'smart tv',
      'home theater', 'receiver'
    ] 
  },
  
  // 8. INFORMÁTICA
  { 
    categoria: 'Informática', 
    palavras: [
      'notebook', 'laptop', 'macbook', 'chromebook',
      'computador', 'pc gamer', 'desktop',
      'teclado', 'mouse', 'mousepad',
      'monitor', 'tela',
      'webcam', 'câmera web',
      'pendrive', 'cartão memória', 'sd card',
      'hd externo', 'ssd', 'disco rígido',
      'roteador', 'modem', 'repetidor wifi', 'hub usb', 'switch',
      'impressora', 'multifuncional', 'scanner',
      'cartucho', 'toner',
      'suporte notebook', 'base notebook', 'cooler notebook'
    ] 
  },
  
  // 9. BEBÊS
  { 
    categoria: 'Bebês', 
    palavras: [
      'fralda', 'pomada assadura',
      'mamadeira', 'bico', 'chupeta',
      'carrinho bebê', 'carrinho de bebê', 'berço', 'moisés',
      'bebê conforto', 'cadeirinha auto', 'cadeirinha carro',
      'babá eletrônica', 'baby monitor',
      'mordedor', 'chocalho',
      'body', 'macacão bebê', 'enxoval',
      'sapatinho bebê', 'pantufa bebê',
      'banheira bebê', 'trocador',
      'andador', 'cercadinho',
      'papinha', 'leite', 'fórmula infantil'
    ] 
  },
  
  // 10. BRINQUEDOS E JOGOS
  { 
    categoria: 'Brinquedos e Jogos', 
    palavras: [
      'boneca', 'barbie', 'lol', 'baby alive',
      'carrinho', 'hot wheels', 'pista',
      'lego', 'blocos montar',
      'quebra-cabeça', 'puzzle',
      'jogo de tabuleiro', 'monopoly', 'uno', 'dominó',
      'bola', 'bola futebol', 'bola basquete',
      'bicicleta infantil', 'triciclo',
      'patinete', 'patins', 'skate',
      'pelúcia', 'urso pelúcia',
      'nerf', 'pistola água',
      'massinha play-doh', 'slime',
      'boneco', 'action figure', 'marvel', 'dc'
    ] 
  },
  
  // 11. PET SHOP
  { 
    categoria: 'Pet Shop', 
    palavras: [
      'ração', 'petisco', 'sachê',
      'coleira', 'guia', 'peitoral',
      'casinha pet', 'casinha cachorro', 'casinha gato',
      'comedouro', 'bebedouro pet',
      'arranhador', 'arranhador gato',
      'brinquedo pet', 'brinquedo cachorro', 'brinquedo gato',
      'cama pet', 'cama cachorro', 'cama gato', 'caminha',
      'tapete higiênico', 'tapete pet',
      'shampoo pet', 'antipulgas', 'carrapato',
      'aquário', 'filtro aquário',
      'gaiola', 'viveiro'
    ] 
  },
  
  // 12. ESPORTES E AVENTURA
  { 
    categoria: 'Esportes e Aventura', 
    palavras: [
      'academia', 'musculação',
      'haltere', 'peso', 'anilha', 'barra',
      'esteira', 'elíptico', 'bicicleta ergométrica',
      'corda pular', 'corda naval',
      'yoga', 'colchonete', 'tapete yoga',
      'luva boxe', 'saco pancada',
      'raquete', 'rede badminton',
      'bola fitness', 'bosu', 'step',
      'mochila camping', 'barraca', 'saco dormir',
      'lanterna', 'cantil',
      'bicicleta', 'capacete bike', 'luva ciclismo',
      'chuteira', 'caneleira',
      'óculos natação', 'touca natação', 'maiô', 'sunga'
    ] 
  },
  
  // 13. AUTOMOTIVO
  { 
    categoria: 'Automotivo', 
    palavras: [
      'carro', 'veículo', 'automotivo',
      'moto', 'motocicleta',
      'pneu', 'câmara ar',
      'óleo motor', 'óleo lubrificante', 'fluido',
      'limpador para-brisa', 'palheta',
      'capa banco', 'capas banco',
      'tapete carro', 'tapete automotivo',
      'carregador veicular', 'inversor',
      'suporte celular carro', 'suporte veicular',
      'aspirador carro', 'aspirador veicular',
      'cera', 'polimento', 'silicone',
      'bateria carro', 'terminal bateria'
    ] 
  },
  
  // 14. JARDIM E PISCINA
  { 
    categoria: 'Jardim e Piscina', 
    palavras: [
      'mangueira', 'irrigação', 'aspersor',
      'vaso planta', 'cachepô', 'jardineira',
      'terra', 'substrato', 'adubo', 'fertilizante',
      'semente', 'muda',
      'tesoura poda', 'podador', 'serrote poda',
      'regador', 'pulverizador',
      'piscina', 'piscina inflável', 'piscina estrutural',
      'boia', 'prancha', 'colchão inflável',
      'cloro', 'algicida', 'barrilha',
      'filtro piscina', 'bomba piscina',
      'churrasqueira', 'grelha', 'espeto',
      'rede descanso', 'cadeira praia', 'guarda-sol', 'sombreiro'
    ] 
  },
  
  // 15. ALIMENTOS E BEBIDAS
  { 
    categoria: 'Alimentos e Bebidas', 
    palavras: [
      'café', 'cápsula', 'nespresso',
      'chá', 'infusão',
      'chocolate', 'bombom', 'trufa',
      'biscoito', 'bolacha', 'cookie',
      'cereal', 'granola', 'aveia',
      'suplemento', 'whey', 'proteína', 'creatina', 'bcaa',
      'vitamina', 'polivitamínico',
      'barra proteica', 'barra cereal',
      'azeite', 'vinagre',
      'mel', 'geleia',
      'castanha', 'amêndoa', 'nozes'
    ] 
  },
  
  // 16. CUIDADOS PESSOAIS E LIMPEZA
  { 
    categoria: 'Cuidados Pessoais e Limpeza', 
    palavras: [
      'sabonete', 'sabonete líquido',
      'desodorante', 'antitranspirante',
      'papel higiênico', 'papel toalha', 'lenço umedecido',
      'detergente', 'lava louça',
      'desinfetante', 'álcool', 'álcool gel',
      'água sanitária', 'cloro limpeza',
      'amaciante', 'sabão pó', 'sabão líquido', 'lava roupas',
      'esponja', 'esponja aço', 'palha aço',
      'vassoura', 'rodo', 'mop', 'esfregão',
      'aspirador de pó', 'robô aspirador',
      'balde', 'pano limpeza', 'flanela',
      'luva limpeza', 'luva borracha',
      'inseticida', 'repelente'
    ] 
  },
  
  // 17. MÓVEIS
  { 
    categoria: 'Móveis', 
    palavras: [
      'sofá', 'poltrona', 'puff', 'divã',
      'cama', 'box', 'beliche',
      'guarda-roupa', 'roupeiro', 'armário',
      'estante', 'nicho', 'prateleira',
      'mesa', 'mesa jantar', 'mesa centro',
      'cadeira', 'banqueta',
      'escrivaninha', 'mesa escritório',
      'rack', 'painel tv', 'home',
      'cômoda', 'criado mudo', 'gaveteiro',
      'sapateira', 'cabideiro',
      'balcão', 'buffet', 'aparador'
    ] 
  },
  
  // 18. CASA (decoração, cama/mesa/banho)
  { 
    categoria: 'Casa', 
    palavras: [
      'almofada', 'capa almofada',
      'cortina', 'persiana', 'blackout',
      'tapete', 'passadeira', 'capacho',
      'toalha', 'toalha banho', 'toalha rosto',
      'lençol', 'fronha',
      'edredom', 'cobertor', 'manta',
      'travesseiro', 'colcha', 'protetor colchão',
      'decoração', 'enfeite',
      'vaso decorativo', 'vaso flores',
      'quadro', 'porta retrato',
      'relógio parede',
      'abajur', 'luminária', 'lustre', 'pendente',
      'espelho', 'cabide', 'organizador',
      'lixeira', 'cesto', 'porta objetos'
    ] 
  },
  
  // 19. LIVROS
  { 
    categoria: 'Livros', 
    palavras: [
      'livro', 'romance', 'biografia', 'autobiografia',
      'autoajuda', 'desenvolvimento pessoal',
      'didático', 'apostila', 'material didático',
      'infantil livro', 'livro infantil',
      'ficção', 'literatura', 'clássico',
      'hq', 'quadrinhos', 'mangá',
      'enciclopédia', 'dicionário',
      'box livros', 'coleção livros'
    ] 
  },
  
  // 20. VIDEO GAMES
  { 
    categoria: 'Video Games', 
    palavras: [
      'playstation', 'ps5', 'ps4', 'ps3',
      'xbox', 'series x', 'series s',
      'nintendo', 'switch', 'wii',
      'console', 'game', 'jogo playstation', 'jogo xbox', 'jogo nintendo',
      'controle ps', 'controle xbox', 'joy-con',
      'headset gamer', 'fone gamer',
      'cadeira gamer',
      'volante gamer', 'joystick'
    ] 
  },
];

// Função para detectar categoria automaticamente
function detectarCategoriaAutomatica(titulo: string): string | null {
  const tituloLower = titulo.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, ''); // Remove acentos para comparação
  
  for (const regra of REGRAS_AUTO_CATEGORIA) {
    for (const palavra of regra.palavras) {
      const palavraLower = palavra.toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '');
      
      if (tituloLower.includes(palavraLower)) {
        return regra.categoria;
      }
    }
  }
  return null;
}

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const supabaseClient = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    );

    console.log('🔄 Iniciando recategorização de produtos...');

    // Buscar TODOS os produtos
    const { data: produtos, error: fetchError } = await supabaseClient
      .from('afiliado_produtos')
      .select('id, titulo, categoria')
      .order('created_at', { ascending: false });

    if (fetchError) {
      throw new Error(`Erro ao buscar produtos: ${fetchError.message}`);
    }

    console.log(`📦 Total de produtos: ${produtos?.length || 0}`);

    let atualizados = 0;
    let mantidos = 0;
    const categoriaStats: Record<string, number> = {};

    for (const produto of produtos || []) {
      const novaCategoria = detectarCategoriaAutomatica(produto.titulo);
      
      if (novaCategoria) {
        // Só atualiza se encontrou uma categoria e é diferente da atual
        if (novaCategoria !== produto.categoria) {
          const { error: updateError } = await supabaseClient
            .from('afiliado_produtos')
            .update({ categoria: novaCategoria })
            .eq('id', produto.id);

          if (updateError) {
            console.error(`❌ Erro ao atualizar ${produto.id}: ${updateError.message}`);
          } else {
            atualizados++;
            console.log(`✅ ${produto.titulo.substring(0, 50)}... → ${novaCategoria}`);
          }
        } else {
          mantidos++;
        }
        
        categoriaStats[novaCategoria] = (categoriaStats[novaCategoria] || 0) + 1;
      } else {
        // Se não encontrou categoria, mantém "Casa" como fallback (ou a categoria atual)
        if (!produto.categoria) {
          await supabaseClient
            .from('afiliado_produtos')
            .update({ categoria: 'Casa' })
            .eq('id', produto.id);
        }
        categoriaStats[produto.categoria || 'Casa'] = (categoriaStats[produto.categoria || 'Casa'] || 0) + 1;
      }
    }

    console.log(`\n📊 Resumo:`);
    console.log(`   Atualizados: ${atualizados}`);
    console.log(`   Mantidos: ${mantidos}`);
    console.log(`   Por categoria:`, categoriaStats);

    return new Response(JSON.stringify({
      success: true,
      total: produtos?.length || 0,
      atualizados,
      mantidos,
      categoriaStats
    }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });

  } catch (error: any) {
    console.error('💥 Erro:', error);
    return new Response(JSON.stringify({
      success: false,
      error: error.message
    }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' }
    });
  }
});
