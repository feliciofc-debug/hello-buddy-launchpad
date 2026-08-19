import { useEffect, useState } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Linkedin, Loader2, Package, Search } from 'lucide-react';
import { PostarLinkedInModal } from '@/components/PostarLinkedInModal';

interface ProdutoLI {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  imagem_url: string | null;
  link: string | null;
  link_marketplace: string | null;
  categoria: string | null;
  imagens?: any;
}

export default function LinkedInProdutosGrid() {
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<ProdutoLI[]>([]);
  const [busca, setBusca] = useState('');
  const [selecionado, setSelecionado] = useState<ProdutoLI | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  useEffect(() => {
    void carregar();
  }, []);

  const carregar = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      const { data } = await supabase
        .from('produtos')
        .select('id, nome, descricao, preco, imagem_url, link, link_marketplace, categoria, imagens')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });
      setProdutos((data as ProdutoLI[]) || []);
    } catch (err) {
      console.error('LinkedInProdutosGrid carregar:', err);
    } finally {
      setLoading(false);
    }
  };

  const filtrados = produtos.filter(
    (p) => !busca || p.nome?.toLowerCase().includes(busca.toLowerCase()),
  );

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="relative">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Buscar produto..."
          value={busca}
          onChange={(e) => setBusca(e.target.value)}
          className="pl-10"
        />
      </div>

      {filtrados.length === 0 ? (
        <div className="text-center py-12 text-muted-foreground">
          <Package className="h-10 w-10 mx-auto mb-3 opacity-50" />
          <p className="text-sm">Nenhum produto encontrado</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtrados.map((produto) => (
            <Card key={produto.id} className="overflow-hidden">
              <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                {produto.imagem_url ? (
                  <img
                    src={produto.imagem_url}
                    alt={produto.nome}
                    loading="lazy"
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <Package className="h-10 w-10 text-muted-foreground/30" />
                )}
              </div>
              <CardContent className="p-4 space-y-3">
                <div>
                  <p className="font-medium text-sm line-clamp-2">{produto.nome}</p>
                  {produto.categoria && (
                    <Badge variant="outline" className="text-xs mt-1 capitalize">
                      {produto.categoria}
                    </Badge>
                  )}
                </div>
                <Button
                  variant="outline"
                  className="w-full gap-2"
                  onClick={() => {
                    setSelecionado(produto);
                    setModalOpen(true);
                  }}
                >
                  <Linkedin className="h-4 w-4" />
                  Post on LinkedIn
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {selecionado && (
        <PostarLinkedInModal
          open={modalOpen}
          onOpenChange={(o) => {
            setModalOpen(o);
            if (!o) setSelecionado(null);
          }}
          produto={selecionado as any}
        />
      )}
    </div>
  );
}
