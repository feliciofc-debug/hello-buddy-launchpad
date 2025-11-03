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
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Package, Search, Plus, Pencil, Trash2, Rocket, ArrowLeft, Sun, Moon, Upload, Image as ImageIcon, Users, Store, X } from 'lucide-react';
import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';
import ImportCSVModal from '@/components/ImportCSVModal';
import { ClientesManager } from '@/components/ClientesManager';
import { CriarCampanhaModal } from '@/components/CriarCampanhaModal';

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
  cliente_id: string | null;
  clientes?: { nome: string; tipo_negocio: string | null };
}

interface Cliente {
  id: string;
  nome: string;
  tipo_negocio: string | null;
}

interface ProductFormProps {
  formData: {
    nome: string;
    descricao: string;
    preco: string;
    categoria: string;
    sku: string;
    link: string;
    tags: string;
    ativo: boolean;
    tipo_produto: string;
    cliente_id: string | null;
  };
  setFormData: (data: any) => void;
  clientes: Cliente[];
  onSubmit: () => void;
  submitLabel: string;
  setIsClientesManagerOpen: (open: boolean) => void;
  setIsAddModalOpen: (open: boolean) => void;
  setIsEditModalOpen: (open: boolean) => void;
  imageFile: File | null;
  setImageFile: (file: File | null) => void;
  previewImage: string | null;
  currentImageUrl?: string | null;
}

