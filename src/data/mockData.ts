import type { Product, Marketplace, Category, Badge } from '@/types/product';

// Re-export types for backward compatibility
export type { Marketplace, Category, Badge, Product };

// Função helper para calcular badge
function calculateBadge(createdAt: Date, sales: number): Badge | undefined {
  const daysSinceCreated = Math.floor((Date.now() - createdAt.getTime()) / (1000 * 60 * 60 * 24));
  
  if (daysSinceCreated <= 7) return '🔥 LANÇAMENTO';
  if (daysSinceCreated <= 30) return '🌟 NOVO';
  if (sales > 1000) return '⭐ TOP VENDAS';
  if (sales > 500) return '📈 EM ALTA';
  
  return undefined;
}

// Mock de produtos realistas
export const mockProducts: Product[] = [
  // AMAZON - Eletrônicos
  {
    id: 'amz-001',
    title: 'Fone de Ouvido Bluetooth JBL Tune 510BT',
    description: 'Som puro por até 40 horas. Bluetooth 5.0. Microfone integrado.',
    price: 189.90,
    originalPrice: 299.90,
    commission: 28.49,
    commissionPercent: 15,
    marketplace: 'amazon',
    category: '📱 Eletrônicos',
    imageUrl: 'https://images.unsplash.com/photo-1505740420928-5e560c06d30e?w=400',
    affiliateLink: 'https://amzn.to/abc123',
    rating: 4.7,
    reviews: 15234,
    sales: 2340,
    badge: '⭐ TOP VENDAS',
    createdAt: new Date('2024-08-15'),
    bsr: 450,
    bsrCategory: 'Electronics'
  },
  {
    id: 'amz-002',
    title: 'Smart Watch P8 Plus - Monitor Cardíaco',
    description: 'Tela AMOLED, GPS, À prova d\'água IP68, Bateria 7 dias',
    price: 159.90,
    originalPrice: 399.90,
    commission: 31.98,
    commissionPercent: 20,
    marketplace: 'amazon',
    category: '📱 Eletrônicos',
    imageUrl: 'https://images.unsplash.com/photo-1523275335684-37898b6baf30?w=400',
    affiliateLink: 'https://amzn.to/abc124',
    rating: 4.5,
    reviews: 8945,
    sales: 1876,
    badge: '📈 EM ALTA',
    createdAt: new Date('2024-09-20'),
    bsr: 850,
    bsrCategory: 'Electronics'
  },
  
  // SHOPEE - Casa e Cozinha
  {
    id: 'shp-001',
    title: 'Air Fryer 4.5L Philco Digital - Fritadeira Elétrica',
    description: 'Sem óleo, 7 programas automáticos, timer digital',
    price: 279.90,
    originalPrice: 599.90,
    commission: 55.98,
    commissionPercent: 20,
    marketplace: 'shopee',
    category: '🏠 Casa e Cozinha',
    imageUrl: 'https://images.unsplash.com/photo-1585515320310-259814833e62?w=400',
    affiliateLink: 'https://shope.ee/xyz789',
    rating: 4.8,
    reviews: 23456,
    sales: 3421,
    badge: '⭐ TOP VENDAS',
    createdAt: new Date('2024-07-10'),
    bsr: 320,
    bsrCategory: 'Home & Kitchen'
  },
  {
    id: 'shp-002',
    title: 'Jogo de Panelas Antiaderente Tramontina 5 Peças',
    description: 'Revestimento antiaderente interno e externo',
    price: 199.90,
    originalPrice: 399.90,
    commission: 39.98,
    commissionPercent: 20,
    marketplace: 'shopee',
    category: '🏠 Casa e Cozinha',
    imageUrl: 'https://images.unsplash.com/photo-1584990347449-39eae7ce1b88?w=400',
    affiliateLink: 'https://shope.ee/xyz790',
    rating: 4.6,
    reviews: 5678,
    sales: 892,
    badge: '📈 EM ALTA',
    createdAt: new Date('2024-09-25'),
    bsr: 1200,
    bsrCategory: 'Home & Kitchen'
  },

  // ALIEXPRESS - Moda
  {
    id: 'ali-001',
    title: 'Tênis Esportivo Masculino Premium - Running',
    description: 'Palmilha ortopédica, respirável, antiderrapante',
    price: 89.90,
    commission: 17.98,
    commissionPercent: 20,
    marketplace: 'aliexpress',
    category: '👗 Moda',
    imageUrl: 'https://images.unsplash.com/photo-1542291026-7eec264c27ff?w=400',
    affiliateLink: 'https://s.click.aliexpress.com/abc',
    rating: 4.4,
    reviews: 12789,
    sales: 4567,
    badge: '⭐ TOP VENDAS',
    createdAt: new Date('2024-06-05'),
    bsr: 280,
    bsrCategory: 'Clothing, Shoes & Jewelry'
  },
  {
    id: 'ali-002',
    title: 'Bolsa Feminina Couro Sintético - Grande Capacidade',
    description: 'Elegante, durável, vários compartimentos',
    price: 79.90,
    commission: 15.98,
    commissionPercent: 20,
    marketplace: 'aliexpress',
    category: '👗 Moda',
    imageUrl: 'https://images.unsplash.com/photo-1548036328-c9fa89d128fa?w=400',
    affiliateLink: 'https://s.click.aliexpress.com/def',
    rating: 4.3,
    reviews: 3456,
    sales: 234,
    badge: '🌟 NOVO',
    createdAt: new Date('2024-10-01'),
    bsr: 2500,
    bsrCategory: 'Clothing, Shoes & Jewelry'
  },

  // HOTMART - Infoprodutos
  {
    id: 'hot-001',
    title: 'Curso Completo de Marketing Digital 2025',
    description: 'Do zero ao avançado. SEO, Tráfego Pago, Copywriting, Funil de Vendas',
    price: 497.00,
    commission: 298.20,
    commissionPercent: 60,
    marketplace: 'hotmart',
    category: '💼 Negócios',
    imageUrl: 'https://images.unsplash.com/photo-1460925895917-afdab827c52f?w=400',
    affiliateLink: 'https://go.hotmart.com/abc123',
    rating: 4.9,
    reviews: 8934,
    sales: 12456,
    badge: '⭐ TOP VENDAS',
    createdAt: new Date('2024-01-15'),
    bsr: 50,
    bsrCategory: 'Books'
  },
  {
    id: 'hot-002',
    title: 'Mentoria: Afiliado Profissional em 60 Dias',
    description: 'Método comprovado. Mais de 1000 alunos. Suporte direto.',
    price: 997.00,
    commission: 698.90,
    commissionPercent: 70,
    marketplace: 'hotmart',
    category: '💼 Negócios',
    imageUrl: 'https://images.unsplash.com/photo-1551836022-deb4988cc6c0?w=400',
    affiliateLink: 'https://go.hotmart.com/def456',
    rating: 5.0,
    reviews: 456,
    sales: 89,
    badge: '🔥 LANÇAMENTO',
    createdAt: new Date('2024-10-12'),
    bsr: 5000,
    bsrCategory: 'Books'
  },

  // LOMADEE - Pet Shop
  {
    id: 'lom-001',
    title: 'Ração Premium Golden Fórmula para Cães Adultos 15kg',
    description: 'Nutrição completa e balanceada para cães adultos',
    price: 189.90,
    commission: 37.98,
    commissionPercent: 20,
    marketplace: 'lomadee',
    category: '🐶 Pet Shop',
    imageUrl: 'https://images.unsplash.com/photo-1589924691995-400dc9ecc119?w=400',
    affiliateLink: 'https://lomadee.com/abc123',
    rating: 4.7,
    reviews: 2345,
    sales: 567,
    badge: '📈 EM ALTA',
    createdAt: new Date('2024-09-15'),
    bsr: 800,
    bsrCategory: 'default'
  },

  // SAÚDE E SUPLEMENTOS
  {
    id: 'amz-003',
    title: 'Whey Protein Concentrado 900g - Chocolate',
    description: 'Alto teor proteico, baixo carboidrato, sem lactose',
    price: 89.90,
    originalPrice: 149.90,
    commission: 17.98,
    commissionPercent: 20,
    marketplace: 'amazon',
    category: '💊 Saúde e Suplementos',
    imageUrl: 'https://images.unsplash.com/photo-1579722820308-d74e571900a9?w=400',
    affiliateLink: 'https://amzn.to/whey123',
    rating: 4.8,
    reviews: 9876,
    sales: 4321,
    badge: '⭐ TOP VENDAS',
    createdAt: new Date('2024-05-20'),
    bsr: 150,
    bsrCategory: 'Health & Household'
  },

  // BRINQUEDOS
  {
    id: 'shp-003',
    title: 'Kit LEGO Technic - Carro de Corrida 458 Peças',
    description: 'Desenvolve criatividade e coordenação motora',
    price: 149.90,
    commission: 29.98,
    commissionPercent: 20,
    marketplace: 'shopee',
    category: '🧸 Brinquedos',
    imageUrl: 'https://images.unsplash.com/photo-1587654780291-39c9404d746b?w=400',
    affiliateLink: 'https://shope.ee/lego456',
    rating: 4.9,
    reviews: 1234,
    sales: 456,
    badge: '📈 EM ALTA',
    createdAt: new Date('2024-09-28'),
    bsr: 650,
    bsrCategory: 'Toys & Games'
  },

  // BELEZA
  {
    id: 'shp-004',
    title: 'Kit Skincare Completo - Ácido Hialurônico + Vitamina C',
    description: '5 produtos para rotina completa de cuidados com a pele',
    price: 129.90,
    originalPrice: 299.90,
    commission: 38.97,
    commissionPercent: 30,
    marketplace: 'shopee',
    category: '💄 Beleza',
    imageUrl: 'https://images.unsplash.com/photo-1556228578-0d85b1a4d571?w=400',
    affiliateLink: 'https://shope.ee/beauty789',
    rating: 4.6,
    reviews: 3456,
    sales: 123,
    badge: '🌟 NOVO',
    createdAt: new Date('2024-10-05'),
    bsr: 3500,
    bsrCategory: 'default'
  },

  // FITNESS
  {
    id: 'hot-003',
    title: 'Programa de Emagrecimento Definitivo - 12 Semanas',
    description: 'Treinos + Dieta + Acompanhamento. Resultado garantido.',
    price: 197.00,
    commission: 138.90,
    commissionPercent: 70,
    marketplace: 'hotmart',
    category: '💪 Fitness',
    imageUrl: 'https://images.unsplash.com/photo-1517836357463-d25dfeac3438?w=400',
    affiliateLink: 'https://go.hotmart.com/fit123',
    rating: 4.8,
    reviews: 5678,
    sales: 2345,
    badge: '⭐ TOP VENDAS',
    createdAt: new Date('2024-03-10'),
    bsr: 200,
    bsrCategory: 'Sports & Outdoors'
  }
];

// Filtrar produtos por marketplace
export const getProductsByMarketplace = (marketplace: Marketplace): Product[] => {
  return mockProducts.filter(p => p.marketplace === marketplace);
};

// Filtrar produtos por categoria
export const getProductsByCategory = (category: Category): Product[] => {
  return mockProducts.filter(p => p.category === category);
};

// Obter estatísticas
export const getStats = () => {
  return {
    totalProducts: mockProducts.length,
    totalCommission: mockProducts.reduce((acc, p) => acc + p.commission, 0),
    averageRating: mockProducts.reduce((acc, p) => acc + p.rating, 0) / mockProducts.length,
    topCategory: '📱 Eletrônicos'
  };
};
