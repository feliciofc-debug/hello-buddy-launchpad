import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LomadeeStoreModal } from '@/components/LomadeeStoreModal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types/product';

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedStore, setSelectedStore] = useState<{ name: string; logo: string; commission: string; products: Product[] } | null>(null);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);

  // Buscar produtos da Lomadee
  useEffect(() => {
    const fetchProducts = async () => {
      setIsLoading(true);
      try {
        const { data, error } = await supabase.functions.invoke('buscar-produtos-lomadee', {
          body: { searchTerm: '', limit: 100, offset: 0 }
        });

        if (error) throw error;

        const transformedProducts: Product[] = (data.produtos || []).map((produto: any) => ({
          id: produto.id,
          title: produto.nome,
          description: produto.nome,
          price: produto.preco,
          commission: produto.comissao,
          commissionPercent: produto.comissaoPercentual,
          marketplace: 'lomadee' as const,
          category: produto.categoria,
          imageUrl: produto.imagem,
          affiliateLink: produto.url,
          rating: produto.rating || 0,
          reviews: produto.reviews || 0,
          sales: produto.demandaMensal || 0,
          createdAt: new Date(produto.dataCadastro || Date.now()),
          bsr: 0,
          bsrCategory: 'Business',
          loja: produto.loja || 'Loja Parceira'
        }));

        setProducts(transformedProducts);
      } catch (err) {
        console.error('Erro ao buscar produtos:', err);
      } finally {
        setIsLoading(false);
      }
    };

    fetchProducts();
  }, []);

  // Agrupar produtos por loja
  const lojaGroups = products.reduce((acc, product) => {
    const lojaName = (product as any).loja || 'Loja Parceira';
    if (!acc[lojaName]) {
      acc[lojaName] = [];
    }
    acc[lojaName].push(product);
    return acc;
  }, {} as Record<string, Product[]>);

  // Lista de lojas com logos
  const lojas = [
    { name: "Magazine Luiza", logo: "https://logodownload.org/wp-content/uploads/2014/05/magazine-luiza-logo.png", commission: 12 },
    { name: "Americanas", logo: "https://logodownload.org/wp-content/uploads/2014/09/americanas-logo.png", commission: 10 },
    { name: "Casas Bahia", logo: "https://logodownload.org/wp-content/uploads/2020/04/casas-bahia-logo.png", commission: 11 },
    { name: "Submarino", logo: "https://logodownload.org/wp-content/uploads/2014/09/submarino-logo.png", commission: 9 },
    { name: "Extra", logo: "https://logodownload.org/wp-content/uploads/2019/01/extra-logo.png", commission: 10 },
    { name: "Ponto Frio", logo: "https://logodownload.org/wp-content/uploads/2014/09/ponto-frio-logo.png", commission: 9 }
  ];

  const handleOpenStore = (loja: { name: string; logo: string; commission: number }) => {
    const storeProducts = lojaGroups[loja.name] || [];
    setSelectedStore({
      name: loja.name,
      logo: loja.logo,
      commission: `até ${loja.commission}%`,
      products: storeProducts
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
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
            <p className="text-muted-foreground">Carregando lojas...</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lojas.map((loja) => {
              const productCount = lojaGroups[loja.name]?.length || 0;
              return (
                <Card 
                  key={loja.name}
                  className="hover:shadow-xl cursor-pointer transition-all duration-300 border-2 hover:border-primary"
                  onClick={() => handleOpenStore(loja)}
                >
                  <CardContent className="p-6 flex flex-col items-center text-center">
                    <div className="w-full h-24 flex items-center justify-center mb-4 bg-white rounded-lg p-4">
                      <img
                        src={loja.logo}
                        alt={loja.name}
                        className="max-h-16 max-w-full object-contain"
                        onError={(e) => {
                          e.currentTarget.src = 'https://via.placeholder.com/200x80?text=' + loja.name;
                        }}
                      />
                    </div>
                    
                    <h3 className="text-xl font-bold text-foreground mb-2">
                      {loja.name}
                    </h3>
                    
                    <p className="text-sm text-muted-foreground mb-4">
                      {productCount} produtos disponíveis
                    </p>
                    
                    <Badge className="mb-4 bg-green-600 hover:bg-green-700 text-white">
                      Até {loja.commission}% de comissão
                    </Badge>
                    
                    <Button className="w-full mt-auto bg-primary hover:bg-primary/90">
                      Ver Produtos
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
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
