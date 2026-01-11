import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Package, 
  ExternalLink, 
  Trash2,
  ShoppingBag,
  Rocket,
  Loader2
} from "lucide-react";
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

export default function AfiliadoProdutosMagalu() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [campanhaModalOpen, setCampanhaModalOpen] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [tiktokModalOpen, setTiktokModalOpen] = useState(false);
  const [tiktokContent, setTiktokContent] = useState<{ type: "image" | "video"; url: string; title?: string } | null>(null);
  const [postingTikTok, setPostingTikTok] = useState<string | null>(null);

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

  const handlePostTikTokDirect = async (produto: Produto) => {
    if (!produto.imagem_url) {
      toast.error("Este produto não possui imagem para compartilhar");
      return;
    }

    setPostingTikTok(produto.id);
    
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error("Você precisa estar logado");
        return;
      }

      const { data: integration } = await supabase
        .from("integrations")
        .select("id, is_active")
        .eq("user_id", user.id)
        .eq("platform", "tiktok")
        .eq("is_active", true)
        .maybeSingle();

      if (!integration) {
        toast.error("Conecte sua conta TikTok primeiro nas configurações");
        navigate("/afiliado/tiktok");
        return;
      }

      const caption = `🔥 ${produto.titulo}\n\n💰 Oferta imperdível na Magalu!\n\n👆 Link na bio!\n\n#magalu #ofertas #promocao #fyp #viral #desconto`;

      const { data, error } = await supabase.functions.invoke("tiktok-post-content", {
        body: {
          user_id: user.id,
          content_type: "image",
          content_url: produto.imagem_url,
          title: caption,
          post_mode: "direct"
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("✅ Produto publicado no TikTok com sucesso!");
      } else {
        throw new Error(data.error || "Erro ao postar no TikTok");
      }
    } catch (error: any) {
      console.error("Erro ao postar:", error);
      toast.error(error.message || "Erro ao publicar no TikTok");
    } finally {
      setPostingTikTok(null);
    }
  };
  useEffect(() => {
    loadProdutos();
  }, []);

  const loadProdutos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      const { data, error } = await supabase
        .from("afiliado_produtos")
        .select("*")
        .eq("user_id", user.id)
        .or("marketplace.ilike.%magalu%,marketplace.ilike.%magazine%")
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

  const handleDelete = async (id: string) => {
    if (!confirm("Excluir este produto?")) return;

    try {
      const { error } = await supabase
        .from("afiliado_produtos")
        .delete()
        .eq("id", id);

      if (error) throw error;
      
      setProdutos(prev => prev.filter(p => p.id !== id));
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
          <Button variant="ghost" size="icon" onClick={() => navigate("/afiliado/produtos")}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <div>
            <h1 className="text-2xl font-bold flex items-center gap-2">
              <ShoppingBag className="h-6 w-6 text-blue-500" />
              Produtos Magazine Luiza
            </h1>
            <p className="text-muted-foreground text-sm">
              Gerencie seus produtos de afiliado Magalu
            </p>
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
            <CardTitle>Nenhum produto Magalu</CardTitle>
            <CardDescription>
              Use a extensão Chrome para importar produtos da Magazine Luiza
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              A extensão já captura o link de afiliado completo da Magalu.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {produtos.map((produto) => (
            <Card key={produto.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-square relative bg-gray-100">
                <img
                  src={produto.imagem_url || "/placeholder.svg"}
                  alt={produto.titulo}
                  className="w-full h-full object-contain p-2"
                  onError={(e) => {
                    (e.target as HTMLImageElement).src = "/placeholder.svg";
                  }}
                />
                {produto.categoria && (
                  <Badge className="absolute top-2 left-2 text-xs">
                    {produto.categoria}
                  </Badge>
                )}
                <Badge 
                  className={`absolute top-2 right-2 text-xs ${
                    produto.status === 'ativo' 
                      ? 'bg-green-500 hover:bg-green-600' 
                      : 'bg-gray-500 hover:bg-gray-600'
                  }`}
                >
                  {produto.status === 'ativo' ? 'Ativo' : 'Inativo'}
                </Badge>
              </div>
              <CardContent className="p-3">
                <h3 className="font-medium text-sm line-clamp-2 mb-1">
                  {produto.titulo}
                </h3>
                <p className="text-xs text-muted-foreground mb-2">Magazine Luiza</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">Preço:</span>
                  <span className="text-lg font-bold text-green-600">
                    R$ {produto.preco?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <Button
                  className="w-full mb-2 bg-blue-500 hover:bg-blue-600"
                  size="sm"
                  onClick={() => handleCriarCampanha({...produto, marketplace: 'magalu'})}
                >
                  <ShoppingBag className="h-4 w-4 mr-1" />
                  Criar Campanha
                </Button>
                <Button
                  className="w-full mb-2 bg-gradient-to-r from-pink-500 to-cyan-500 hover:from-pink-600 hover:to-cyan-600"
                  size="sm"
                  onClick={() => handlePostTikTokDirect(produto)}
                  disabled={postingTikTok === produto.id}
                >
                  {postingTikTok === produto.id ? (
                    <>
                      <Loader2 className="h-4 w-4 mr-1 animate-spin" />
                      Postando...
                    </>
                  ) : (
                    <>
                      <Rocket className="h-4 w-4 mr-1" />
                      Postar no TikTok
                    </>
                  )}
                </Button>
                <div className="flex items-center gap-2">
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
                    title="Abrir modal TikTok"
                  >
                    <svg viewBox="0 0 24 24" className="h-4 w-4" fill="currentColor">
                      <path d="M19.59 6.69a4.83 4.83 0 01-3.77-4.25V2h-3.45v13.67a2.89 2.89 0 01-5.2 1.74 2.89 2.89 0 012.31-4.64 2.93 2.93 0 01.88.13V9.4a6.84 6.84 0 00-1-.05A6.33 6.33 0 005 20.1a6.34 6.34 0 0010.86-4.43v-7a8.16 8.16 0 004.77 1.52v-3.4a4.85 4.85 0 01-1-.1z"/>
                    </svg>
                  </Button>
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1 text-destructive border-destructive hover:bg-destructive/10"
                    onClick={() => handleDelete(produto.id)}
                  >
                    <Trash2 className="h-3 w-3 mr-1" />
                    Excluir
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
