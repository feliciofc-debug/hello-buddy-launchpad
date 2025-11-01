import { useState, useMemo, useEffect } from "react";
import { Dialog, DialogContent } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { X, Search, Sparkles, Loader2 } from "lucide-react";
import { Checkbox } from "@/components/ui/checkbox";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types/product';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface Store {
  name: string;
  logo: string;
  commission: string;
  sourceId?: string;
}

interface LomadeeStoreModalProps {
  store: Store | null;
  open: boolean;
  onClose: () => void;
}


export const LomadeeStoreModal = ({ store, open, onClose }: LomadeeStoreModalProps) => {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState("");
  const [selectedCategory, setSelectedCategory] = useState<string>("all");
  const [minPrice, setMinPrice] = useState("");
  const [maxPrice, setMaxPrice] = useState("");
  const [selectedProducts, setSelectedProducts] = useState<Set<string>>(new Set());
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [productSearchTerm, setProductSearchTerm] = useState("");
  
  // Buscar produtos via BuscaPé API
  const searchProducts = async () => {
    if (!productSearchTerm.trim()) {
      toast.error("Digite um termo de busca para encontrar produtos");
      return;
    }

    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) throw new Error('Usuário não autenticado');

      console.log('Buscando produtos:', productSearchTerm);

      const { data, error } = await supabase.functions.invoke('buscar-produtos-buscape', {
        body: { 
          keyword: productSearchTerm,
          storeName: store?.name 
        }
      });

      if (error) throw error;

      if (data?.products && data.products.length > 0) {
        setProducts(data.products);
        toast.success(`${data.products.length} produto(s) encontrado(s)!`);
      } else {
        setProducts([]);
        toast.warning('Nenhum produto encontrado para este termo');
      }
      
    } catch (err: any) {
      console.error('Erro ao buscar produtos:', err);
      toast.error(err.message || 'Erro ao buscar produtos');
      setProducts([]);
    } finally {
      setIsLoading(false);
    }
  };

  // IMPORTANTE: useMemo deve vir ANTES de qualquer early return para manter ordem dos hooks
  const categories = useMemo(() => {
    if (!products || products.length === 0) return ["all"];
    return ["all", ...Array.from(new Set(products.map(p => p.category)))];
  }, [products]);

  // Filtrar produtos
  const filteredProducts = useMemo(() => {
    if (!products || products.length === 0) return [];
    return products.filter((product) => {
      const matchesSearch = product.title.toLowerCase().includes(searchTerm.toLowerCase());
      const matchesCategory = selectedCategory === "all" || product.category === selectedCategory;
      const matchesMinPrice = !minPrice || product.price >= parseFloat(minPrice);
      const matchesMaxPrice = !maxPrice || product.price <= parseFloat(maxPrice);
      
      return matchesSearch && matchesCategory && matchesMinPrice && matchesMaxPrice;
    });
  }, [searchTerm, selectedCategory, minPrice, maxPrice, products]);

  if (!store) return null;

  const toggleProductSelection = (productId: string) => {
    const newSelection = new Set(selectedProducts);
    if (newSelection.has(productId)) {
      newSelection.delete(productId);
    } else {
      newSelection.add(productId);
    }
    setSelectedProducts(newSelection);
  };

  const handleCreateCampaign = () => {
    if (selectedProducts.size === 0) {
      toast.error("Selecione pelo menos um produto!");
      return;
    }

    const selectedProductsData = products.filter(p => selectedProducts.has(p.id));
    const productUrls = selectedProductsData.map(p => p.affiliateLink).join(',');
    
    // Redirecionar para IA Marketing com produtos selecionados
    navigate(`/ia-marketing?produtos=${encodeURIComponent(productUrls)}`);
    onClose();
  };

  const clearSelection = () => {
    setSelectedProducts(new Set());
    toast.info("Seleção limpa!");
  };

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[95vw] max-h-[95vh] h-[95vh] p-0 overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b bg-card">
          <div className="flex items-center gap-4">
            <Button
              variant="outline"
              size="sm"
              onClick={onClose}
              className="mr-2"
            >
              ← Voltar para Lojas
            </Button>
            <img 
              src={store.logo} 
              alt={store.name} 
              className="w-16 h-16 object-contain rounded-lg bg-white p-2"
            />
            <div>
              <h2 className="text-2xl font-bold">{store.name}</h2>
              <Badge className="mt-1 bg-green-600 hover:bg-green-700">
                Comissão {store.commission}
              </Badge>
            </div>
          </div>
          <Button 
            variant="ghost" 
            size="icon"
            onClick={onClose}
            className="rounded-full"
          >
            <X className="h-6 w-6" />
          </Button>
        </div>

        {/* Busca de Produtos */}
        <div className="p-6 border-b bg-gradient-to-r from-purple-50 to-indigo-50 dark:from-purple-950/20 dark:to-indigo-950/20">
          <div className="max-w-4xl mx-auto">
            <h3 className="text-lg font-semibold mb-3">🔍 Buscar Produtos na Loja</h3>
            <div className="flex gap-3">
              <div className="flex-1 relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-5 w-5 text-muted-foreground" />
                <Input
                  placeholder="Ex: smartphone, notebook, geladeira..."
                  value={productSearchTerm}
                  onChange={(e) => setProductSearchTerm(e.target.value)}
                  onKeyPress={(e) => e.key === 'Enter' && searchProducts()}
                  className="pl-10 h-12 text-base"
                />
              </div>
              <Button 
                onClick={searchProducts}
                disabled={isLoading || !productSearchTerm.trim()}
                className="h-12 px-8 bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
              >
                {isLoading ? (
                  <Loader2 className="w-5 h-5 animate-spin" />
                ) : (
                  <>
                    <Search className="w-5 h-5 mr-2" />
                    Buscar
                  </>
                )}
              </Button>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              💡 Digite o que procura e clique em Buscar para encontrar produtos da {store?.name}
            </p>
          </div>
        </div>

        {/* Filtros */}
        <div className="p-6 border-b bg-muted/30 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div className="md:col-span-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
                <Input
                  placeholder="Filtrar produtos exibidos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-10"
                />
              </div>
            </div>
            
            <Select value={selectedCategory} onValueChange={setSelectedCategory}>
              <SelectTrigger>
                <SelectValue placeholder="Categoria" />
              </SelectTrigger>
              <SelectContent>
                {categories.map((cat) => (
                  <SelectItem key={cat} value={cat}>
                    {cat === "all" ? "Todas as categorias" : cat}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <div className="flex gap-2">
              <Input
                type="number"
                placeholder="Min R$"
                value={minPrice}
                onChange={(e) => setMinPrice(e.target.value)}
                className="w-full"
              />
              <Input
                type="number"
                placeholder="Max R$"
                value={maxPrice}
                onChange={(e) => setMaxPrice(e.target.value)}
                className="w-full"
              />
            </div>
          </div>
        </div>

        {/* Grid de Produtos */}
        <div className="flex-1 overflow-y-auto p-6">
          {isLoading ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Loader2 className="w-12 h-12 animate-spin text-primary mb-4" />
              <p className="text-muted-foreground">Buscando produtos...</p>
            </div>
          ) : products.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-20">
              <Search className="w-16 h-16 text-muted-foreground mb-4" />
              <h3 className="text-xl font-semibold mb-2">Nenhum produto carregado</h3>
              <p className="text-muted-foreground text-center max-w-md">
                Use o campo de busca acima para encontrar produtos da {store?.name}. 
                Digite o que procura e clique em "Buscar".
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                {filteredProducts.map((product) => {
                  const isSelected = selectedProducts.has(product.id);
                  
                  return (
                    <Card
                      key={product.id}
                      className={`relative overflow-hidden transition-all duration-200 hover:shadow-lg cursor-pointer group ${
                        isSelected ? 'ring-2 ring-primary shadow-lg' : ''
                      }`}
                      onClick={() => toggleProductSelection(product.id)}
                    >
                      {/* Checkbox */}
                      <div className="absolute top-2 left-2 z-10">
                        <div className={`w-6 h-6 rounded flex items-center justify-center ${
                          isSelected ? 'bg-primary' : 'bg-white border-2 border-gray-300'
                        }`}>
                          {isSelected && <Checkbox checked className="pointer-events-none" />}
                        </div>
                      </div>

                      {/* Badge de comissão */}
                      <div className="absolute top-2 right-2 z-10">
                        <Badge className="bg-green-600 hover:bg-green-700">
                          {product.commissionPercent?.toFixed(1) || 0}%
                        </Badge>
                      </div>

                      {/* Imagem */}
                      <div className="aspect-square overflow-hidden bg-gray-100">
                        <img
                          src={product.imageUrl}
                          alt={product.title}
                          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-300"
                          onError={(e) => {
                            e.currentTarget.src = 'https://via.placeholder.com/300?text=Produto';
                          }}
                        />
                      </div>

                      {/* Informações */}
                      <div className="p-3 space-y-2">
                        <h3 className="font-semibold text-sm line-clamp-2 min-h-[2.5rem]">
                          {product.title}
                        </h3>
                        
                        <div className="space-y-1">
                          <p className="text-lg font-bold text-primary">
                            R$ {product.price.toFixed(2)}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Comissão: <span className="font-semibold text-green-600">
                              R$ {product.commission.toFixed(2)}
                            </span>
                          </p>
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>

              {filteredProducts.length === 0 && !isLoading && (
                <div className="text-center py-12">
                  <p className="text-muted-foreground text-lg">
                    Nenhum produto encontrado com os filtros aplicados
                  </p>
                </div>
              )}
            </>
          )}
        </div>

        {/* Rodapé Fixo */}
        {selectedProducts.size > 0 && (
          <div className="border-t bg-card p-4 shadow-lg">
            <div className="flex items-center justify-between max-w-7xl mx-auto">
              <div className="flex items-center gap-2">
                <span className="font-semibold text-lg">
                  ✓ {selectedProducts.size} {selectedProducts.size === 1 ? 'produto selecionado' : 'produtos selecionados'}
                </span>
              </div>
              
              <div className="flex gap-3">
                <Button
                  variant="outline"
                  onClick={clearSelection}
                >
                  Limpar Seleção
                </Button>
                <Button
                  onClick={handleCreateCampaign}
                  className="bg-gradient-to-r from-purple-600 to-indigo-600 hover:from-purple-700 hover:to-indigo-700"
                >
                  <Sparkles className="mr-2 h-4 w-4" />
                  🚀 Criar Campanha com IA
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
};
