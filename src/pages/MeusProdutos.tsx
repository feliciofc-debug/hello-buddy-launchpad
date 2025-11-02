import { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { useTheme } from 'next-themes';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Package, Search, Plus, Pencil, Trash2, Rocket, ArrowLeft, Sun, Moon, Upload, Image as ImageIcon } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ImportCSVModal from '@/components/ImportCSVModal';
import CreateCampaignModal from '@/components/CreateCampaignModal';

interface Product {
  id: string;
  nome: string;
  descricao: string | null;
  preco: number | null;
  imagem_url: string | null;
  categoria: string;
  sku: string | null;
  link: string | null;
  tags: string[] | null;
  ativo: boolean;
  created_at: string;
}

export default function MeusProdutos() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportCSVOpen, setIsImportCSVOpen] = useState(false);
  const [isCampaignModalOpen, setIsCampaignModalOpen] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState<Product | null>(null);
  const [categories, setCategories] = useState<string[]>([]);

  // Form states
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    preco: '',
    categoria: '',
    sku: '',
    link: '',
    tags: '',
    ativo: true
  });

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    fetchProducts();
    fetchLojas();
  }, []);

  useEffect(() => {
    // Extract unique categories from products
    const uniqueCategories = Array.from(new Set(products.map(p => p.categoria)));
    setCategories(uniqueCategories);
  }, [products]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await (supabase as any)
        .from('produtos')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProducts(data || []);
    } catch (error) {
      console.error('Erro ao buscar produtos:', error);
      toast.error('Erro ao carregar produtos');
    } finally {
      setIsLoading(false);
    }
  };

  const handleAddProduct = async () => {
    if (!formData.nome || !formData.categoria) {
      toast.error('Nome e categoria são obrigatórios');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        toast.error('Usuário não autenticado');
        return;
      }

      const { error } = await (supabase as any)
        .from('produtos')
        .insert({
          user_id: user.id,
          nome: formData.nome,
          descricao: formData.descricao || null,
          preco: formData.preco ? parseFloat(formData.preco) : null,
          categoria: formData.categoria,
          sku: formData.sku || null,
          link: formData.link || null,
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : null,
          ativo: formData.ativo
        });

      if (error) throw error;

      toast.success('Produto adicionado com sucesso!');
      setIsAddModalOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Erro ao adicionar produto:', error);
      toast.error('Erro ao adicionar produto');
    }
  };

  const handleEditProduct = async () => {
    if (!selectedProduct) return;

    try {
      const { error } = await (supabase as any)
        .from('produtos')
        .update({
          nome: formData.nome,
          descricao: formData.descricao || null,
          preco: formData.preco ? parseFloat(formData.preco) : null,
          categoria: formData.categoria,
          sku: formData.sku || null,
          link: formData.link || null,
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : null,
          ativo: formData.ativo
        })
        .eq('id', selectedProduct.id);

      if (error) throw error;

      toast.success('Produto atualizado com sucesso!');
      setIsEditModalOpen(false);
      resetForm();
      fetchProducts();
    } catch (error) {
      console.error('Erro ao atualizar produto:', error);
      toast.error('Erro ao atualizar produto');
    }
  };

  const handleDeleteProduct = async (productId: string) => {
    if (!confirm('Tem certeza que deseja deletar este produto? Esta ação não pode ser desfeita.')) return;

    try {
      const { error } = await (supabase as any)
        .from('produtos')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast.success('Produto deletado permanentemente!');
      fetchProducts();
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      toast.error('Erro ao excluir produto');
    }
  };

  const handleCreateCampaign = (product: Product) => {
    setSelectedProduct(product);
    setIsCampaignModalOpen(true);
  };

  const openAddModal = () => {
    resetForm();
    setIsAddModalOpen(true);
  };

  const openEditModal = (product: Product) => {
    setSelectedProduct(product);
    setFormData({
      nome: product.nome,
      descricao: product.descricao || '',
      preco: product.preco?.toString() || '',
      categoria: product.categoria,
      sku: product.sku || '',
      link: product.link || '',
      tags: product.tags?.join(', ') || '',
      ativo: product.ativo
    });
    setIsEditModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      preco: '',
      categoria: '',
      sku: '',
      link: '',
      tags: '',
      ativo: true
    });
    setSelectedProduct(null);
  };

  const filteredProducts = products.filter(product => {
    const matchesSearch = product.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         (product.descricao?.toLowerCase() || '').includes(searchTerm.toLowerCase()) ||
                         (product.sku?.toLowerCase() || '').includes(searchTerm.toLowerCase());
    const matchesCategory = categoryFilter === 'all' || product.categoria === categoryFilter;
    
    return matchesSearch && matchesCategory;
  });

  const ProductForm = ({ onSubmit, submitLabel }: { onSubmit: () => void; submitLabel: string }) => (
    <div className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="nome">Nome do Produto *</Label>
        <Input
          id="nome"
          value={formData.nome}
          onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
          placeholder="Ex: Smartphone Galaxy S21"
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="descricao">Descrição</Label>
        <Textarea
          id="descricao"
          value={formData.descricao}
          onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
          placeholder="Descrição detalhada do produto..."
          rows={3}
        />
      </div>

      <div className="grid grid-cols-2 gap-4">
        <div className="space-y-2">
          <Label htmlFor="preco">Preço (R$)</Label>
          <Input
            id="preco"
            type="number"
            step="0.01"
            value={formData.preco}
            onChange={(e) => setFormData({ ...formData, preco: e.target.value })}
            placeholder="0.00"
          />
        </div>

        <div className="space-y-2">
          <Label htmlFor="sku">SKU/Código</Label>
          <Input
            id="sku"
            value={formData.sku}
            onChange={(e) => setFormData({ ...formData, sku: e.target.value })}
            placeholder="Ex: PROD-001"
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="categoria">Categoria *</Label>
        <Input
          id="categoria"
          value={formData.categoria}
          onChange={(e) => setFormData({ ...formData, categoria: e.target.value })}
          placeholder="Ex: Eletrônicos, Roupas, Alimentos..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="link">Link do Produto</Label>
        <Input
          id="link"
          type="url"
          value={formData.link}
          onChange={(e) => setFormData({ ...formData, link: e.target.value })}
          placeholder="https://..."
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="tags">Tags (separadas por vírgula)</Label>
        <Input
          id="tags"
          value={formData.tags}
          onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
          placeholder="Ex: promoção, novo, destaque"
        />
      </div>

      <div className="flex items-center gap-3">
        <Label htmlFor="ativo">Status:</Label>
        <Select 
          value={formData.ativo ? 'true' : 'false'} 
          onValueChange={(v) => setFormData({ ...formData, ativo: v === 'true' })}
        >
          <SelectTrigger className="w-32">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Ativo</SelectItem>
            <SelectItem value="false">Pausado</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="flex gap-3 justify-end pt-4">
        <Button variant="outline" onClick={() => {
          setIsAddModalOpen(false);
          setIsEditModalOpen(false);
        }}>
          Cancelar
        </Button>
        <Button onClick={onSubmit}>
          {submitLabel}
        </Button>
      </div>
    </div>
  );

  return (
    <div className="min-h-screen bg-background">
      <div className="container mx-auto p-6 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 bg-gradient-to-br from-blue-500 to-purple-500 rounded-xl flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-4xl font-bold text-foreground">📦 Meu Catálogo de Produtos</h1>
                <p className="text-muted-foreground mt-1">Organize seus produtos e crie campanhas rapidamente</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={openAddModal} className="gap-2">
                <Plus className="w-4 h-4" />
                Adicionar Produto
              </Button>
              <Button onClick={() => setIsImportCSVOpen(true)} variant="outline" className="gap-2">
                <Upload className="w-4 h-4" />
                Importar CSV
              </Button>
              <Button variant="outline" onClick={() => navigate('/dashboard')} className="gap-2">
                <ArrowLeft className="w-4 h-4" />
                Dashboard
              </Button>
              <Button variant="outline" size="icon" onClick={toggleDarkMode}>
                {theme === 'dark' ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </Button>
            </div>
          </div>
        </div>

        {/* Filters */}
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Search className="w-5 h-5" />
              Filtros
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="relative">
                <Search className="absolute left-3 top-3 w-4 h-4 text-muted-foreground" />
                <Input
                  placeholder="Buscar produtos..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="pl-9"
                />
              </div>
              
              <Select value={categoryFilter} onValueChange={setCategoryFilter}>
                <SelectTrigger>
                  <SelectValue placeholder="Categoria" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Todas Categorias ({products.length})</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat} ({products.filter(p => p.categoria === cat).length})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {/* Products Grid */}
        {isLoading ? (
          <div className="text-center py-12">
            <p className="text-muted-foreground">Carregando produtos...</p>
          </div>
        ) : filteredProducts.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Package className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground text-lg mb-4">
                {searchTerm || categoryFilter !== 'all' 
                  ? 'Nenhum produto encontrado com os filtros selecionados.'
                  : 'Você ainda não tem produtos cadastrados.'}
              </p>
              {!searchTerm && categoryFilter === 'all' && (
                <Button onClick={openAddModal} className="gap-2">
                  <Plus className="w-4 h-4" />
                  Adicionar Primeiro Produto
                </Button>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredProducts.map((product) => (
              <Card key={product.id} className="hover:shadow-lg transition-all duration-300">
                <CardHeader>
                  <div className="flex items-start justify-between mb-3">
                    <div className="text-5xl">
                      {product.imagem_url ? (
                        <img src={product.imagem_url} alt={product.nome} className="w-16 h-16 object-cover rounded" />
                      ) : (
                        <ImageIcon className="w-16 h-16 text-muted-foreground" />
                      )}
                    </div>
                    <Badge variant={product.ativo ? 'default' : 'secondary'}>
                      {product.ativo ? 'Ativo' : 'Pausado'}
                    </Badge>
                  </div>
                  <CardTitle className="text-xl">{product.nome}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {product.descricao || 'Sem descrição'}
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  {product.preco && (
                    <div className="flex items-center justify-between p-3 bg-primary/10 rounded-lg">
                      <span className="text-sm font-medium">Preço:</span>
                      <span className="text-2xl font-bold text-primary">
                        R$ {product.preco.toFixed(2)}
                      </span>
                    </div>
                  )}
                  
                  <div className="space-y-2 text-sm">
                    <div className="flex items-center justify-between">
                      <span className="text-muted-foreground">Categoria:</span>
                      <Badge variant="outline">{product.categoria}</Badge>
                    </div>
                    {product.sku && (
                      <div className="flex items-center justify-between">
                        <span className="text-muted-foreground">SKU:</span>
                        <span className="font-medium">{product.sku}</span>
                      </div>
                    )}
                    {product.tags && product.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 pt-2">
                        {product.tags.map((tag, i) => (
                          <Badge key={i} variant="secondary" className="text-xs">
                            {tag}
                          </Badge>
                        ))}
                      </div>
                    )}
                  </div>
                  
                  <div className="grid grid-cols-3 gap-2 pt-2">
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => openEditModal(product)}
                      className="gap-1"
                    >
                      <Pencil className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleCreateCampaign(product)}
                      className="gap-1 col-span-1"
                    >
                      <Rocket className="w-3 h-3" />
                    </Button>
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => handleDeleteProduct(product.id)}
                      className="gap-1 text-destructive hover:bg-destructive hover:text-destructive-foreground"
                    >
                      <Trash2 className="w-3 h-3" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Add Product Modal */}
        <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Plus className="w-5 h-5" />
                Adicionar Produto
              </DialogTitle>
              <DialogDescription>
                Preencha os dados do novo produto
              </DialogDescription>
            </DialogHeader>
            <ProductForm onSubmit={handleAddProduct} submitLabel="Adicionar Produto" />
          </DialogContent>
        </Dialog>

        {/* Edit Product Modal */}
        <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
          <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="w-5 h-5" />
                Editar Produto
              </DialogTitle>
              <DialogDescription>
                Atualize os dados do produto
              </DialogDescription>
            </DialogHeader>
            <ProductForm onSubmit={handleEditProduct} submitLabel="Salvar Alterações" />
          </DialogContent>
        </Dialog>

        {/* Import CSV Modal */}
        <ImportCSVModal
          isOpen={isImportCSVOpen}
          onClose={() => setIsImportCSVOpen(false)}
          onSuccess={() => {
            setIsImportCSVOpen(false);
            fetchProducts();
          }}
        />

        {/* Create Campaign Modal */}
        <CreateCampaignModal
          isOpen={isCampaignModalOpen}
          onClose={() => {
            setIsCampaignModalOpen(false);
            setSelectedProduct(null);
          }}
          product={selectedProduct}
        />
      </div>
    </div>
  );
}
