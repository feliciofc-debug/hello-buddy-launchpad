// ========================================
// CATEGORIAS AMZ OFERTAS - SINCRONIZADAS COM SHOPEE
// ========================================
// Mapeamento Shopee → AMZ:
// - Roupas Femininas/Masculinas/Plus Size/Sapatos/Bolsas/Acessórios/Relógios/Moda Infantil → Moda
// - Celulares e Dispositivos/Áudio/Câmeras e Drones → Eletrônicos e Celulares
// - Computadores e Acessórios → Informática
// - Jogos e Consoles → Video Games
// - Animais Domésticos → Pet Shop
// - Mãe e Bebê → Bebês
// - Casa e Construção → Casa/Construção
// - Esportes e Lazer → Esportes e Aventura
// - Brinquedos e Hobbies → Brinquedos e Jogos
// - Viagens e Bagagens → Moda
// - Livros e Revistas → Livros

// 22 categorias válidas (valores internos do sistema)
export const CATEGORIAS_VALIDAS = [
  'Alimentos e Bebidas',
  'Automotivo',
  'Bebês',
  'Beleza',
  'Brinquedos e Jogos',
  'Casa',
  'Construção',
  'Cozinha',
  'Cuidados Pessoais e Limpeza',
  'Eletrodomésticos',
  'Eletrônicos e Celulares',
  'Esportes e Aventura',
  'Ferramentas e Construção',
  'Informática',
  'Jardim e Piscina',
  'Livros',
  'eBooks',
  'Moda',
  'Móveis',
  'Papelaria e Escritório',
  'Pet Shop',
  'Video Games'
] as const;

export type CategoriaValida = typeof CATEGORIAS_VALIDAS[number];

