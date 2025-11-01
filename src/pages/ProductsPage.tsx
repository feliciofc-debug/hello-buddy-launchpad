import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LomadeeStoreModal } from '@/components/LomadeeStoreModal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedStore, setSelectedStore] = useState<{ name: string; logo: string; commission: string } | null>(null);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);

  // Lista de lojas fixas com logos
  const lojas = [
    { name: "Magazine Luiza", logo: "https://logodownload.org/wp-content/uploads/2014/05/magazine-luiza-logo.png", commission: 12, produtos: 2500 },
    { name: "Americanas", logo: "https://logodownload.org/wp-content/uploads/2014/09/americanas-logo.png", commission: 10, produtos: 1800 },
    { name: "Casas Bahia", logo: "https://logodownload.org/wp-content/uploads/2020/04/casas-bahia-logo.png", commission: 11, produtos: 3200 },
    { name: "Submarino", logo: "https://logodownload.org/wp-content/uploads/2014/09/submarino-logo.png", commission: 9, produtos: 1500 },
    { name: "Extra", logo: "https://logodownload.org/wp-content/uploads/2019/01/extra-logo.png", commission: 10, produtos: 2100 },
    { name: "Ponto Frio", logo: "https://logodownload.org/wp-content/uploads/2014/09/ponto-frio-logo.png", commission: 9, produtos: 1900 },
    { name: "Shoptime", logo: "https://logodownload.org/wp-content/uploads/2019/11/shoptime-logo.png", commission: 11, produtos: 2300 },
    { name: "Netshoes", logo: "https://logodownload.org/wp-content/uploads/2019/11/netshoes-logo.png", commission: 8, produtos: 1600 },
    { name: "Centauro", logo: "https://logodownload.org/wp-content/uploads/2020/09/centauro-logo.png", commission: 9, produtos: 1400 },
    { name: "Dafiti", logo: "https://logodownload.org/wp-content/uploads/2020/04/dafiti-logo.png", commission: 10, produtos: 1700 },
    { name: "Zattini", logo: "https://logodownload.org/wp-content/uploads/2020/11/zattini-logo.png", commission: 9, produtos: 1500 },
    { name: "Tricae", logo: "https://logodownload.org/wp-content/uploads/2020/11/tricae-logo.png", commission: 11, produtos: 1200 },
    { name: "Kanui", logo: "https://logodownload.org/wp-content/uploads/2020/11/kanui-logo.png", commission: 10, produtos: 1300 },
    { name: "Beleza na Web", logo: "https://logodownload.org/wp-content/uploads/2020/11/beleza-na-web-logo.png", commission: 12, produtos: 1800 },
    { name: "Época Cosméticos", logo: "https://logodownload.org/wp-content/uploads/2019/11/epoca-cosmeticos-logo.png", commission: 10, produtos: 1600 },
    { name: "Polishop", logo: "https://logodownload.org/wp-content/uploads/2020/11/polishop-logo.png", commission: 11, produtos: 1400 },
    { name: "Fast Shop", logo: "https://logodownload.org/wp-content/uploads/2014/09/fast-shop-logo.png", commission: 9, produtos: 1900 },
    { name: "Kabum", logo: "https://logodownload.org/wp-content/uploads/2020/11/kabum-logo.png", commission: 8, produtos: 2200 },
    { name: "Pichau", logo: "https://logodownload.org/wp-content/uploads/2020/11/pichau-logo.png", commission: 9, produtos: 1500 },
    { name: "Terabyte Shop", logo: "https://logodownload.org/wp-content/uploads/2020/11/terabyteshop-logo.png", commission: 8, produtos: 1300 }
  ];

  const handleOpenStore = (loja: { name: string; logo: string; commission: number }) => {
    setSelectedStore({
      name: loja.name,
      logo: loja.logo,
      commission: `até ${loja.commission}%`
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
                  {loja.produtos.toLocaleString()} produtos disponíveis
                </p>
                
                <Badge className="mb-4 bg-green-600 hover:bg-green-700 text-white">
                  Até {loja.commission}% de comissão
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
