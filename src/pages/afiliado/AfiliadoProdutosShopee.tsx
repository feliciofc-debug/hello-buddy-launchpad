import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { ArrowLeft, ExternalLink, Megaphone, Package, Store, Trash2 } from "lucide-react";
import { CriarCampanhaAfiliadoModal } from "@/components/CriarCampanhaAfiliadoModal";
import { TikTokShareModal } from "@/components/TikTokShareModal";

interface Produto {
  id: string;
  titulo: string;
  imagem_url: string | null;
  preco: number | null;
  link_afiliado: string;
  categoria: string | null;
  status: string | null;
  descricao?: string | null;
  marketplace?: string;
}

export default function AfiliadoProdutosShopee() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [campanhaModalOpen, setCampanhaModalOpen] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [tiktokModalOpen, setTiktokModalOpen] = useState(false);
  const [tiktokContent, setTiktokContent] = useState<{ type: "image" | "video"; url: string; title?: string } | null>(null);

  const normalizeShopeePrice = (preco: number | null): number | null => {
    if (preco == null) return null;

    // Heurística para preços vindos como "2.399" (milhar com ponto) que acabam salvos como 2.399
    // Se for um número pequeno (< 20) com 3 casas decimais exatas, trata como milhar.
    const eps = 1e-9;
    const has3Decimals = Math.abs(preco * 1000 - Math.round(preco * 1000)) < eps;
    const has2Decimals = Math.abs(preco * 100 - Math.round(preco * 100)) < eps;

    if (preco > 0 && preco < 20 && has3Decimals && !has2Decimals) {
      return Math.round(preco * 1000);
    }

    return preco;
  };

  useEffect(() => {
    loadProdutos();
  }, []);

  const loadProdutos = async () => {
    try {
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from("afiliado_produtos")
        .select("*")
        .eq("user_id", user.id)
        .ilike("marketplace", "%shopee%")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProdutos(data || []);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const handleCriarCampanha = (produto: Produto) => {
    setProdutoSelecionado(produto);
    setCampanhaModalOpen(true);
  };

  const handleShareTikTok = (produto: Produto) => {
    if (produto.imagem_url) {
      setTiktokContent({
        type: "image",
        url: produto.imagem_url,
        title: produto.titulo
      });
      setTiktokModalOpen(true);
    } else {
      toast.error("Este produto não possui imagem para compartilhar");
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;

    try {
      const { error } = await supabase.from("afiliado_produtos").delete().eq("id", id);

      if (error) throw error;

      setProdutos((prev) => prev.filter((p) => p.id !== id));
      toast.success("Produto excluído");
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir produto");
    }
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Button variant="ghost" size="icon" onClick={() => navigate("/afiliado/produtos")}
          >
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <Store className="h-6 w-6 text-orange-500" />
              Produtos Shopee
            </h1>
            <p className="text-muted-foreground text-sm">Gerencie seus produtos de afiliado Shopee</p>
          </div>
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : produtos.length === 0 ? (
        <Card className="max-w-lg mx-auto mt-12">
          <CardHeader className="text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <CardTitle>Nenhum produto Shopee</CardTitle>
            <CardDescription>Use a extensão Chrome para importar produtos da Shopee</CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              A extensão já captura o link de afiliado completo da Shopee.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {produtos.map((produto) => (
            <Card key={produto.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-square relative bg-muted">
                <img
                  src={produto.imagem_url || "/placeholder.svg"}
                  alt={produto.titulo}
                  className="w-full h-full object-contain p-2"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
                {produto.categoria && (
                  <Badge className="absolute top-2 left-2 text-xs">{produto.categoria}</Badge>
                )}
              </div>
              <CardContent className="p-3">
                <h3 className="font-medium text-sm line-clamp-2 mb-2">{produto.titulo}</h3>
                {produto.preco != null && (
                  <p className="text-lg font-bold text-green-600">
                    {normalizeShopeePrice(produto.preco)?.toLocaleString('pt-BR', {
                      style: 'currency',
                      currency: 'BRL',
                    })}
                  </p>
                )}

                <Button
                  className="w-full mt-3"
                  size="sm"
                  onClick={() => handleCriarCampanha({ ...produto, marketplace: "shopee" })}
                >
                  <Megaphone className="h-4 w-4 mr-1" />
                  Criar Campanha
                </Button>

                <div className="flex items-center gap-1 mt-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(produto.link_afiliado, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Ver
                  </Button>
                  <Button
                    variant="outline"
                    size="icon"
                    className="h-8 w-8"
                    onClick={() => handleShareTikTok(produto)}
                    title="Compartilhar no TikTok"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                    </svg>
                  </Button>
                  <Button
                    variant="ghost"
                    size="icon"
                    className="text-destructive hover:text-destructive"
                    onClick={() => handleDelete(produto.id)}
                  >
                    <Trash2 className="h-4 w-4" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      {/* Modal Criar Campanha */}
      {produtoSelecionado && (
        <CriarCampanhaAfiliadoModal
          open={campanhaModalOpen}
          onOpenChange={(open) => {
            setCampanhaModalOpen(open);
            if (!open) setProdutoSelecionado(null);
          }}
          produto={produtoSelecionado as any}
        />
      )}

      {/* Modal TikTok */}
      {tiktokContent && (
        <TikTokShareModal
          open={tiktokModalOpen}
          onOpenChange={setTiktokModalOpen}
          content={tiktokContent}
        />
      )}
    </div>
  );
}
