export type Marketplace = 'amazon' | 'shopee' | 'aliexpress' | 'lomadee' | 'hotmart' | 'eduzz' | 'monetizze';

export type Category = 
  | '📱 Eletrônicos'
  | '🏠 Casa e Cozinha'
  | '👶 Bebês'
  | '👗 Moda'
  | '💄 Beleza'
  | '⚽ Esportes'
  | '🎮 Games'
  | '🐶 Pet Shop'
  | '🧸 Brinquedos'
  | '💊 Saúde e Suplementos'
  | '📚 Livros'
  | '🔧 Ferramentas'
  | '🚗 Automotivo'
  | '💼 Negócios'
  | '📖 Educação'
  | '💪 Fitness'
  | '💰 Finanças';

export type Badge = '🌟 NOVO' | '🔥 LANÇAMENTO' | '⭐ TOP VENDAS' | '📈 EM ALTA';

export interface Product {
  id: string;
  title: string;
  description: string;
  price: number;
  originalPrice?: number;
  commission: number;
  commissionPercent: number;
  marketplace: Marketplace;
  category: Category;
  imageUrl: string;
  affiliateLink: string;
  rating: number;
  reviews: number;
  sales: number;
  badge?: Badge;
  createdAt: Date;
  
  // Campos preparados para futuras integrações
  asin?: string; // Amazon
  roi?: number;
  pixelId?: string;
  lastScraped?: Date;
  bsr?: number; // Best Sellers Rank - para estimativa de vendas
  bsrCategory?: string; // Categoria BSR (ex: "Books", "Electronics")
}
