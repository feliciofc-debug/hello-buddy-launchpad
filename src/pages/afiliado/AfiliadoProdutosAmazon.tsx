import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { 
  ArrowLeft, 
  Settings, 
  Package, 
  ExternalLink, 
  Trash2, 
  Edit, 
  Plus,
  Check,
  AlertCircle,
  ShoppingCart,
  Shield,
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

export default function AfiliadoProdutosAmazon() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [amazonTag, setAmazonTag] = useState<string | null>(null);
  const [showConfigModal, setShowConfigModal] = useState(false);
  const [tempTag, setTempTag] = useState("");
  const [saving, setSaving] = useState(false);
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

      const caption = `🔥 ${produto.titulo}\n\n💰 Oferta imperdível na Amazon!\n\n👆 Link na bio!\n\n#amazon #ofertas #promocao #fyp #viral #desconto`;

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
    checkAmazonConfig();
  }, []);

  const checkAmazonConfig = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate("/login");
        return;
      }

      // Buscar configuração do afiliado
      const { data: afiliado } = await supabase
        .from("clientes_afiliados")
        .select("amazon_affiliate_tag")
        .eq("user_id", user.id)
        .single();

      if (afiliado?.amazon_affiliate_tag) {
        setAmazonTag(afiliado.amazon_affiliate_tag);
        loadProdutos(user.id);
      } else {
        setShowConfigModal(true);
        setLoading(false);
      }
    } catch (error) {
      console.error("Erro ao verificar config:", error);
      setLoading(false);
    }
  };

  const loadProdutos = async (userId: string) => {
    try {
      const { data, error } = await supabase
        .from("afiliado_produtos")
        .select("*")
        .eq("user_id", userId)
        .ilike("marketplace", "%amazon%")
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

  const saveAmazonTag = async () => {
    if (!tempTag.trim()) {
      toast.error("Informe seu Amazon Tag");
      return;
    }

    // Validar formato do tag
    if (!/^[a-zA-Z0-9-]+$/.test(tempTag.trim())) {
      toast.error("Tag inválido. Use apenas letras, números e hífen.");
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("clientes_afiliados")
        .update({ amazon_affiliate_tag: tempTag.trim() })
        .eq("user_id", user.id);

      if (error) throw error;

      setAmazonTag(tempTag.trim());
      setShowConfigModal(false);
      toast.success("Amazon Tag configurado com sucesso!");
      
      // Carregar produtos após configurar
      loadProdutos(user.id);
    } catch (error) {
      console.error("Erro ao salvar tag:", error);
      toast.error("Erro ao salvar configuração");
    } finally {
      setSaving(false);
    }
  };

  const convertExistingLinks = async () => {
    if (!amazonTag) return;

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar produtos Amazon sem o tag correto
      const { data: produtosParaConverter } = await supabase
        .from("afiliado_produtos")
        .select("id, link_afiliado")
        .eq("user_id", user.id)
        .ilike("marketplace", "%amazon%");

      if (!produtosParaConverter?.length) {
        toast.info("Nenhum produto para converter");
        return;
      }

      let convertidos = 0;
      for (const produto of produtosParaConverter) {
        // Extrair ASIN do link
        const asinMatch = produto.link_afiliado.match(/\/dp\/([A-Z0-9]{10})/i) ||
                         produto.link_afiliado.match(/\/gp\/product\/([A-Z0-9]{10})/i);
        
        if (asinMatch) {
          const asin = asinMatch[1];
          const novoLink = `https://www.amazon.com.br/dp/${asin}?tag=${amazonTag}`;
          
          if (produto.link_afiliado !== novoLink) {
            await supabase
              .from("afiliado_produtos")
              .update({ link_afiliado: novoLink })
              .eq("id", produto.id);
            convertidos++;
          }
        }
      }

      if (convertidos > 0) {
        toast.success(`${convertidos} links convertidos para seu tag!`);
        loadProdutos(user.id);
      } else {
        toast.info("Todos os links já estão com seu tag");
      }
    } catch (error) {
      console.error("Erro ao converter links:", error);
      toast.error("Erro ao converter links");
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

  const getImageUrl = (produto: Produto): string => {
    if (produto.imagem_url) return produto.imagem_url;
    
    // Tentar extrair ASIN e construir URL de imagem
    const asinMatch = produto.link_afiliado.match(/\/dp\/([A-Z0-9]{10})/i);
    if (asinMatch) {
      return `https://images-na.ssl-images-amazon.com/images/I/${asinMatch[1]}._AC_SL400_.jpg`;
    }
    
    return "/placeholder.svg";
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
              <ShoppingCart className="h-6 w-6 text-orange-500" />
              Produtos Amazon
            </h1>
            <p className="text-muted-foreground text-sm">
              Gerencie seus produtos de afiliado Amazon
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2">
          {amazonTag && (
            <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50">
              Tag: {amazonTag}
            </Badge>
          )}
          <Button variant="outline" size="sm" onClick={() => {
            setTempTag(amazonTag || "");
            setShowConfigModal(true);
          }}>
            <Settings className="h-4 w-4 mr-1" />
            Configurar Tag
          </Button>
          {amazonTag && produtos.length > 0 && (
            <Button variant="secondary" size="sm" onClick={convertExistingLinks}>
              <Check className="h-4 w-4 mr-1" />
              Converter Links
            </Button>
          )}
        </div>
      </div>

      {/* Conteúdo */}
      {loading ? (
        <div className="flex items-center justify-center h-64">
          <div className="animate-spin h-8 w-8 border-4 border-primary border-t-transparent rounded-full" />
        </div>
      ) : !amazonTag ? (
        <Card className="max-w-lg mx-auto mt-12">
          <CardHeader className="text-center">
            <AlertCircle className="h-12 w-12 text-orange-500 mx-auto mb-2" />
            <CardTitle>Configure seu Amazon Tag</CardTitle>
            <CardDescription>
              Para começar a usar produtos Amazon, configure seu ID de afiliado
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <Button onClick={() => setShowConfigModal(true)}>
              Configurar Agora
            </Button>
          </CardContent>
        </Card>
      ) : produtos.length === 0 ? (
        <Card className="max-w-lg mx-auto mt-12">
          <CardHeader className="text-center">
            <Package className="h-12 w-12 text-muted-foreground mx-auto mb-2" />
            <CardTitle>Nenhum produto Amazon</CardTitle>
            <CardDescription>
              Use a extensão Chrome para importar produtos da Amazon
            </CardDescription>
          </CardHeader>
          <CardContent className="text-center">
            <p className="text-sm text-muted-foreground mb-4">
              Seu tag <strong>{amazonTag}</strong> será aplicado automaticamente em todos os produtos importados.
            </p>
          </CardContent>
        </Card>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {produtos.map((produto) => (
            <Card key={produto.id} className="overflow-hidden hover:shadow-lg transition-shadow">
              <div className="aspect-square relative bg-gray-100">
                <img
                  src={getImageUrl(produto)}
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
                <p className="text-xs text-muted-foreground mb-2">Amazon</p>
                <div className="flex items-center justify-between mb-3">
                  <span className="text-xs text-muted-foreground">Preço:</span>
                  <span className="text-lg font-bold text-green-600">
                    R$ {produto.preco?.toFixed(2) || '0.00'}
                  </span>
                </div>
                <Button
                  className="w-full mb-2 bg-orange-500 hover:bg-orange-600"
                  size="sm"
                  onClick={() => handleCriarCampanha({...produto, marketplace: 'amazon'})}
                >
                  <ShoppingCart className="h-4 w-4 mr-1" />
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
                    <Edit className="h-3 w-3 mr-1" />
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

      {/* Modal de Configuração */}
      <Dialog open={showConfigModal} onOpenChange={setShowConfigModal}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              <ShoppingCart className="h-5 w-5 text-orange-500" />
              Configurar Amazon Tag
            </DialogTitle>
            <DialogDescription>
              Informe seu ID de afiliado Amazon. Todos os links de produtos serão convertidos automaticamente.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-4">
            <div>
              <Label htmlFor="amazonTag">Amazon Associate Tag</Label>
              <Input
                id="amazonTag"
                placeholder="ex: amzofertas03-20"
                value={tempTag}
                onChange={(e) => setTempTag(e.target.value)}
                className="mt-1"
              />
              <p className="text-xs text-muted-foreground mt-1">
                Encontre seu tag em{" "}
                <a 
                  href="https://affiliate-program.amazon.com.br/" 
                  target="_blank" 
                  rel="noopener noreferrer"
                  className="text-primary underline"
                >
                  affiliate-program.amazon.com.br
                </a>
              </p>
            </div>

            <div className="bg-muted/50 p-3 rounded-lg text-sm">
              <p className="font-medium mb-1">Como funciona:</p>
              <ul className="list-disc list-inside text-muted-foreground space-y-1">
                <li>Seu tag é adicionado automaticamente aos links</li>
                <li>Links existentes podem ser convertidos</li>
                <li>Formato final: amazon.com.br/dp/ASIN?tag=SEU-TAG</li>
              </ul>
            </div>
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setShowConfigModal(false)} disabled={saving}>
              Cancelar
            </Button>
            <Button onClick={saveAmazonTag} disabled={saving}>
              {saving ? "Salvando..." : "Salvar Tag"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
