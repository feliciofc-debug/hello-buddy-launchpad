import { useState } from 'react';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Search, TrendingUp, Star, ExternalLink, Package, Tag, Zap, ShoppingCart } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

interface Product {
  id: string;
  title: string;
  image: string;
  price: number;
  originalPrice?: number;
  commission: number;
  category: string;
  rating: number;
  sales: number;
  affiliateLink: string;
  badge?: string;
  description: string;
}

const mockProducts: Product[] = [
  {
    id: '1',
    title: 'Headphone Bluetooth Premium com Cancelamento de Ruído',
    image: '🎧',
    price: 299.90,
    originalPrice: 499.90,
    commission: 15,
    category: '📱 Eletrônicos',
    rating: 4.8,
    sales: 1250,
    affiliateLink: 'https://amazon.com/produto1',
    badge: '🔥 SUPER OFERTA',
    description: 'Som de alta qualidade com bateria de 40h'
  },
  {
    id: '2',
    title: 'Kit de Maquiagem Profissional Completo',
    image: '💄',
    price: 189.90,
    originalPrice: 349.90,
    commission: 20,
    category: '💄 Beleza',
    rating: 4.9,
    sales: 890,
    affiliateLink: 'https://amazon.com/produto2',
    badge: '⭐ MAIS VENDIDO',
    description: 'Kit com 25 itens profissionais'
  },
  {
    id: '3',
    title: 'Smartwatch Fitness com Monitor Cardíaco',
    image: '⌚',
    price: 449.90,
    originalPrice: 699.90,
    commission: 18,
    category: '📱 Eletrônicos',
    rating: 4.7,
    sales: 650,
    affiliateLink: 'https://amazon.com/produto3',
    badge: '🌟 NOVIDADE',
    description: 'À prova d\'água com GPS integrado'
  },
  {
    id: '4',
    title: 'Whey Protein Premium 900g - Chocolate',
    image: '💪',
    price: 99.90,
    originalPrice: 149.90,
    commission: 25,
    category: '💊 Saúde',
    rating: 4.9,
    sales: 2100,
    affiliateLink: 'https://amazon.com/produto4',
    badge: '🔥 SUPER OFERTA',
    description: 'Alta concentração de proteínas'
  },
  {
    id: '5',
    title: 'Air Fryer Digital 5L com Painel Touch',
    image: '🍳',
    price: 349.90,
    originalPrice: 599.90,
    commission: 22,
    category: '🏠 Casa',
    rating: 4.8,
    sales: 1450,
    affiliateLink: 'https://amazon.com/produto5',
    badge: '⭐ MAIS VENDIDO',
    description: 'Fritadeira sem óleo com 8 funções'
  },
  {
    id: '6',
    title: 'Cafeteira Expresso Automática Premium',
    image: '☕',
    price: 899.90,
    originalPrice: 1299.90,
    commission: 20,
    category: '🏠 Casa',
    rating: 4.9,
    sales: 420,
    affiliateLink: 'https://amazon.com/produto6',
    description: 'Prepara café profissional em casa'
  },
  {
    id: '7',
    title: 'Tênis Running Pro com Tecnologia de Amortecimento',
    image: '👟',
    price: 279.90,
    originalPrice: 449.90,
    commission: 18,
    category: '⚽ Esportes',
    rating: 4.7,
    sales: 980,
    affiliateLink: 'https://amazon.com/produto7',
    badge: '🌟 NOVIDADE',
    description: 'Máximo conforto para corridas'
  },
  {
    id: '8',
    title: 'Câmera de Segurança WiFi 360° com Visão Noturna',
    image: '📹',
    price: 199.90,
    originalPrice: 349.90,
    commission: 23,
    category: '🏠 Casa',
    rating: 4.6,
    sales: 750,
    affiliateLink: 'https://amazon.com/produto8',
    description: 'Controle pelo celular em tempo real'
  },
];

const categories = [
  'Todas',
  '📱 Eletrônicos',
  '💄 Beleza',
  '🏠 Casa',
  '💊 Saúde',
  '⚽ Esportes'
];