// Mapeamento completo Shopee → AMZ (slugs e nomes)
export const MAPA_CATEGORIAS_SHOPEE: Record<string, CategoriaValida> = {
  // === MODA (Roupas, Sapatos, Bolsas, Acessórios) ===
  'roupas-femininas': 'Moda',
  'roupas-masculinas': 'Moda',
  'roupas-plus-size': 'Moda',
  'sapatos-femininos': 'Moda',
  'sapatos-masculinos': 'Moda',
  'bolsas-femininas': 'Moda',
  'bolsas-masculinas': 'Moda',
  'acessorios-de-moda': 'Moda',
  'relogios': 'Moda',
  'moda-infantil': 'Moda',
  'viagens-e-bagagens': 'Moda',
  'moda': 'Moda',
  'moda-feminina': 'Moda',
  'moda-masculina': 'Moda',
  'roupas': 'Moda',
  'calcados': 'Moda',
  'bolsas': 'Moda',
  'acessorios-moda': 'Moda',
  'joias': 'Moda',
  'bijuterias': 'Moda',
  'oculos': 'Moda',
  'lingerie': 'Moda',
  'moda-praia': 'Moda',

  // === ELETRÔNICOS E CELULARES ===
  'celulares-e-dispositivos': 'Eletrônicos e Celulares',
  'audio': 'Eletrônicos e Celulares',
  'cameras-e-drones': 'Eletrônicos e Celulares',
  'celulares': 'Eletrônicos e Celulares',
  'celulares-acessorios': 'Eletrônicos e Celulares',
  'smartphones': 'Eletrônicos e Celulares',
  'tablets': 'Eletrônicos e Celulares',
  'acessorios-celular': 'Eletrônicos e Celulares',
  'fones-ouvido': 'Eletrônicos e Celulares',
  'smartwatch': 'Eletrônicos e Celulares',
  'relogios-inteligentes': 'Eletrônicos e Celulares',
  'cameras': 'Eletrônicos e Celulares',
  'tv': 'Eletrônicos e Celulares',
  'televisores': 'Eletrônicos e Celulares',
  'eletronicos': 'Eletrônicos e Celulares',

  // === INFORMÁTICA ===
  'computadores-e-acessorios': 'Informática',
  'informatica': 'Informática',
  'computadores': 'Informática',
  'notebooks': 'Informática',
  'laptops': 'Informática',
  'pc-gamer': 'Informática',
  'perifericos': 'Informática',
  'teclados': 'Informática',
  'mouses': 'Informática',
  'monitores': 'Informática',
  'impressoras': 'Informática',
  'armazenamento': 'Informática',
  'pendrive': 'Informática',
  'hd-externo': 'Informática',
  'ssd': 'Informática',

  // === VIDEO GAMES ===
  'jogos-e-consoles': 'Video Games',
  'games': 'Video Games',
  'video-games': 'Video Games',
  'jogos': 'Video Games',
  'playstation': 'Video Games',
  'xbox': 'Video Games',
  'nintendo': 'Video Games',
  'console': 'Video Games',
  'controles': 'Video Games',

  // === PET SHOP ===
  'animais-domesticos': 'Pet Shop',
  'pet-shop': 'Pet Shop',
  'pet': 'Pet Shop',
  'animais': 'Pet Shop',
  'cachorros': 'Pet Shop',
  'gatos': 'Pet Shop',
  'racao': 'Pet Shop',

  // === BEBÊS ===
  'mae-e-bebe': 'Bebês',
  'bebes': 'Bebês',
  'bebe': 'Bebês',
  'maternidade': 'Bebês',
  'fraldas': 'Bebês',
  'carrinhos-bebe': 'Bebês',
  'mamadeiras': 'Bebês',
  'roupas-bebe': 'Bebês',

  // === CASA E CONSTRUÇÃO ===
  'casa-e-construcao': 'Casa',
  'casa': 'Casa',
  'casa-decoracao': 'Casa',
  'decoracao': 'Casa',
  'organizacao': 'Casa',
  'iluminacao': 'Casa',
  'cama-mesa-banho': 'Casa',
  'tapetes': 'Casa',
  'cortinas': 'Casa',

  // === COZINHA ===
  'cozinha': 'Cozinha',
  'casa-cozinha': 'Cozinha',
  'utensilios-cozinha': 'Cozinha',
  'panelas': 'Cozinha',
  'talheres': 'Cozinha',
  'copos': 'Cozinha',
  'pratos': 'Cozinha',

  // === ELETRODOMÉSTICOS ===
  'eletrodomesticos': 'Eletrodomésticos',
  'ar-condicionado': 'Eletrodomésticos',
  'ventiladores': 'Eletrodomésticos',
  'geladeiras': 'Eletrodomésticos',
  'fogoes': 'Eletrodomésticos',
  'microondas': 'Eletrodomésticos',
  'lavadoras': 'Eletrodomésticos',
  'aspiradores': 'Eletrodomésticos',
  'cafeteiras': 'Eletrodomésticos',
  'liquidificadores': 'Eletrodomésticos',
  'batedeiras': 'Eletrodomésticos',
  'fritadeiras': 'Eletrodomésticos',
  'air-fryer': 'Eletrodomésticos',

  // === ESPORTES E LAZER ===
  'esportes-e-lazer': 'Esportes e Aventura',
  'esportes': 'Esportes e Aventura',
  'esportes-lazer': 'Esportes e Aventura',
  'fitness': 'Esportes e Aventura',
  'academia': 'Esportes e Aventura',
  'futebol': 'Esportes e Aventura',
  'ciclismo': 'Esportes e Aventura',
  'camping': 'Esportes e Aventura',
  'pesca': 'Esportes e Aventura',
  'natacao': 'Esportes e Aventura',

  // === BRINQUEDOS E HOBBIES ===
  'brinquedos-e-hobbies': 'Brinquedos e Jogos',
  'brinquedos': 'Brinquedos e Jogos',
  'brinquedos-jogos': 'Brinquedos e Jogos',
  'bonecas': 'Brinquedos e Jogos',
  'carrinhos': 'Brinquedos e Jogos',
  'lego': 'Brinquedos e Jogos',
  'jogos-tabuleiro': 'Brinquedos e Jogos',
  'pelucias': 'Brinquedos e Jogos',

  // === BELEZA E SAÚDE ===
  'beleza': 'Beleza',
  'beleza-cuidados-pessoais': 'Beleza',
  'perfumes': 'Beleza',
  'maquiagem': 'Beleza',
  'cabelos': 'Beleza',
  'skincare': 'Beleza',
  'cosmeticos': 'Beleza',
  'saude': 'Cuidados Pessoais e Limpeza',
  'higiene-pessoal': 'Cuidados Pessoais e Limpeza',
  'limpeza': 'Cuidados Pessoais e Limpeza',

  // === AUTOMOTIVO ===
  'acessorios-para-veiculos': 'Automotivo',
  'automotivo': 'Automotivo',
  'carros': 'Automotivo',
  'motos': 'Automotivo',
  'acessorios-veiculos': 'Automotivo',
  'pneus': 'Automotivo',
  'som-automotivo': 'Automotivo',

  // === ALIMENTOS E BEBIDAS ===
  'alimentos-e-bebidas': 'Alimentos e Bebidas',
  'alimentos': 'Alimentos e Bebidas',
  'alimentos-bebidas': 'Alimentos e Bebidas',
  'bebidas': 'Alimentos e Bebidas',
  'mercearia': 'Alimentos e Bebidas',
  'suplementos': 'Alimentos e Bebidas',

  // === LIVROS E PAPELARIA ===
  'livros-e-revistas': 'Livros',
  'livros': 'Livros',
  'ebooks': 'eBooks',
  'papelaria': 'Papelaria e Escritório',
  'escritorio': 'Papelaria e Escritório',
  'material-escolar': 'Papelaria e Escritório',

  // === MÓVEIS ===
  'moveis': 'Móveis',
  'sofas': 'Móveis',
  'mesas': 'Móveis',
  'cadeiras': 'Móveis',
  'estantes': 'Móveis',
  'armarios': 'Móveis',
  'guarda-roupas': 'Móveis',
  'camas': 'Móveis',
  'colchoes': 'Móveis',

  // === FERRAMENTAS ===
  'ferramentas': 'Ferramentas e Construção',
  'ferramentas-construcao': 'Ferramentas e Construção',
  'construcao': 'Construção',
  'materiais-construcao': 'Construção',

  // === JARDIM E PISCINA ===
  'jardim': 'Jardim e Piscina',
  'jardim-piscina': 'Jardim e Piscina',
  'piscina': 'Jardim e Piscina',
  'jardinagem': 'Jardim e Piscina',
  'plantas': 'Jardim e Piscina',
  'churrasqueira': 'Jardim e Piscina',
};

