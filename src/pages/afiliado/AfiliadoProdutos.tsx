import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { 
  ArrowLeft, Plus, Package, Trash2, Edit, Upload, Megaphone, 
  ChefHat, Home, Smartphone, Gamepad2, Baby, Sparkles, Dumbbell, 
  Wrench, Cat, Shirt, Car, LayoutGrid, Sofa, BookOpen, BookMarked,
  Briefcase, Leaf, Tv, ShowerHead, Zap, UtensilsCrossed, HardHat,
  Droplets, Pencil
} from "lucide-react";
import { toast } from "sonner";
import ImportCSVAfiliadoModal from "@/components/ImportCSVAfiliadoModal";
import { CriarCampanhaAfiliadoModal } from "@/components/CriarCampanhaAfiliadoModal";

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

// 22 Categorias Amazon (nomes exatos) + Todos
const CATEGORIAS = [
  { value: 'Todos', label: 'Todos', icon: LayoutGrid, color: 'bg-gray-500' },
  { value: 'Alimentos e Bebidas', label: 'Alimentos e Bebidas', icon: UtensilsCrossed, color: 'bg-amber-500' },
  { value: 'Automotivo', label: 'Automotivo', icon: Car, color: 'bg-slate-600' },
  { value: 'Bebês', label: 'Bebês', icon: Baby, color: 'bg-pink-400' },
  { value: 'Beleza', label: 'Beleza', icon: Sparkles, color: 'bg-rose-500' },
  { value: 'Brinquedos e Jogos', label: 'Brinquedos e Jogos', icon: Gamepad2, color: 'bg-purple-400' },
  { value: 'Casa', label: 'Casa', icon: Home, color: 'bg-blue-500' },
  { value: 'Construção', label: 'Construção', icon: HardHat, color: 'bg-orange-700' },
  { value: 'Cozinha', label: 'Cozinha', icon: ChefHat, color: 'bg-orange-500' },
  { value: 'Cuidados Pessoais e Limpeza', label: 'Cuidados Pessoais e Limpeza', icon: ShowerHead, color: 'bg-cyan-500' },
  { value: 'Eletrodomésticos', label: 'Eletrodomésticos', icon: Zap, color: 'bg-yellow-500' },
  { value: 'Eletrônicos e Celulares', label: 'Eletrônicos e Celulares', icon: Smartphone, color: 'bg-indigo-500' },
  { value: 'Esportes e Aventura', label: 'Esportes e Aventura', icon: Dumbbell, color: 'bg-red-500' },
  { value: 'Ferramentas e Construção', label: 'Ferramentas e Construção', icon: Wrench, color: 'bg-amber-600' },
  { value: 'Informática', label: 'Informática', icon: Tv, color: 'bg-violet-500' },
  { value: 'Jardim e Piscina', label: 'Jardim e Piscina', icon: Droplets, color: 'bg-green-500' },
  { value: 'Livros', label: 'Livros', icon: BookOpen, color: 'bg-amber-700' },
  { value: 'eBooks', label: 'eBooks', icon: BookMarked, color: 'bg-teal-500' },
  { value: 'Moda', label: 'Moda', icon: Shirt, color: 'bg-fuchsia-500' },
  { value: 'Móveis', label: 'Móveis', icon: Sofa, color: 'bg-stone-500' },
  { value: 'Papelaria e Escritório', label: 'Papelaria e Escritório', icon: Pencil, color: 'bg-gray-600' },
  { value: 'Pet Shop', label: 'Pet Shop', icon: Cat, color: 'bg-teal-600' },
  { value: 'Video Games', label: 'Video Games', icon: Gamepad2, color: 'bg-emerald-500' },
];

// Extrai ASIN do link Amazon e retorna URL da imagem
const getAmazonImageUrl = (url: string): string | null => {
  if (!url) return null;
  
  const patterns = [
    /\/dp\/([A-Z0-9]{10})/i,
    /\/gp\/product\/([A-Z0-9]{10})/i,
    /\/product\/([A-Z0-9]{10})/i,
    /\/ASIN\/([A-Z0-9]{10})/i,
    /amazon\.[^\/]+\/.*?([A-Z0-9]{10})(?:[\/\?]|$)/i
  ];
  
  for (const pattern of patterns) {
    const match = url.match(pattern);
    if (match && match[1]) {
      const asin = match[1];
      return `https://images-na.ssl-images-amazon.com/images/P/${asin}.01._SCLZZZZZZZ_.jpg`;
    }
  }
  
  return null;
};

