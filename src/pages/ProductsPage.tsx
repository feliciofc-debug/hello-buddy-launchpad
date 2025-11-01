import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import ProductCard from '@/components/ProductCard';
import { LomadeeStoreModal } from '@/components/LomadeeStoreModal';
import type { Product } from '@/data/mockData';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedStore, setSelectedStore] = useState<{ name: string; logo: string; commission: string } | null>(null);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);

  // Lista de lojas fixas com logos
  const lojas: Product[] = [
    {
      id: '1',
      title: "Magazine Luiza",
      imageUrl: "https://logodownload.org/wp-content/uploads/2014/05/magazine-luiza-logo.png",
      commissionPercent: 12,
      marketplace: 'lomadee',
      category: '💼 Negócios',
      description: "2500 produtos disponíveis",
      price: 0,
      commission: 12,
      affiliateLink: "#",
      rating: 0,
      reviews: 0,
      sales: 2500,
      createdAt: new Date(),
      bsr: 0,
      bsrCategory: 'Business'
    },
    {
      id: '2',
      title: "Americanas",
      imageUrl: "https://logodownload.org/wp-content/uploads/2014/09/americanas-logo.png",
      commissionPercent: 10,
      marketplace: 'lomadee',
      category: '💼 Negócios',
      description: "1800 produtos disponíveis",
      price: 0,
      commission: 10,
      affiliateLink: "#",
      rating: 0,
      reviews: 0,
      sales: 1800,
      createdAt: new Date(),
      bsr: 0,
      bsrCategory: 'Business'
    },
    {
      id: '3',
      title: "Casas Bahia",
      imageUrl: "https://logodownload.org/wp-content/uploads/2020/04/casas-bahia-logo.png",
      commissionPercent: 11,
      marketplace: 'lomadee',
      category: '💼 Negócios',
      description: "3200 produtos disponíveis",
      price: 0,
      commission: 11,
      affiliateLink: "#",
      rating: 0,
      reviews: 0,
      sales: 3200,
      createdAt: new Date(),
      bsr: 0,
      bsrCategory: 'Business'
    },
    {
      id: '4',
      title: "Submarino",
      imageUrl: "https://logodownload.org/wp-content/uploads/2014/09/submarino-logo.png",
      commissionPercent: 9,
      marketplace: 'lomadee',
      category: '💼 Negócios',
      description: "1500 produtos disponíveis",
      price: 0,
      commission: 9,
      affiliateLink: "#",
      rating: 0,
      reviews: 0,
      sales: 1500,
      createdAt: new Date(),
      bsr: 0,
      bsrCategory: 'Business'
    },
    {
      id: '5',
      title: "Extra",
      imageUrl: "https://logodownload.org/wp-content/uploads/2019/01/extra-logo.png",
      commissionPercent: 10,
      marketplace: 'lomadee',
      category: '💼 Negócios',
      description: "2100 produtos disponíveis",
      price: 0,
      commission: 10,
      affiliateLink: "#",
      rating: 0,
      reviews: 0,
      sales: 2100,
      createdAt: new Date(),
      bsr: 0,
      bsrCategory: 'Business'
    },
    {
      id: '6',
      title: "Ponto Frio",
      imageUrl: "https://logodownload.org/wp-content/uploads/2014/09/ponto-frio-logo.png",
      commissionPercent: 9,
      marketplace: 'lomadee',
      category: '💼 Negócios',
      description: "1900 produtos disponíveis",
      price: 0,
      commission: 9,
      affiliateLink: "#",
      rating: 0,
      reviews: 0,
      sales: 1900,
      createdAt: new Date(),
      bsr: 0,
      bsrCategory: 'Business'
    }
  ];

  const handleOpenStore = (loja: Product) => {
    setSelectedStore({
      name: loja.title,
      logo: loja.imageUrl,
      commission: `até ${loja.commissionPercent}%`
    });
    setIsStoreModalOpen(true);
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <div className="bg-card shadow-sm border-b">
        <div className="max-w-7xl mx-auto px-4 py-6">
          <div className="flex items-center justify-between mb-4">
            <button
              onClick={() => navigate('/dashboard')}
              className="flex items-center gap-2 text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              Voltar
            </button>
            <ThemeToggle />
          </div>
          
          <div className="text-center">
            <h1 className="text-3xl font-bold text-foreground flex items-center justify-center gap-2 mb-2">
              <ShoppingBag className="w-8 h-8" />
              Produtos Disponíveis
            </h1>
            <p className="text-muted-foreground text-lg">
              Selecione uma loja para ver produtos e criar campanhas com IA
            </p>
          </div>
        </div>
      </div>

      {/* Banner IA Marketing */}
      <div className="max-w-7xl mx-auto px-4 py-6">
        <div className="p-6 bg-gradient-to-r from-purple-500 to-indigo-600 rounded-xl shadow-2xl border-2 border-purple-400 mb-8">
          <div className="flex flex-col md:flex-row items-center justify-between gap-4">
            <p className="text-center md:text-left text-lg font-semibold text-white">
              💡 Clique em uma loja, selecione produtos e crie campanhas automaticamente com IA!
            </p>
            <button
              onClick={() => navigate('/ia-marketing')}
              className="whitespace-nowrap px-8 py-3 bg-white text-purple-600 rounded-lg font-bold hover:bg-purple-50 transition-colors shadow-lg hover:shadow-xl"
            >
              USAR IA MARKETING ➡️
            </button>
          </div>
        </div>

        {/* Grid de Lojas */}
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {lojas.map((loja) => (
            <Card 
              key={loja.id}
              className="hover:shadow-xl cursor-pointer transition-all duration-300 border-2 hover:border-primary"
              onClick={() => handleOpenStore(loja)}
            >
              <CardContent className="p-6 flex flex-col items-center text-center">
                <div className="w-full h-24 flex items-center justify-center mb-4 bg-white rounded-lg p-4">
                  <img
                    src={loja.imageUrl}
                    alt={loja.title}
                    className="max-h-16 max-w-full object-contain"
                    onError={(e) => {
                      e.currentTarget.src = 'https://via.placeholder.com/200x80?text=' + loja.title;
                    }}
                  />
                </div>
                
                <h3 className="text-xl font-bold text-foreground mb-2">
                  {loja.title}
                </h3>
                
                <p className="text-sm text-muted-foreground mb-4">
                  {loja.sales.toLocaleString()} produtos disponíveis
                </p>
                
                <Badge className="mb-4 bg-green-600 hover:bg-green-700 text-white">
                  Até {loja.commissionPercent}% de comissão
                </Badge>
                
                <Button className="w-full mt-auto bg-primary hover:bg-primary/90">
                  Ver Produtos
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>

      {/* Modal de Produtos da Loja */}
      <LomadeeStoreModal
        store={selectedStore}
        open={isStoreModalOpen}
        onClose={() => {
          setIsStoreModalOpen(false);
          setSelectedStore(null);
        }}
      />
    </div>
  );
};

export default ProductsPage;