// Estrutura completa para UI com subcategorias (legado - para marketplace)
export const CATEGORIAS_MARKETPLACE = [
  {
    id: 'moda',
    nome: 'Moda',
    nomeShopee: 'Roupas, Sapatos, Bolsas, Relógios',
    icone: '👔',
    subcategorias: [
      'Roupas Femininas',
      'Roupas Masculinas',
      'Roupas Plus Size',
      'Sapatos Femininos',
      'Sapatos Masculinos',
      'Bolsas Femininas',
      'Bolsas Masculinas',
      'Acessórios de Moda',
      'Relógios',
      'Moda Infantil',
      'Viagens e Bagagens'
    ]
  },
  {
    id: 'eletronicos',
    nome: 'Eletrônicos e Celulares',
    nomeShopee: 'Celulares e Dispositivos, Áudio, Câmeras',
    icone: '📱',
    subcategorias: [
      'Celulares e Dispositivos',
      'Áudio',
      'Câmeras e Drones',
      'Tablets',
      'Smartwatches',
      'Fones de Ouvido'
    ]
  },
  {
    id: 'informatica',
    nome: 'Informática',
    nomeShopee: 'Computadores e Acessórios',
    icone: '💻',
    subcategorias: [
      'Notebooks',
      'Computadores',
      'Monitores',
      'Periféricos',
      'Armazenamento',
      'Redes e Wi-Fi'
    ]
  },
  {
    id: 'games',
    nome: 'Video Games',
    nomeShopee: 'Jogos e Consoles',
    icone: '🎮',
    subcategorias: [
      'PlayStation',
      'Xbox',
      'Nintendo',
      'PC Gaming',
      'Acessórios Gamer'
    ]
  },
  {
    id: 'pets',
    nome: 'Pet Shop',
    nomeShopee: 'Animais Domésticos',
    icone: '🐾',
    subcategorias: [
      'Ração',
      'Brinquedos',
      'Higiene',
      'Acessórios',
      'Saúde',
      'Casinhas e Camas'
    ]
  },
  {
    id: 'bebe',
    nome: 'Bebês',
    nomeShopee: 'Mãe e Bebê',
    icone: '👶',
    subcategorias: [
      'Alimentação',
      'Fraldas',
      'Higiene',
      'Roupas',
      'Brinquedos',
      'Carrinhos'
    ]
  },
  {
    id: 'casa',
    nome: 'Casa',
    nomeShopee: 'Casa e Decoração',
    icone: '🏠',
    subcategorias: [
      'Decoração',
      'Cama, Mesa e Banho',
      'Organização',
      'Iluminação',
      'Tapetes e Cortinas'
    ]
  },
  {
    id: 'cozinha',
    nome: 'Cozinha',
    nomeShopee: 'Cozinha',
    icone: '🍳',
    subcategorias: [
      'Panelas',
      'Utensílios',
      'Talheres',
      'Copos e Pratos',
      'Organização'
    ]
  },
  {
    id: 'eletrodomesticos',
    nome: 'Eletrodomésticos',
    nomeShopee: 'Eletrodomésticos',
    icone: '🔌',
    subcategorias: [
      'Ar-condicionado',
      'Geladeiras',
      'Máquinas de Lavar',
      'Aspiradores',
      'Cafeteiras',
      'Fritadeiras'
    ]
  },
  {
    id: 'esportes',
    nome: 'Esportes e Aventura',
    nomeShopee: 'Esportes e Lazer',
    icone: '⚽',
    subcategorias: [
      'Fitness',
      'Ciclismo',
      'Camping',
      'Futebol',
      'Natação'
    ]
  },
  {
    id: 'brinquedos',
    nome: 'Brinquedos e Jogos',
    nomeShopee: 'Brinquedos e Hobbies',
    icone: '🧸',
    subcategorias: [
      'Bonecas',
      'Carrinhos',
      'LEGO',
      'Jogos de Tabuleiro',
      'Pelúcias'
    ]
  },
  {
    id: 'beleza',
    nome: 'Beleza',
    nomeShopee: 'Beleza',
    icone: '💄',
    subcategorias: [
      'Maquiagem',
      'Perfumes',
      'Skincare',
      'Cabelos',
      'Cosméticos'
    ]
  },
  {
    id: 'saude',
    nome: 'Cuidados Pessoais e Limpeza',
    nomeShopee: 'Saúde',
    icone: '🧴',
    subcategorias: [
      'Higiene Pessoal',
      'Limpeza',
      'Saúde',
      'Bem-estar'
    ]
  },
  {
    id: 'automotivo',
    nome: 'Automotivo',
    nomeShopee: 'Acessórios para Veículos',
    icone: '🚗',
    subcategorias: [
      'Acessórios',
      'Som Automotivo',
      'Ferramentas',
      'Limpeza',
      'Peças'
    ]
  },
  {
    id: 'alimentos',
    nome: 'Alimentos e Bebidas',
    nomeShopee: 'Alimentos e Bebidas',
    icone: '🍴',
    subcategorias: [
      'Mercearia',
      'Bebidas',
      'Suplementos',
      'Doces'
    ]
  },
  {
    id: 'livros',
    nome: 'Livros',
    nomeShopee: 'Livros e Revistas',
    icone: '📚',
    subcategorias: [
      'Ficção',
      'Não-ficção',
      'Infantil',
      'Técnicos',
      'Revistas'
    ]
  },
  {
    id: 'papelaria',
    nome: 'Papelaria e Escritório',
    nomeShopee: 'Papelaria',
    icone: '📝',
    subcategorias: [
      'Material Escolar',
      'Canetas e Lápis',
      'Cadernos',
      'Organização',
      'Mochilas'
    ]
  },
  {
    id: 'ferramentas',
    nome: 'Ferramentas e Construção',
    nomeShopee: 'Ferramentas',
    icone: '🔧',
    subcategorias: [
      'Ferramentas Manuais',
      'Ferramentas Elétricas',
      'Elétrica',
      'Hidráulica'
    ]
  },
  {
    id: 'moveis',
    nome: 'Móveis',
    nomeShopee: 'Móveis',
    icone: '🛋️',
    subcategorias: [
      'Sofás',
      'Mesas',
      'Cadeiras',
      'Estantes',
      'Camas'
    ]
  },
  {
    id: 'jardim',
    nome: 'Jardim e Piscina',
    nomeShopee: 'Jardim e Piscina',
    icone: '🌿',
    subcategorias: [
      'Jardinagem',
      'Piscina',
      'Churrasqueira',
      'Decoração Externa'
    ]
  }
];

