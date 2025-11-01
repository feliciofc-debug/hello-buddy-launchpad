import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { ArrowLeft, ShoppingBag, Loader2 } from 'lucide-react';
import { ThemeToggle } from '@/components/ThemeToggle';
import { LomadeeStoreModal } from '@/components/LomadeeStoreModal';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

const ProductsPage: React.FC = () => {
  const navigate = useNavigate();
  const [selectedStore, setSelectedStore] = useState<{ name: string; logo: string; commission: string } | null>(null);
  const [isStoreModalOpen, setIsStoreModalOpen] = useState(false);
  const [lojas, setLojas] = useState<any[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    loadApprovedStores();
  }, []);

  const loadApprovedStores = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      // Buscar APP_TOKEN do banco
      const { data: integration, error: integrationError } = await supabase
        .from('integrations')
        .select('lomadee_app_token, lomadee_source_id')
        .eq('user_id', user.id)
        .eq('platform', 'lomadee')
        .eq('is_active', true)
        .maybeSingle();

      if (integrationError) throw integrationError;

      if (!integration?.lomadee_app_token) {
        toast.error('Configure sua integração Lomadee em Configurações');
        setLojas([]);
        return;
      }

      // Chamar edge function para buscar lojas
      const { data, error } = await supabase.functions.invoke('listar-lojas-lomadee', {
        body: { appToken: integration.lomadee_app_token }
      });

      if (error) throw error;

      if (data.stores && data.stores.length > 0) {
        setLojas(data.stores.map((store: any) => ({
          name: store.name,
          logo: store.thumbnail || `https://via.placeholder.com/200x80?text=${store.name}`,
          sourceId: store.sourceId,
          commission: 10, // Comissão padrão, pode ser ajustada depois
          produtos: 0 // Será atualizado quando buscar produtos
        })));
      } else {
        toast.warning('Nenhuma loja aprovada encontrada');
      }

    } catch (error: any) {
      console.error('Erro ao carregar lojas:', error);
      toast.error('Erro ao carregar lojas aprovadas');
    } finally {
      setIsLoading(false);
    }
  };

  const handleOpenStore = (loja: any) => {
    setSelectedStore({
      name: loja.name,
      logo: loja.logo,
      commission: `até ${loja.commission}%`,
      sourceId: loja.sourceId
    } as any);
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
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-12 h-12 animate-spin text-primary" />
          </div>
        ) : lojas.length === 0 ? (
          <div className="text-center py-20">
            <p className="text-muted-foreground text-lg mb-4">
              Nenhuma loja aprovada encontrada
            </p>
            <Button onClick={() => navigate('/configuracoes')}>
              Configurar Lomadee
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {lojas.map((loja) => (
              <Card 
                key={loja.sourceId}
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
