import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { AfiliadoLayout } from "@/components/afiliado/AfiliadoLayout";
import { CriarCampanhaAfiliadoModal } from "@/components/CriarCampanhaAfiliadoModal";
import {
  Package,
  Search,
  ExternalLink,
  Trash2,
  Megaphone,
  Loader2,
  Plus,
} from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import ImportCSVAfiliadoModal from "@/components/ImportCSVAfiliadoModal";

interface Produto {
  id: string;
  titulo: string;
  imagem_url: string | null;
  preco: number | null;
  link_afiliado: string;
  marketplace: string;
  descricao: string | null;
  status: string;
  categoria?: string | null;
}

const MARKETPLACES = [
  { value: "todos", label: "Todos" },
  { value: "amazon", label: "Amazon" },
  { value: "shopee", label: "Shopee" },
  { value: "magalu", label: "Magalu" },
  { value: "mercado_livre", label: "Mercado Livre" },
];

// Extract ASIN from Amazon URL for image
const getAmazonImageUrl = (url: string): string | null => {
  if (!url) return null;
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /amazon\.[^\/]+\/.*?([A-Z0-9]{10})(?:[\/\?]|$)/i,
  ];
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match?.[1]) {
      return `https://images-na.ssl-images-amazon.com/images/P/${match[1]}.01._SCLZZZZZZZ_.jpg`;
    }
  }
  return null;
};