// Função helper para detectar categoria por palavras-chave no título
export function detectarCategoriaPorTitulo(titulo: string): CategoriaValida | null {
  const tituloLower = titulo.toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '');

  const PALAVRAS_CATEGORIA: Record<CategoriaValida, string[]> = {
    'Eletrônicos e Celulares': ['celular', 'smartphone', 'iphone', 'samsung', 'xiaomi', 'fone', 'earbuds', 'airpods', 'carregador', 'powerbank', 'smartwatch', 'tablet', 'caixa de som', 'bluetooth', 'camera', 'drone'],
    'Informática': ['notebook', 'laptop', 'computador', 'pc gamer', 'teclado', 'mouse', 'monitor', 'webcam', 'pendrive', 'ssd', 'hd externo', 'impressora', 'roteador'],
    'Video Games': ['playstation', 'ps4', 'ps5', 'xbox', 'nintendo', 'switch', 'controle gamer', 'joystick', 'headset gamer', 'console'],
    'Beleza': ['maquiagem', 'batom', 'base', 'rimel', 'sombra', 'perfume', 'hidratante', 'shampoo', 'condicionador', 'creme', 'serum', 'skincare', 'protetor solar'],
    'Moda': ['vestido', 'camisa', 'camiseta', 'calca', 'short', 'saia', 'blusa', 'casaco', 'jaqueta', 'tenis', 'sapato', 'sandalia', 'bolsa', 'mochila', 'relogio', 'oculos', 'brinco', 'colar', 'pulseira', 'chinelo'],
    'Casa': ['almofada', 'cortina', 'tapete', 'quadro', 'vaso decorativo', 'luminaria', 'organizador', 'toalha', 'lencol', 'cobertor', 'edredom'],
    'Cozinha': ['panela', 'frigideira', 'prato', 'copo', 'talher', 'faca', 'forma', 'assadeira', 'garrafa termica', 'pote'],
    'Eletrodomésticos': ['geladeira', 'fogao', 'microondas', 'air fryer', 'fritadeira', 'liquidificador', 'batedeira', 'cafeteira', 'aspirador', 'ventilador', 'ar condicionado', 'secador', 'prancha'],
    'Bebês': ['fralda', 'mamadeira', 'chupeta', 'carrinho bebe', 'berco', 'body', 'babador', 'mordedor', 'banheira bebe'],
    'Brinquedos e Jogos': ['boneca', 'lego', 'puzzle', 'quebra-cabeca', 'pelucia', 'brinquedo', 'jogo tabuleiro', 'boneco', 'nerf'],
    'Pet Shop': ['racao', 'petisco', 'coleira', 'comedouro', 'cama pet', 'brinquedo cachorro', 'brinquedo gato', 'areia gato'],
    'Esportes e Aventura': ['bola', 'academia', 'haltere', 'yoga', 'bicicleta', 'patins', 'caneleira', 'garrafa academia'],
    'Automotivo': ['carro', 'moto', 'pneu', 'retrovisor', 'tapete carro', 'suporte celular carro', 'oleo motor'],
    'Alimentos e Bebidas': ['chocolate', 'cafe', 'biscoito', 'whey', 'vitamina', 'suplemento', 'cha', 'cereal'],
    'Livros': ['livro', 'manga', 'revista', 'romance'],
    'eBooks': ['ebook', 'kindle'],
    'Papelaria e Escritório': ['caderno', 'caneta', 'lapis', 'agenda', 'post-it', 'grampeador', 'estojo', 'fichario', 'papel'],
    'Cuidados Pessoais e Limpeza': ['sabonete', 'desodorante', 'escova de dente', 'pasta de dente', 'absorvente', 'papel higienico', 'detergente', 'sabao', 'desinfetante', 'alcool'],
    'Móveis': ['sofa', 'mesa', 'cadeira', 'estante', 'rack', 'guarda-roupa', 'escrivaninha', 'poltrona', 'criado mudo'],
    'Jardim e Piscina': ['mangueira', 'regador', 'vaso planta', 'semente', 'boia', 'piscina', 'churrasqueira'],
    'Ferramentas e Construção': ['furadeira', 'parafusadeira', 'martelo', 'chave fenda', 'alicate', 'fita metrica', 'serra', 'broca'],
    'Construção': ['cimento', 'tijolo', 'argamassa', 'piso', 'azulejo']
  };

  for (const [categoria, palavras] of Object.entries(PALAVRAS_CATEGORIA)) {
    for (const palavra of palavras) {
      if (tituloLower.includes(palavra)) {
        return categoria as CategoriaValida;
      }
    }
  }

  return null;
}
