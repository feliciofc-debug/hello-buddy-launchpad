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
  Construction
} from "lucide-react";

interface Produto {
  id: string;
  titulo: string;
  imagem_url: string | null;
  preco: number | null;
  link_afiliado: string;
  categoria: string | null;
  status: string | null;
}

export default function AfiliadoProdutosMagalu() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);

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

        <Badge variant="outline" className="text-blue-600 border-blue-300 bg-blue-50">
          <Construction className="h-3 w-3 mr-1" />
          Em desenvolvimento
        </Badge>
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
                  onClick={() => toast.info("Criar campanha - Em desenvolvimento")}
                >
                  <ShoppingBag className="h-4 w-4 mr-1" />
                  Criar Campanha
                </Button>
                <div className="flex items-center gap-2">
                  <Button
                    variant="outline"
                    size="sm"
                    className="flex-1"
                    onClick={() => window.open(produto.link_afiliado, "_blank")}
                  >
                    <ExternalLink className="h-3 w-3 mr-1" />
                    Editar
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
    </div>
  );
}