// Verifica se é uma URL de imagem válida
const isValidImageUrl = (url: string | null): boolean => {
  if (!url) return false;
  const imageExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp', '.svg'];
  const lowerUrl = url.toLowerCase();
  return imageExtensions.some(ext => lowerUrl.includes(ext)) || 
         lowerUrl.includes('images-amazon') ||
         lowerUrl.includes('ssl-images-amazon') ||
         lowerUrl.includes('m.media-amazon') ||
         lowerUrl.includes('supabase.co/storage') ||
         lowerUrl.includes('susercontent.com');
};

// Obtém a melhor URL de imagem para o produto
const getProductImageUrl = (produto: Produto): string | null => {
  if (isValidImageUrl(produto.imagem_url)) {
    return produto.imagem_url;
  }
  
  if (produto.imagem_url?.includes('amazon')) {
    const imageFromUrl = getAmazonImageUrl(produto.imagem_url);
    if (imageFromUrl) return imageFromUrl;
  }
  
  if (produto.link_afiliado?.includes('amazon.com')) {
    const imageFromAfiliado = getAmazonImageUrl(produto.link_afiliado);
    if (imageFromAfiliado) return imageFromAfiliado;
  }
  
  return null;
};

export default function AfiliadoProdutos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [campanhaModalOpen, setCampanhaModalOpen] = useState(false);
  const [produtoSelecionado, setProdutoSelecionado] = useState<Produto | null>(null);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [categoriaFiltro, setCategoriaFiltro] = useState('Todos');
  const [reclassificando, setReclassificando] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    titulo: '',
    imagem_url: '',
    preco: '',
    link_afiliado: '',
    marketplace: 'amazon',
    descricao: '',
    categoria: 'Casa' // Default Amazon
  });

  // Reclassificar produto rapidamente
  const handleReclassificar = async (produtoId: string, novaCategoria: string) => {
    setReclassificando(produtoId);
    try {
      const { error } = await supabase
        .from('afiliado_produtos')
        .update({ categoria: novaCategoria })
        .eq('id', produtoId);
      
      if (error) throw error;
      
      // Atualiza localmente
      setProdutos(prev => prev.map(p => 
        p.id === produtoId ? { ...p, categoria: novaCategoria } : p
      ));
      
      toast.success(`Produto movido para ${novaCategoria}`);
    } catch (error: any) {
      console.error('Erro ao reclassificar:', error);
      toast.error('Erro ao reclassificar produto');
    } finally {
      setReclassificando(null);
    }
  };

  useEffect(() => {
    loadProdutos();
  }, []);

  const loadProdutos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('afiliado_produtos')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setProdutos(data || []);
    } catch (error) {
      console.error('Erro ao carregar produtos:', error);
      toast.error('Erro ao carregar produtos');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      titulo: '',
      imagem_url: '',
      preco: '',
      link_afiliado: '',
      marketplace: 'amazon',
      descricao: '',
      categoria: 'Casa' // Default Amazon
    });
    setEditingId(null);
  };

  const handleEdit = (produto: Produto) => {
    setForm({
      titulo: produto.titulo,
      imagem_url: produto.imagem_url || '',
      preco: produto.preco?.toString() || '',
      link_afiliado: produto.link_afiliado,
      marketplace: produto.marketplace,
      descricao: produto.descricao || '',
      categoria: produto.categoria || 'Casa'
    });
    setEditingId(produto.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo || !form.link_afiliado) {
      toast.error('Preencha título e link de afiliado');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const produtoData = {
        titulo: form.titulo,
        imagem_url: form.imagem_url || null,
        preco: form.preco ? parseFloat(form.preco) : null,
        link_afiliado: form.link_afiliado,
        marketplace: form.marketplace,
        descricao: form.descricao || null,
        categoria: form.categoria || 'Casa',
        user_id: user.id
      };

      if (editingId) {
        const { error } = await supabase
          .from('afiliado_produtos')
          .update(produtoData)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('Produto atualizado');
      } else {
        const { error } = await supabase
          .from('afiliado_produtos')
          .insert(produtoData);
        if (error) throw error;
        toast.success('Produto cadastrado');
      }

      resetForm();
      setDialogOpen(false);
      loadProdutos();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error(error.message || 'Erro ao salvar produto');
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este produto?')) return;

    try {
      const { error } = await supabase
        .from('afiliado_produtos')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('Produto excluído');
      loadProdutos();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      toast.error(error.message || 'Erro ao excluir');
    }
  };

  const handleCriarCampanha = (produto: Produto) => {
    setProdutoSelecionado(produto);
    setCampanhaModalOpen(true);
  };

  const marketplaces = [
    { value: 'amazon', label: 'Amazon' },
    { value: 'mercadolivre', label: 'Mercado Livre' },
    { value: 'shopee', label: 'Shopee' },
    { value: 'magalu', label: 'Magazine Luiza' },
    { value: 'americanas', label: 'Americanas' },
    { value: 'hotmart', label: 'Hotmart' },
    { value: 'outro', label: 'Outro' }
  ];

  // Contagem por categoria
  const contadorCategorias = CATEGORIAS.map(cat => {
    if (cat.value === 'Todos') {
      return { ...cat, count: produtos.length };
    }
    return { ...cat, count: produtos.filter(p => (p.categoria || 'Casa') === cat.value).length };
  });

  // Produtos filtrados
  const produtosFiltrados = categoriaFiltro === 'Todos' 
    ? produtos 
    : produtos.filter(p => (p.categoria || 'Casa') === categoriaFiltro);

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background flex">
      {/* Sidebar de Categorias */}
      <aside className="w-64 bg-card border-r border-border p-4 hidden md:block">
        <div className="flex items-center gap-2 mb-6">
          <Button variant="ghost" size="icon" onClick={() => navigate('/afiliado/dashboard')}>
            <ArrowLeft className="h-5 w-5" />
          </Button>
          <h2 className="font-semibold text-lg">Categorias</h2>
        </div>
        
        <ScrollArea className="h-[calc(100vh-150px)]">
          <div className="space-y-1">
            {contadorCategorias.map((cat) => {
              const Icon = cat.icon;
              const isActive = categoriaFiltro === cat.value;
              return (
                <button
                  key={cat.value}
                  onClick={() => setCategoriaFiltro(cat.value)}
                  className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-left transition-colors ${
                    isActive 
                      ? 'bg-primary text-primary-foreground' 
                      : 'hover:bg-muted text-foreground'
                  }`}
                >
                  <div className={`p-1.5 rounded ${isActive ? 'bg-primary-foreground/20' : cat.color}`}>
                    <Icon className={`h-4 w-4 ${isActive ? '' : 'text-white'}`} />
                  </div>
                  <span className="flex-1 font-medium">{cat.label}</span>
                  <Badge variant={isActive ? "secondary" : "outline"} className="text-xs">
                    {cat.count}
                  </Badge>
                </button>
              );
            })}
          </div>
        </ScrollArea>
      </aside>

      {/* Conteúdo Principal */}
      <main className="flex-1 p-4 md:p-8 overflow-auto">
        <div className="max-w-6xl mx-auto">
          {/* Header */}
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-4">
              <Button variant="ghost" size="icon" onClick={() => navigate('/afiliado/dashboard')} className="md:hidden">
                <ArrowLeft className="h-5 w-5" />
              </Button>
              <div>
                <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
                <p className="text-muted-foreground">
                  {categoriaFiltro === 'Todos' 
                    ? `${produtos.length} produtos` 
                    : `${produtosFiltrados.length} produtos em ${categoriaFiltro}`}
                </p>
              </div>
            </div>
            
            <div className="flex gap-2">
              <Button variant="outline" onClick={() => setImportModalOpen(true)}>
                <Upload className="h-4 w-4 mr-2" />
                <span className="hidden sm:inline">Importar CSV</span>
              </Button>
              <Dialog open={dialogOpen} onOpenChange={(open) => {
                setDialogOpen(open);
                if (!open) resetForm();
              }}>
                <DialogTrigger asChild>
                  <Button>
                    <Plus className="h-4 w-4 mr-2" />
                    <span className="hidden sm:inline">Adicionar</span>
                  </Button>
                </DialogTrigger>
                <DialogContent className="max-w-lg">
                  <DialogHeader>
                    <DialogTitle>{editingId ? 'Editar Produto' : 'Novo Produto'}</DialogTitle>
                  </DialogHeader>
                  <div className="space-y-4">
                    <div>
                      <Label>Título *</Label>
                      <Input 
                        value={form.titulo}
                        onChange={(e) => setForm({...form, titulo: e.target.value})}
                        placeholder="Nome do produto"
                      />
                    </div>
                    <div>
                      <Label>Link de Afiliado *</Label>
                      <Input 
                        value={form.link_afiliado}
                        onChange={(e) => setForm({...form, link_afiliado: e.target.value})}
                        placeholder="https://..."
                      />
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Marketplace</Label>
                        <Select value={form.marketplace} onValueChange={(v) => setForm({...form, marketplace: v})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {marketplaces.map(m => (
                              <SelectItem key={m.value} value={m.value}>{m.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div>
                        <Label>Categoria</Label>
                        <Select value={form.categoria} onValueChange={(v) => setForm({...form, categoria: v})}>
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            {CATEGORIAS.filter(c => c.value !== 'Todos').map(c => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    </div>
                    <div className="grid grid-cols-2 gap-4">
                      <div>
                        <Label>Preço (R$)</Label>
                        <Input 
                          type="number"
                          value={form.preco}
                          onChange={(e) => setForm({...form, preco: e.target.value})}
                          placeholder="0.00"
                        />
                      </div>
                      <div>
                        <Label>URL da Imagem</Label>
                        <Input 
                          value={form.imagem_url}
                          onChange={(e) => setForm({...form, imagem_url: e.target.value})}
                          placeholder="https://..."
                        />
                      </div>
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Textarea 
                        value={form.descricao}
                        onChange={(e) => setForm({...form, descricao: e.target.value})}
                        placeholder="Descrição do produto..."
                        rows={3}
                      />
                    </div>
                    <Button onClick={handleSave} disabled={saving} className="w-full">
                      {saving ? 'Salvando...' : (editingId ? 'Atualizar' : 'Cadastrar')}
                    </Button>
                  </div>
                </DialogContent>
              </Dialog>
            </div>
          </div>

          {/* Mobile: Filtro horizontal */}
          <div className="md:hidden mb-4 overflow-x-auto pb-2">
            <div className="flex gap-2">
              {contadorCategorias.slice(0, 8).map((cat) => {
                const Icon = cat.icon;
                const isActive = categoriaFiltro === cat.value;
                return (
                  <button
                    key={cat.value}
                    onClick={() => setCategoriaFiltro(cat.value)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-full whitespace-nowrap text-sm transition-colors ${
                      isActive 
                        ? 'bg-primary text-primary-foreground' 
                        : 'bg-muted text-foreground'
                    }`}
                  >
                    <Icon className="h-4 w-4" />
                    {cat.label}
                    <span className="text-xs opacity-70">({cat.count})</span>
                  </button>
                );
              })}
            </div>
          </div>

          {produtosFiltrados.length === 0 ? (
            <Card>
              <CardContent className="p-8 text-center">
                <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
                <p className="text-muted-foreground">
                  {categoriaFiltro === 'Todos' 
                    ? 'Nenhum produto cadastrado' 
                    : `Nenhum produto em ${categoriaFiltro}`}
                </p>
                <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar Primeiro Produto
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
              {produtosFiltrados.map((produto) => {
                const catInfo = CATEGORIAS.find(c => c.value === (produto.categoria || 'Outros')) || CATEGORIAS[CATEGORIAS.length - 1];
                const CatIcon = catInfo.icon;
                
                return (
                  <Card key={produto.id} className="overflow-hidden">
                    <CardContent className="p-0">
                      {/* Imagem */}
                      <div className="relative aspect-square bg-muted">
                        {(() => {
                          const imageUrl = getProductImageUrl(produto);
                          return imageUrl ? (
                            <img 
                              src={imageUrl} 
                              alt={produto.titulo}
                              className="w-full h-full object-cover"
                              onError={(e) => {
                                const target = e.target as HTMLImageElement;
                                target.style.display = 'none';
                                const fallback = target.nextElementSibling;
                                if (fallback) fallback.classList.remove('hidden');
                              }}
                            />
                          ) : null;
                        })()}
                        <div className={`w-full h-full flex items-center justify-center ${getProductImageUrl(produto) ? 'hidden' : ''}`}>
                          <Package className="h-16 w-16 text-muted-foreground" />
                        </div>
                        
                        {/* Badge da Categoria */}
                        <div className={`absolute top-2 left-2 ${catInfo.color} text-white px-2 py-1 rounded-full text-xs flex items-center gap-1`}>
                          <CatIcon className="h-3 w-3" />
                          {catInfo.label}
                        </div>
                        
                        <Badge className="absolute top-2 right-2 bg-green-500">
                          Ativo
                        </Badge>
                      </div>

                      {/* Info */}
                      <div className="p-4 space-y-3">
                        <div>
                          <h3 className="font-semibold line-clamp-2">{produto.titulo}</h3>
                          <p className="text-sm text-muted-foreground capitalize">{produto.marketplace}</p>
                        </div>

                        {produto.descricao && (
                          <p className="text-sm text-muted-foreground line-clamp-2">{produto.descricao}</p>
                        )}

                        <div className="flex items-center justify-between">
                          <span className="text-sm text-muted-foreground">Preço:</span>
                          <span className="text-lg font-bold text-green-600">
                            {produto.preco ? `R$ ${produto.preco.toFixed(2)}` : '-'}
                          </span>
                        </div>

                        {/* Dropdown de Reclassificação - só aparece em Outros */}
                        {(produto.categoria === 'Outros' || !produto.categoria) && (
                          <div className="bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-lg p-2">
                            <Label className="text-xs text-yellow-700 dark:text-yellow-400 mb-1 block">
                              📌 Mover para categoria:
                            </Label>
                            <Select 
                              value="" 
                              onValueChange={(v) => handleReclassificar(produto.id, v)}
                              disabled={reclassificando === produto.id}
                            >
                              <SelectTrigger className="h-8 text-sm">
                                <SelectValue placeholder={reclassificando === produto.id ? "Movendo..." : "Selecionar categoria..."} />
                              </SelectTrigger>
                              <SelectContent>
                                {CATEGORIAS.filter(c => c.value !== 'Todos' && c.value !== 'Outros').map(c => {
                                  const CIcon = c.icon;
                                  return (
                                    <SelectItem key={c.value} value={c.value}>
                                      <div className="flex items-center gap-2">
                                        <CIcon className="h-4 w-4" />
                                        {c.label}
                                      </div>
                                    </SelectItem>
                                  );
                                })}
                              </SelectContent>
                            </Select>
                          </div>
                        )}

                        <Button 
                          className="w-full bg-primary"
                          onClick={() => handleCriarCampanha(produto)}
                        >
                          <Megaphone className="h-4 w-4 mr-2" />
                          Criar Campanha
                        </Button>

                        <div className="grid grid-cols-2 gap-2">
                          <Button variant="outline" size="sm" onClick={() => handleEdit(produto)}>
                            <Edit className="h-4 w-4 mr-1" />
                            Editar
                          </Button>
                          <Button variant="outline" size="sm" onClick={() => handleDelete(produto.id)}>
                            <Trash2 className="h-4 w-4 mr-1 text-red-500" />
                            Excluir
                          </Button>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}

          {/* Modal Importar CSV */}
          <ImportCSVAfiliadoModal
            isOpen={importModalOpen}
            onClose={() => setImportModalOpen(false)}
            onSuccess={loadProdutos}
          />

          {/* Modal Criar Campanha */}
          {produtoSelecionado && (
            <CriarCampanhaAfiliadoModal
              open={campanhaModalOpen}
              onOpenChange={(open) => {
                setCampanhaModalOpen(open);
                if (!open) setProdutoSelecionado(null);
              }}
              produto={produtoSelecionado}
            />
          )}
        </div>
      </main>
    </div>
  );
}