const ProductForm = ({ 
  formData, 
  setFormData, 
  clientes, 
  onSubmit, 
  submitLabel,
  setIsClientesManagerOpen,
  setIsAddModalOpen,
  setIsEditModalOpen,
  imageFile,
  setImageFile,
  previewImage,
  currentImageUrl
}: ProductFormProps) => {
  const handleImageChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (!file.type.startsWith('image/')) {
        toast.error('Apenas imagens são permitidas');
        return;
      }
      if (file.size > 5 * 1024 * 1024) {
        toast.error('Imagem muito grande. Máximo 5MB');
        return;
      }
      setImageFile(file);
    }
  };

  const removeImage = () => {
    setImageFile(null);
  };

  return (
  <div className="space-y-4">
    <div className="space-y-2">
      <Label>Este produto é de:</Label>
      <RadioGroup 
        value={formData.tipo_produto} 
        onValueChange={(v) => setFormData({ ...formData, tipo_produto: v, cliente_id: null })}
      >
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="minha-empresa" id="minha" />
          <Label htmlFor="minha">🏢 Minha Empresa</Label>
        </div>
        <div className="flex items-center space-x-2">
          <RadioGroupItem value="cliente" id="cliente" />
          <Label htmlFor="cliente">👤 Um Cliente Meu</Label>
        </div>
      </RadioGroup>
    </div>

    {formData.tipo_produto === 'cliente' && (
      <div className="space-y-2">
        <Label htmlFor="cliente_select">Selecione o Cliente *</Label>
        <Select 
          value={formData.cliente_id || ''} 
          onValueChange={(v) => setFormData({ ...formData, cliente_id: v })}
        >
          <SelectTrigger>
            <SelectValue placeholder="Escolha um cliente..." />
          </SelectTrigger>
          <SelectContent>
            {clientes.map((c) => (
              <SelectItem key={c.id} value={c.id}>
                {c.nome} {c.tipo_negocio && `- ${c.tipo_negocio}`}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
        {clientes.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Você ainda não tem clientes cadastrados.{' '}
            <Button 
              variant="link" 
              className="p-0 h-auto"
              onClick={() => setIsClientesManagerOpen(true)}
            >
              Adicionar cliente
            </Button>
          </p>
        )}
      </div>
    )}

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

    {/* Upload de Imagem */}
    <div className="space-y-2">
      <Label>Imagem do Produto</Label>
      <div className="border-2 border-dashed rounded-lg p-4">
        {(previewImage || currentImageUrl) && !imageFile && currentImageUrl ? (
          <div className="relative">
            <img 
              src={currentImageUrl} 
              alt="Produto atual" 
              className="w-full h-48 object-cover rounded"
            />
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Imagem atual do produto
            </p>
          </div>
        ) : previewImage ? (
          <div className="relative">
            <img 
              src={previewImage} 
              alt="Preview" 
              className="w-full h-48 object-cover rounded"
            />
            <Button
              type="button"
              variant="destructive"
              size="sm"
              className="absolute top-2 right-2"
              onClick={removeImage}
            >
              <X className="w-4 h-4" />
            </Button>
            <p className="text-xs text-muted-foreground mt-2 text-center">
              Nova imagem selecionada
            </p>
          </div>
        ) : (
          <div className="text-center">
            <Upload className="w-12 h-12 mx-auto text-muted-foreground mb-2" />
            <Label 
              htmlFor="image-upload" 
              className="cursor-pointer text-primary hover:underline"
            >
              Clique para selecionar uma imagem
            </Label>
            <input
              id="image-upload"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
            <p className="text-xs text-muted-foreground mt-2">
              PNG, JPG ou WEBP (máx. 5MB)
            </p>
          </div>
        )}
        {(previewImage || (currentImageUrl && !previewImage)) && (
          <div className="mt-3">
            <Label 
              htmlFor="image-upload-change" 
              className="cursor-pointer inline-flex items-center gap-2 px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors text-sm"
            >
              <Upload className="w-4 h-4" />
              Alterar Imagem
            </Label>
            <input
              id="image-upload-change"
              type="file"
              accept="image/*"
              onChange={handleImageChange}
              className="hidden"
            />
          </div>
        )}
      </div>
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
};

export default function MeusProdutos() {
  const navigate = useNavigate();
  const { theme, setTheme } = useTheme();
  const [products, setProducts] = useState<Product[]>([]);
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [categoryFilter, setCategoryFilter] = useState('all');
  const [clienteAtivo, setClienteAtivo] = useState<string>('minha-empresa');
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [isEditModalOpen, setIsEditModalOpen] = useState(false);
  const [isImportCSVOpen, setIsImportCSVOpen] = useState(false);
  const [isClientesManagerOpen, setIsClientesManagerOpen] = useState(false);
  const [isCampanhaModalOpen, setIsCampanhaModalOpen] = useState(false);
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
    ativo: true,
    tipo_produto: 'minha-empresa',
    cliente_id: null as string | null
  });
  const [imageFile, setImageFile] = useState<File | null>(null);
  const [previewImage, setPreviewImage] = useState<string | null>(null);
  const [currentImageUrl, setCurrentImageUrl] = useState<string | null>(null);

  // Preview da imagem quando selecionada
  useEffect(() => {
    if (imageFile) {
      const objectUrl = URL.createObjectURL(imageFile);
      setPreviewImage(objectUrl);
      return () => URL.revokeObjectURL(objectUrl);
    } else {
      setPreviewImage(null);
    }
  }, [imageFile]);

  const toggleDarkMode = () => {
    setTheme(theme === 'dark' ? 'light' : 'dark');
  };

  useEffect(() => {
    fetchProducts();
    fetchClientes();
  }, []);

  useEffect(() => {
    // Extract unique categories from products
    const uniqueCategories = Array.from(new Set(products.map(p => p.categoria)));
    setCategories(uniqueCategories);
  }, [products]);

  const fetchProducts = async () => {
    try {
      setIsLoading(true);
      const { data, error } = await supabase
        .from('produtos')
        .select('*, clientes(nome, tipo_negocio)')
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

  const fetchClientes = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('clientes')
        .select('id, nome, tipo_negocio')
        .eq('user_id', user.id)
        .order('nome', { ascending: true });

      if (error) throw error;
      setClientes(data || []);
    } catch (error) {
      console.error('Erro ao buscar clientes:', error);
    }
  };

  const uploadImage = async (file: File, productId: string): Promise<string | null> => {
    try {
      const fileExt = file.name.split('.').pop();
      const fileName = `${productId}-${Date.now()}.${fileExt}`;
      const filePath = `${fileName}`;

      const { error: uploadError, data } = await supabase.storage
        .from('produtos')
        .upload(filePath, file, {
          cacheControl: '3600',
          upsert: false
        });

      if (uploadError) throw uploadError;

      const { data: { publicUrl } } = supabase.storage
        .from('produtos')
        .getPublicUrl(filePath);

      return publicUrl;
    } catch (error) {
      console.error('Erro ao fazer upload da imagem:', error);
      toast.error('Erro ao fazer upload da imagem');
      return null;
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

      // Primeiro insere o produto sem a imagem
      const { data: newProduct, error } = await supabase
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
          ativo: formData.ativo,
          cliente_id: formData.tipo_produto === 'cliente' ? formData.cliente_id : null,
          imagem_url: null
        })
        .select()
        .single();

      if (error) throw error;

      // Se tem imagem, faz upload e atualiza o produto
      if (imageFile && newProduct) {
        const imageUrl = await uploadImage(imageFile, newProduct.id);
        if (imageUrl) {
          const { error: updateError } = await supabase
            .from('produtos')
            .update({ imagem_url: imageUrl })
            .eq('id', newProduct.id);

          if (updateError) {
            console.error('Erro ao atualizar URL da imagem:', updateError);
          }
        }
      }

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
      const { error } = await supabase
        .from('produtos')
        .update({
          nome: formData.nome,
          descricao: formData.descricao || null,
          preco: formData.preco ? parseFloat(formData.preco) : null,
          categoria: formData.categoria,
          sku: formData.sku || null,
          link: formData.link || null,
          tags: formData.tags ? formData.tags.split(',').map(t => t.trim()) : null,
          ativo: formData.ativo,
          cliente_id: formData.tipo_produto === 'cliente' ? formData.cliente_id : null
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
    if (!confirm('Tem certeza que deseja deletar este produto?')) return;

    try {
      const { error } = await supabase
        .from('produtos')
        .delete()
        .eq('id', productId);

      if (error) throw error;

      toast.success('Produto deletado!');
      fetchProducts();
    } catch (error) {
      console.error('Erro ao excluir produto:', error);
      toast.error('Erro ao excluir produto');
    }
  };

  const handleCreateCampaign = (product: Product) => {
    setSelectedProduct(product);
    setIsCampanhaModalOpen(true);
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
      ativo: product.ativo,
      tipo_produto: product.cliente_id ? 'cliente' : 'minha-empresa',
      cliente_id: product.cliente_id
    });
    setCurrentImageUrl(product.imagem_url);
    setImageFile(null);
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
      ativo: true,
      tipo_produto: 'minha-empresa',
      cliente_id: null
    });
    setSelectedProduct(null);
    setImageFile(null);
    setCurrentImageUrl(null);
  };

  const getFilteredProducts = () => {
    let filtered = products;

    // Filtro por cliente ativo
    if (clienteAtivo === 'minha-empresa') {
      filtered = filtered.filter(p => !p.cliente_id);
    } else if (clienteAtivo !== 'todos') {
      filtered = filtered.filter(p => p.cliente_id === clienteAtivo);
    }

    // Filtro de busca
    filtered = filtered.filter(product => {
      const matchesSearch = product.nome.toLowerCase().includes(searchTerm.toLowerCase()) ||
                           (product.descricao?.toLowerCase() || '').includes(searchTerm.toLowerCase());
      const matchesCategory = categoryFilter === 'all' || product.categoria === categoryFilter;
      return matchesSearch && matchesCategory;
    });

    return filtered;
  };

  const filteredProducts = getFilteredProducts();

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
                <h1 className="text-4xl font-bold">📦 Gestão de Produtos</h1>
                <p className="text-muted-foreground mt-1">Organize produtos seus e de seus clientes</p>
              </div>
            </div>
            <div className="flex items-center gap-3">
              <Button onClick={() => setIsClientesManagerOpen(true)} variant="outline" className="gap-2">
                <Users className="w-4 h-4" />
                Gerenciar Clientes
              </Button>
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

        {/* Tabs de Cliente */}
        <Tabs value={clienteAtivo} onValueChange={setClienteAtivo}>
          <TabsList className="w-full justify-start overflow-x-auto">
            <TabsTrigger value="minha-empresa" className="gap-2">
              <Store className="w-4 h-4" />
              🏢 Minha Empresa
            </TabsTrigger>
            {clientes.map((cliente) => (
              <TabsTrigger key={cliente.id} value={cliente.id} className="gap-2">
                <Users className="w-4 h-4" />
                {cliente.nome}
              </TabsTrigger>
            ))}
            <TabsTrigger value="todos" className="gap-2">
              📋 Todos os Clientes
            </TabsTrigger>
          </TabsList>
        </Tabs>

        {/* Filtros */}
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
                  <SelectItem value="all">Todas Categorias ({filteredProducts.length})</SelectItem>
                  {categories.map((cat) => (
                    <SelectItem key={cat} value={cat}>
                      {cat} ({filteredProducts.filter(p => p.categoria === cat).length})
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
                    <div className="relative">
                      {product.imagem_url ? (
                        <img src={product.imagem_url} alt={product.nome} className="w-16 h-16 object-cover rounded" />
                      ) : (
                        <ImageIcon className="w-16 h-16 text-muted-foreground" />
                      )}
                      {product.cliente_id && product.clientes && (
                        <Badge variant="outline" className="absolute -top-2 -right-2 text-xs">
                          👤 {product.clientes.nome}
                        </Badge>
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
                  </div>

                  <div className="flex gap-2 pt-4">
                    <Button 
                      size="sm" 
                      className="flex-1 gap-2"
                      onClick={() => handleCreateCampaign(product)}
                    >
                      <Rocket className="w-4 h-4" />
                      Criar Campanha
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => openEditModal(product)}
                    >
                      <Pencil className="w-4 h-4" />
                    </Button>
                    <Button 
                      variant="outline" 
                      size="icon"
                      onClick={() => handleDeleteProduct(product.id)}
                    >
                      <Trash2 className="w-4 h-4 text-destructive" />
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>

      {/* Modals */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Adicionar Produto</DialogTitle>
            <DialogDescription>Preencha os dados do novo produto</DialogDescription>
          </DialogHeader>
          <ProductForm 
            formData={formData}
            setFormData={setFormData}
            clientes={clientes}
            onSubmit={handleAddProduct}
            submitLabel="Adicionar Produto"
            setIsClientesManagerOpen={setIsClientesManagerOpen}
            setIsAddModalOpen={setIsAddModalOpen}
            setIsEditModalOpen={setIsEditModalOpen}
            imageFile={imageFile}
            setImageFile={setImageFile}
            previewImage={previewImage}
            currentImageUrl={null}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar Produto</DialogTitle>
            <DialogDescription>Atualize as informações do produto</DialogDescription>
          </DialogHeader>
          <ProductForm 
            formData={formData}
            setFormData={setFormData}
            clientes={clientes}
            onSubmit={handleEditProduct}
            submitLabel="Salvar Alterações"
            setIsClientesManagerOpen={setIsClientesManagerOpen}
            setIsAddModalOpen={setIsAddModalOpen}
            setIsEditModalOpen={setIsEditModalOpen}
            imageFile={imageFile}
            setImageFile={setImageFile}
            previewImage={previewImage}
            currentImageUrl={currentImageUrl}
          />
        </DialogContent>
      </Dialog>

      <ImportCSVModal
        isOpen={isImportCSVOpen}
        onClose={() => setIsImportCSVOpen(false)}
        onSuccess={fetchProducts}
      />

      <ClientesManager
        isOpen={isClientesManagerOpen}
        onClose={() => {
          setIsClientesManagerOpen(false);
          fetchClientes();
        }}
      />

      {selectedProduct && (
        <CriarCampanhaModal
          isOpen={isCampanhaModalOpen}
          onClose={() => {
            setIsCampanhaModalOpen(false);
            setSelectedProduct(null);
          }}
          produto={selectedProduct}
          cliente={selectedProduct.clientes || null}
        />
      )}
    </div>
  );
}
