import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { toast } from "sonner";
import { Loader2, Trash2, Edit, Eye, EyeOff, ArrowLeft } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

interface Product {
  id: string;
  titulo: string;
  preco: number;
  preco_original: number | null;
  link_afiliado: string;
  plataforma: string | null;
  categoria: string | null;
  ebook_bonus: string | null;
  imagens: any;
  ativo: boolean | null;
  created_at: string | null;
}

export default function AdminProdutos() {
  const navigate = useNavigate();
  const [links, setLinks] = useState("");
  const [categoria, setCategoria] = useState("");
  const [ebookBonus, setEbookBonus] = useState("");
  const [processing, setProcessing] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [filter, setFilter] = useState("");

  const categorias = [
    "📱 Eletrônicos",
    "🏠 Casa e Cozinha",
    "👶 Bebês",
    "👗 Moda",
    "💄 Beleza",
    "⚽ Esportes",
    "🎮 Games",
    "🐶 Pet Shop",
    "🧸 Brinquedos",
    "💊 Saúde",
  ];

  const ebooks = [
    "E-book Marketing Digital",
    "E-book Vendas Online",
    "E-book Redes Sociais",
    "E-book E-commerce",
  ];

  useEffect(() => {
    checkAuth();
    loadProducts();
  }, []);

  const checkAuth = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || user.email !== "expo@atombrasildigital.com") {
      toast.error("Acesso negado");
      navigate("/");
    }
  };

  const loadProducts = async () => {
    try {
      const { data, error } = await supabase
        .from("produtos_marketplace")
        .select("*")
        .order("created_at", { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error("Erro ao carregar produtos:", error);
      toast.error("Erro ao carregar produtos");
    } finally {
      setLoading(false);
    }
  };

  const processLinks = async () => {
    const linksArray = links
      .split("\n")
      .map((l) => l.trim())
      .filter((l) => l && l.includes("shopee.com"));

    if (linksArray.length === 0) {
      toast.error("Nenhum link válido da Shopee encontrado");
      return;
    }

    if (linksArray.length > 100) {
      toast.error("Máximo de 100 links por vez");
      return;
    }

    setProcessing(true);
    setProgress({ current: 0, total: linksArray.length });

    let successCount = 0;
    let errorCount = 0;

    for (let i = 0; i < linksArray.length; i++) {
      try {
        setProgress({ current: i + 1, total: linksArray.length });

        const { data, error } = await supabase.functions.invoke("converter-shopee", {
          body: { product_url: linksArray[i] },
        });

        if (error) throw error;

        if (data.success) {
          await supabase.from("produtos_marketplace").insert({
            titulo: data.titulo || "Produto Shopee",
            preco: parseFloat(data.preco) || 0,
            link_afiliado: data.affiliate_link,
            plataforma: "shopee",
            categoria: categoria || null,
            ebook_bonus: ebookBonus || null,
            imagens: data.imagem ? [data.imagem] : [],
            ativo: true,
          });
          successCount++;
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error(`Erro ao processar link ${i + 1}:`, error);
        errorCount++;
      }
    }

    setProcessing(false);
    setProgress({ current: 0, total: 0 });
    setLinks("");
    
    toast.success(`${successCount} produtos cadastrados com sucesso! ${errorCount} erros.`);
    loadProducts();
  };

  const toggleActive = async (id: string, currentStatus: boolean | null) => {
    try {
      const { error } = await supabase
        .from("produtos_marketplace")
        .update({ ativo: !currentStatus })
        .eq("id", id);

      if (error) throw error;
      toast.success("Status atualizado");
      loadProducts();
    } catch (error) {
      toast.error("Erro ao atualizar status");
    }
  };

  const deleteProduct = async (id: string) => {
    if (!confirm("Deseja realmente excluir este produto?")) return;

    try {
      const { error } = await supabase
        .from("produtos_marketplace")
        .delete()
        .eq("id", id);

      if (error) throw error;
      toast.success("Produto excluído");
      loadProducts();
    } catch (error) {
      toast.error("Erro ao excluir produto");
    }
  };

  const updateProduct = async () => {
    if (!editingProduct) return;

    try {
      const { error } = await supabase
        .from("produtos_marketplace")
        .update({
          titulo: editingProduct.titulo,
          preco: editingProduct.preco,
          categoria: editingProduct.categoria,
          ebook_bonus: editingProduct.ebook_bonus,
        })
        .eq("id", editingProduct.id);

      if (error) throw error;
      toast.success("Produto atualizado");
      setEditingProduct(null);
      loadProducts();
    } catch (error) {
      toast.error("Erro ao atualizar produto");
    }
  };

  const filteredProducts = products.filter(
    (p) =>
      p.titulo.toLowerCase().includes(filter.toLowerCase()) ||
      p.categoria?.toLowerCase().includes(filter.toLowerCase())
  );

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-background to-purple-950/10">
      {/* Header */}
      <div className="border-b border-border bg-card/50 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button
              variant="ghost"
              size="icon"
              onClick={() => navigate("/admin")}
            >
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-pink-600 bg-clip-text text-transparent">
                Admin - Cadastro de Produtos
              </h1>
              <p className="text-sm text-muted-foreground">
                Gerencie produtos do marketplace
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Card Conversor em Massa */}
        <Card className="border-purple-600/20 shadow-xl">
          <CardHeader>
            <CardTitle className="text-xl">
              🔗 Conversor em Massa - Shopee
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div>
              <Label htmlFor="links">
                Cole os links da Shopee (um por linha)
              </Label>
              <Textarea
                id="links"
                value={links}
                onChange={(e) => setLinks(e.target.value)}
                placeholder="https://shopee.com.br/produto-1&#10;https://shopee.com.br/produto-2&#10;https://shopee.com.br/produto-3"
                className="min-h-[200px] font-mono text-sm"
                disabled={processing}
              />
              <p className="text-xs text-muted-foreground mt-1">
                Máximo de 100 links por vez
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="categoria">Categoria (opcional)</Label>
                <Select value={categoria} onValueChange={setCategoria} disabled={processing}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {categorias.map((cat) => (
                      <SelectItem key={cat} value={cat}>
                        {cat}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <Label htmlFor="ebook">E-book Bônus (opcional)</Label>
                <Select value={ebookBonus} onValueChange={setEbookBonus} disabled={processing}>
                  <SelectTrigger>
                    <SelectValue placeholder="Selecione..." />
                  </SelectTrigger>
                  <SelectContent>
                    {ebooks.map((ebook) => (
                      <SelectItem key={ebook} value={ebook}>
                        {ebook}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>

            {processing && (
              <div className="p-4 bg-purple-600/10 border border-purple-600/20 rounded-lg">
                <p className="text-sm font-medium">
                  Processando {progress.current}/{progress.total} links...
                </p>
                <div className="w-full bg-purple-600/20 rounded-full h-2 mt-2">
                  <div
                    className="bg-gradient-to-r from-purple-600 to-pink-600 h-2 rounded-full transition-all"
                    style={{
                      width: `${(progress.current / progress.total) * 100}%`,
                    }}
                  />
                </div>
              </div>
            )}

            <Button
              onClick={processLinks}
              disabled={processing || !links.trim()}
              className="w-full bg-gradient-to-r from-purple-600 to-pink-600 hover:from-purple-700 hover:to-pink-700"
            >
              {processing ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Processando...
                </>
              ) : (
                <>
                  🔗 Converter Todos (
                  {links.split("\n").filter((l) => l.trim() && l.includes("shopee.com")).length}{" "}
                  links)
                </>
              )}
            </Button>
          </CardContent>
        </Card>

        {/* Tabela de Produtos */}
        <Card className="border-purple-600/20 shadow-xl">
          <CardHeader>
            <div className="flex items-center justify-between">
              <CardTitle>Produtos Cadastrados ({products.length})</CardTitle>
              <Input
                placeholder="Filtrar produtos..."
                value={filter}
                onChange={(e) => setFilter(e.target.value)}
                className="max-w-xs"
              />
            </div>
          </CardHeader>
          <CardContent>
            {loading ? (
              <div className="flex items-center justify-center py-8">
                <Loader2 className="h-8 w-8 animate-spin text-purple-600" />
              </div>
            ) : (
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Status</TableHead>
                      <TableHead>Título</TableHead>
                      <TableHead>Categoria</TableHead>
                      <TableHead>Preço</TableHead>
                      <TableHead>Plataforma</TableHead>
                      <TableHead>E-book</TableHead>
                      <TableHead>Data</TableHead>
                      <TableHead>Ações</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {filteredProducts.map((product) => (
                      <TableRow key={product.id}>
                        <TableCell>
                          {product.ativo ? (
                            <Badge className="bg-green-600">Ativo</Badge>
                          ) : (
                            <Badge variant="secondary">Inativo</Badge>
                          )}
                        </TableCell>
                        <TableCell className="max-w-[300px] truncate">
                          {product.titulo}
                        </TableCell>
                        <TableCell>{product.categoria || "-"}</TableCell>
                        <TableCell>R$ {product.preco.toFixed(2)}</TableCell>
                        <TableCell>
                          <Badge variant="outline">{product.plataforma}</Badge>
                        </TableCell>
                        <TableCell className="max-w-[150px] truncate">
                          {product.ebook_bonus || "-"}
                        </TableCell>
                        <TableCell>
                          {product.created_at
                            ? new Date(product.created_at).toLocaleDateString()
                            : "-"}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <Dialog>
                              <DialogTrigger asChild>
                                <Button
                                  size="icon"
                                  variant="ghost"
                                  onClick={() => setEditingProduct(product)}
                                >
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </DialogTrigger>
                              <DialogContent>
                                <DialogHeader>
                                  <DialogTitle>Editar Produto</DialogTitle>
                                </DialogHeader>
                                {editingProduct && (
                                  <div className="space-y-4">
                                    <div>
                                      <Label>Título</Label>
                                      <Input
                                        value={editingProduct.titulo}
                                        onChange={(e) =>
                                          setEditingProduct({
                                            ...editingProduct,
                                            titulo: e.target.value,
                                          })
                                        }
                                      />
                                    </div>
                                    <div>
                                      <Label>Preço</Label>
                                      <Input
                                        type="number"
                                        step="0.01"
                                        value={editingProduct.preco}
                                        onChange={(e) =>
                                          setEditingProduct({
                                            ...editingProduct,
                                            preco: parseFloat(e.target.value),
                                          })
                                        }
                                      />
                                    </div>
                                    <div>
                                      <Label>Categoria</Label>
                                      <Select
                                        value={editingProduct.categoria || ""}
                                        onValueChange={(value) =>
                                          setEditingProduct({
                                            ...editingProduct,
                                            categoria: value,
                                          })
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {categorias.map((cat) => (
                                            <SelectItem key={cat} value={cat}>
                                              {cat}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <div>
                                      <Label>E-book Bônus</Label>
                                      <Select
                                        value={editingProduct.ebook_bonus || ""}
                                        onValueChange={(value) =>
                                          setEditingProduct({
                                            ...editingProduct,
                                            ebook_bonus: value,
                                          })
                                        }
                                      >
                                        <SelectTrigger>
                                          <SelectValue />
                                        </SelectTrigger>
                                        <SelectContent>
                                          {ebooks.map((ebook) => (
                                            <SelectItem key={ebook} value={ebook}>
                                              {ebook}
                                            </SelectItem>
                                          ))}
                                        </SelectContent>
                                      </Select>
                                    </div>
                                    <Button
                                      onClick={updateProduct}
                                      className="w-full"
                                    >
                                      Salvar
                                    </Button>
                                  </div>
                                )}
                              </DialogContent>
                            </Dialog>

                            <Button
                              size="icon"
                              variant="ghost"
                              onClick={() => toggleActive(product.id, product.ativo)}
                            >
                              {product.ativo ? (
                                <Eye className="h-4 w-4" />
                              ) : (
                                <EyeOff className="h-4 w-4" />
                              )}
                            </Button>

                            <Button
                              size="icon"
                              variant="ghost"
                              className="text-destructive"
                              onClick={() => deleteProduct(product.id)}
                            >
                              <Trash2 className="h-4 w-4" />
                            </Button>
                          </div>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