export default function MarketplacePublico() {
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('Todas');
  const [sortBy, setSortBy] = useState('popular');

  const filteredProducts = mockProducts
    .filter(product => {
      const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
                          product.description.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === 'Todas' || product.category === selectedCategory;
      return matchesSearch && matchesCategory;
    })
    .sort((a, b) => {
      if (sortBy === 'price-asc') return a.price - b.price;
      if (sortBy === 'price-desc') return b.price - a.price;
      if (sortBy === 'commission') return b.commission - a.commission;
      return b.sales - a.sales; // popular (default)
    });

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-muted">
      {/* Header */}
      <header className="bg-card border-b border-border sticky top-0 z-50 shadow-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="text-3xl">🛍️</div>
              <div>
                <h1 className="text-2xl font-bold bg-gradient-to-r from-primary to-purple-600 bg-clip-text text-transparent">
                  AMZ Ofertas
                </h1>
                <p className="text-xs text-muted-foreground">Marketplace de Ofertas Premium</p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <Badge variant="secondary" className="gap-1">
                <TrendingUp className="w-3 h-3" />
                {mockProducts.length} Ofertas
              </Badge>
            </div>
          </div>
        </div>
      </header>

      {/* Hero Section */}
      <section className="bg-gradient-to-r from-primary/10 via-purple-500/10 to-primary/10 py-12 border-b border-border">
        <div className="container mx-auto px-4">
          <div className="text-center max-w-3xl mx-auto">
            <h2 className="text-4xl font-bold mb-4">
              Melhores Ofertas com <span className="text-primary">Comissões Premium</span>
            </h2>
            <p className="text-lg text-muted-foreground mb-8">
              Produtos selecionados das melhores marcas com até 25% de comissão
            </p>

            {/* Search Bar */}
            <div className="relative max-w-2xl mx-auto">
              <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-muted-foreground w-5 h-5" />
              <Input
                type="text"
                placeholder="Buscar produtos..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="pl-12 h-14 text-lg bg-card"
              />
            </div>
          </div>
        </div>
      </section>

      {/* Filters */}
      <section className="border-b border-border bg-card/50">
        <div className="container mx-auto px-4 py-6">
          <div className="flex flex-col md:flex-row gap-4 items-start md:items-center justify-between">
            <div className="flex gap-2 flex-wrap">
              {categories.map(cat => (
                <Button
                  key={cat}
                  variant={selectedCategory === cat ? "default" : "outline"}
                  size="sm"
                  onClick={() => setSelectedCategory(cat)}
                  className="gap-1"
                >
                  {cat}
                </Button>
              ))}
            </div>
            <Select value={sortBy} onValueChange={setSortBy}>
              <SelectTrigger className="w-[200px]">
                <SelectValue placeholder="Ordenar por" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="popular">Mais Populares</SelectItem>
                <SelectItem value="price-asc">Menor Preço</SelectItem>
                <SelectItem value="price-desc">Maior Preço</SelectItem>
                <SelectItem value="commission">Maior Comissão</SelectItem>
              </SelectContent>
            </Select>
          </div>
        </div>
      </section>

      {/* Products Grid */}
      <section className="py-12">
        <div className="container mx-auto px-4">
          {filteredProducts.length === 0 ? (
            <div className="text-center py-20">
              <Package className="w-20 h-20 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum produto encontrado</h3>
              <p className="text-muted-foreground">Tente ajustar os filtros de busca</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
              {filteredProducts.map(product => (
                <Card key={product.id} className="group hover:shadow-xl transition-all duration-300 overflow-hidden border-border hover:border-primary/50">
                  <CardContent className="p-0">
                    {/* Product Image */}
                    <div className="relative bg-gradient-to-br from-muted to-muted/50 h-48 flex items-center justify-center">
                      <div className="text-7xl transform group-hover:scale-110 transition-transform">
                        {product.image}
                      </div>
                      {product.badge && (
                        <Badge className="absolute top-3 right-3 bg-destructive text-destructive-foreground">
                          {product.badge}
                        </Badge>
                      )}
                      <div className="absolute top-3 left-3 bg-primary text-primary-foreground px-3 py-1 rounded-full text-xs font-bold flex items-center gap-1">
                        <Zap className="w-3 h-3" />
                        {product.commission}% comissão
                      </div>
                    </div>

                    {/* Product Info */}
                    <div className="p-4 space-y-3">
                      <div className="flex items-start justify-between gap-2">
                        <Badge variant="outline" className="text-xs">
                          {product.category}
                        </Badge>
                        <div className="flex items-center gap-1 text-xs">
                          <Star className="w-3 h-3 fill-yellow-400 text-yellow-400" />
                          <span className="font-semibold">{product.rating}</span>
                        </div>
                      </div>

                      <h3 className="font-semibold line-clamp-2 min-h-[3rem]">
                        {product.title}
                      </h3>

                      <p className="text-sm text-muted-foreground line-clamp-2">
                        {product.description}
                      </p>

                      <div className="flex items-center gap-2 text-xs text-muted-foreground">
                        <ShoppingCart className="w-3 h-3" />
                        <span>{product.sales.toLocaleString()} vendas</span>
                      </div>

                      <div className="space-y-1">
                        {product.originalPrice && (
                          <div className="text-sm text-muted-foreground line-through">
                            R$ {product.originalPrice.toFixed(2)}
                          </div>
                        )}
                        <div className="text-2xl font-bold text-primary">
                          R$ {product.price.toFixed(2)}
                        </div>
                        {product.originalPrice && (
                          <Badge variant="secondary" className="text-xs">
                            <Tag className="w-3 h-3 mr-1" />
                            {Math.round(((product.originalPrice - product.price) / product.originalPrice) * 100)}% OFF
                          </Badge>
                        )}
                      </div>

                      <Button 
                        className="w-full gap-2" 
                        asChild
                      >
                        <a href={product.affiliateLink} target="_blank" rel="noopener noreferrer">
                          Ver Oferta
                          <ExternalLink className="w-4 h-4" />
                        </a>
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-border bg-card mt-12">
        <div className="container mx-auto px-4 py-8">
          <div className="text-center text-sm text-muted-foreground">
            <p className="mb-2">© 2024 AMZ Ofertas. Todos os direitos reservados.</p>
            <p>Marketplace de ofertas premium com as melhores comissões do mercado</p>
            <p className="mt-4">
              <a href="mailto:suporte@amzofertas.com.br" className="hover:text-primary transition">
                suporte@amzofertas.com.br
              </a>
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}
