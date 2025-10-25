import { useState } from 'react';
import ProductCard from '@/components/ProductCard';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { Search, Loader2, ServerCrash } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import type { Product } from '@/types/product';

export default function LomadeeFinder() {
  const [keyword, setKeyword] = useState<string>('');
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [error, setError] = useState<string | null>(null);

  const handleSearch = async () => {
    if (!keyword.trim()) {
      setError('Por favor, digite um termo para buscar.');
      return;
    }

    setIsLoading(true);
    setError(null);
    setProducts([]);

    try {
      const { data, error: funcError } = await supabase.functions.invoke('buscar-produtos-lomadee', {
        body: {
          searchTerm: keyword,
          limit: 50,
          offset: 0
        }
      });

      if (funcError) throw funcError;

      // Transformar dados da Lomadee para o formato Product
      const transformedProducts: Product[] = (data.produtos || []).map((produto: any) => ({
        id: produto.id,
        title: produto.nome,
        description: produto.nome,
        price: produto.preco,
        originalPrice: undefined,
        commission: produto.comissao,
        commissionPercent: produto.comissaoPercentual,
        marketplace: 'lomadee' as const,
        category: produto.categoria as any,
        imageUrl: produto.imagem,
        affiliateLink: produto.url,
        rating: produto.rating || 0,
        reviews: produto.reviews || 0,
        sales: produto.demandaMensal || 0,
        createdAt: new Date(produto.dataCadastro),
        asin: produto.asin,
      }));

      setProducts(transformedProducts);

    } catch (err: any) {
      console.error('Erro ao buscar produtos Lomadee:', err);
      setError(err.message || 'Ocorreu um erro ao buscar os produtos.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-8 space-y-6">
      <div className="flex flex-col gap-2">
        <h1 className="text-2xl font-bold tracking-tight">Buscador de Ofertas Lomadee</h1>
        <p className="text-muted-foreground">
          Encontre produtos de diversas lojas da rede Lomadee para promover.
        </p>
      </div>

      {/* Barra de Busca */}
      <div className="flex w-full max-w-2xl items-center space-x-2">
        <Input
          type="text"
          placeholder="Ex: Smartwatch, Fone de ouvido, Cadeira gamer..."
          value={keyword}
          onChange={(e) => setKeyword(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
          disabled={isLoading}
        />
        <Button onClick={handleSearch} disabled={isLoading}>
          {isLoading ? (
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Search className="mr-2 h-4 w-4" />
          )}
          Buscar
        </Button>
      </div>

      {/* Área de Resultados */}
      <div className="mt-6">
        {isLoading && (
          <div className="flex flex-col items-center justify-center text-center p-10">
            <Loader2 className="h-8 w-8 animate-spin text-primary" />
            <p className="mt-4 text-muted-foreground">Buscando as melhores ofertas...</p>
          </div>
        )}

        {error && (
          <div className="flex flex-col items-center justify-center text-center p-10 bg-destructive/10 rounded-lg">
            <ServerCrash className="h-8 w-8 text-destructive" />
            <p className="mt-4 font-semibold text-destructive">Oops! Algo deu errado.</p>
            <p className="text-sm text-muted-foreground">{error}</p>
          </div>
        )}

        {!isLoading && !error && products.length === 0 && keyword && (
          <div className="text-center text-muted-foreground p-10">
            <p>Nenhum produto encontrado. Tente um termo de busca diferente.</p>
          </div>
        )}

        {!isLoading && products.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
            {products.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