export default function AfiliadoProdutos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [search, setSearch] = useState("");
  const [activeTab, setActiveTab] = useState("todos");
  const [campanhaModalOpen, setCampanhaModalOpen] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [showAddModal, setShowAddModal] = useState(false);
  const [showImportModal, setShowImportModal] = useState(false);
  const [newProduct, setNewProduct] = useState({ titulo: "", link_afiliado: "", preco: "", marketplace: "amazon", descricao: "", categoria: "" });
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    loadProdutos();
  }, []);

  const loadProdutos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { navigate("/login"); return; }

      const { data, error } = await supabase
        .from("afiliado_produtos")
        .select("*")
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProdutos(data || []);
    } catch (error) {
      console.error("Erro:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const { error } = await supabase.from("afiliado_produtos").delete().eq("id", id);
      if (error) throw error;
      setProdutos((prev) => prev.filter((p) => p.id !== id));
      toast.success("Produto removido");
    } catch {
      toast.error("Erro ao remover produto");
    }
  };

  const handleAddProduct = async () => {
    if (!newProduct.titulo || !newProduct.link_afiliado) {
      toast.error("Preencha título e link");
      return;
    }
    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Try to get Amazon image
      let imagem_url: string | null = null;
      if (newProduct.marketplace === "amazon") {
        imagem_url = getAmazonImageUrl(newProduct.link_afiliado);
      }

      const { error } = await supabase.from("afiliado_produtos").insert({
        user_id: user.id,
        titulo: newProduct.titulo,
        link_afiliado: newProduct.link_afiliado,
        preco: newProduct.preco ? parseFloat(newProduct.preco) : null,
        marketplace: newProduct.marketplace,
        descricao: newProduct.descricao || null,
        categoria: newProduct.categoria || null,
        imagem_url,
        status: "ativo",
      });

      if (error) throw error;
      toast.success("Produto adicionado!");
      setShowAddModal(false);
      setNewProduct({ titulo: "", link_afiliado: "", preco: "", marketplace: "amazon", descricao: "", categoria: "" });
      loadProdutos();
    } catch (error) {
      toast.error("Erro ao adicionar produto");
    } finally {
      setSaving(false);
    }
  };

  const filtered = produtos.filter((p) => {
    const matchesSearch = !search || p.titulo.toLowerCase().includes(search.toLowerCase());
    const matchesTab = activeTab === "todos" || p.marketplace.toLowerCase().includes(activeTab);
    return matchesSearch && matchesTab;
  });

  if (loading) {
    return (
      <AfiliadoLayout>
        <div className="flex items-center justify-center h-screen">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      </AfiliadoLayout>
    );
  }

  return (
    <AfiliadoLayout>
      <div className="p-6 md:p-8 max-w-6xl mx-auto space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
            <p className="text-sm text-muted-foreground">{produtos.length} produtos cadastrados</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setShowImportModal(true)}>Importar CSV</Button>
            <Button onClick={() => setShowAddModal(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Adicionar
            </Button>
          </div>
        </div>

        {/* Search */}
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar produtos..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>

        {/* Tabs */}
        <Tabs value={activeTab} onValueChange={setActiveTab}>
          <TabsList>
            {MARKETPLACES.map((m) => (
              <TabsTrigger key={m.value} value={m.value}>{m.label}</TabsTrigger>
            ))}
          </TabsList>
        </Tabs>

        {/* Products Grid */}
        {filtered.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <Package className="h-12 w-12 mx-auto mb-4 opacity-50" />
            <p>Nenhum produto encontrado</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {filtered.map((produto) => {
              const imgUrl = produto.imagem_url || (produto.marketplace === "amazon" ? getAmazonImageUrl(produto.link_afiliado) : null);
              return (
                <Card key={produto.id} className="overflow-hidden">
                  <div className="aspect-square bg-muted flex items-center justify-center overflow-hidden">
                    {imgUrl ? (
                      <img src={imgUrl} alt={produto.titulo} className="w-full h-full object-cover" />
                    ) : (
                      <Package className="h-12 w-12 text-muted-foreground/30" />
                    )}
                  </div>
                  <CardContent className="p-4 space-y-3">
                    <div>
                      <p className="font-medium text-sm line-clamp-2">{produto.titulo}</p>
                      <div className="flex items-center gap-2 mt-1">
                        <Badge variant="outline" className="text-xs capitalize">{produto.marketplace}</Badge>
                        {produto.categoria && (
                          <Badge variant="secondary" className="text-xs">{produto.categoria}</Badge>
                        )}
                      </div>
                    </div>
                    {produto.preco && (
                      <p className="text-lg font-bold text-primary">R$ {produto.preco.toFixed(2)}</p>
                    )}
                    <div className="flex gap-2">
                      <Button
                        size="sm"
                        variant="outline"
                        className="flex-1"
                        onClick={() => window.open(produto.link_afiliado, "_blank")}
                      >
                        <ExternalLink className="h-3.5 w-3.5 mr-1" />
                        Link
                      </Button>
                      <Button
                        size="sm"
                        className="flex-1"
                        onClick={() => {
                          setProdutoSelecionado(produto);
                          setCampanhaModalOpen(true);
                        }}
                      >
                        <Megaphone className="h-3.5 w-3.5 mr-1" />
                        Campanha
                      </Button>
                      <Button
                        size="sm"
                        variant="ghost"
                        onClick={() => handleDelete(produto.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5 text-destructive" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        )}
      </div>

      {/* Add Product Modal */}
      <Dialog open={showAddModal} onOpenChange={setShowAddModal}>
        <DialogContent className="bg-background">
          <DialogHeader>
            <DialogTitle>Adicionar Produto</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <Label>Título</Label>
              <Input value={newProduct.titulo} onChange={(e) => setNewProduct({ ...newProduct, titulo: e.target.value })} placeholder="Nome do produto" />
            </div>
            <div>
              <Label>Link de Afiliado</Label>
              <Input value={newProduct.link_afiliado} onChange={(e) => setNewProduct({ ...newProduct, link_afiliado: e.target.value })} placeholder="https://..." />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label>Preço (R$)</Label>
                <Input type="number" value={newProduct.preco} onChange={(e) => setNewProduct({ ...newProduct, preco: e.target.value })} placeholder="0.00" />
              </div>
              <div>
                <Label>Marketplace</Label>
                <Select value={newProduct.marketplace} onValueChange={(v) => setNewProduct({ ...newProduct, marketplace: v })}>
                  <SelectTrigger className="bg-background"><SelectValue /></SelectTrigger>
                  <SelectContent className="bg-background">
                    <SelectItem value="amazon">Amazon</SelectItem>
                    <SelectItem value="shopee">Shopee</SelectItem>
                    <SelectItem value="magalu">Magalu</SelectItem>
                    <SelectItem value="mercado_livre">Mercado Livre</SelectItem>
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={newProduct.descricao} onChange={(e) => setNewProduct({ ...newProduct, descricao: e.target.value })} placeholder="Descrição..." />
            </div>
            <Button className="w-full" onClick={handleAddProduct} disabled={saving}>
              {saving ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Plus className="h-4 w-4 mr-2" />}
              Adicionar Produto
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Campaign Modal */}
      {produtoSelecionado && (
        <CriarCampanhaAfiliadoModal
          open={campanhaModalOpen}
          onOpenChange={setCampanhaModalOpen}
          produto={{
            id: produtoSelecionado.id,
            titulo: produtoSelecionado.titulo,
            preco: produtoSelecionado.preco,
            link_afiliado: produtoSelecionado.link_afiliado,
            imagem_url: produtoSelecionado.imagem_url,
            descricao: produtoSelecionado.descricao,
            marketplace: produtoSelecionado.marketplace,
          }}
        />
      )}

      <ImportCSVAfiliadoModal
        isOpen={showImportModal}
        onClose={() => setShowImportModal(false)}
        onSuccess={loadProdutos}
      />
    </AfiliadoLayout>
  );
}
