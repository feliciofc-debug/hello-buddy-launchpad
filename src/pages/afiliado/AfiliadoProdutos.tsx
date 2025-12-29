import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, Package, Trash2, Edit, ExternalLink, Upload } from "lucide-react";
import { toast } from "sonner";
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
}

export default function AfiliadoProdutos() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [produtos, setProdutos] = useState<Produto[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [importModalOpen, setImportModalOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    titulo: '',
    imagem_url: '',
    preco: '',
    link_afiliado: '',
    marketplace: 'amazon',
    descricao: ''
  });

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
      descricao: ''
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
      descricao: produto.descricao || ''
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

  const marketplaces = [
    { value: 'amazon', label: 'Amazon' },
    { value: 'mercadolivre', label: 'Mercado Livre' },
    { value: 'shopee', label: 'Shopee' },
    { value: 'magalu', label: 'Magazine Luiza' },
    { value: 'americanas', label: 'Americanas' },
    { value: 'hotmart', label: 'Hotmart' },
    { value: 'outro', label: 'Outro' }
  ];

  if (loading) {
    return (
      <div className="min-h-screen bg-background flex items-center justify-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background p-4 md:p-8">
      <div className="max-w-4xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-4">
            <Button variant="ghost" size="icon" onClick={() => navigate('/afiliado/dashboard')}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold text-foreground">Produtos</h1>
              <p className="text-muted-foreground">Gerencie seus produtos de afiliado</p>
            </div>
          </div>
          
          <div className="flex gap-2">
            <Button variant="outline" onClick={() => setImportModalOpen(true)}>
              <Upload className="h-4 w-4 mr-2" />
              Importar CSV
            </Button>
            <Dialog open={dialogOpen} onOpenChange={(open) => {
              setDialogOpen(open);
              if (!open) resetForm();
            }}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Adicionar
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
                    <Label>Preço (R$)</Label>
                    <Input 
                      type="number"
                      value={form.preco}
                      onChange={(e) => setForm({...form, preco: e.target.value})}
                      placeholder="0.00"
                    />
                  </div>
                </div>
                <div>
                  <Label>URL da Imagem</Label>
                  <Input 
                    value={form.imagem_url}
                    onChange={(e) => setForm({...form, imagem_url: e.target.value})}
                    placeholder="https://..."
                  />
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
        {produtos.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <Package className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum produto cadastrado</p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro Produto
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {produtos.map((produto) => (
              <Card key={produto.id}>
                <CardContent className="p-4">
                  <div className="flex gap-4">
                    {produto.imagem_url && (
                      <img 
                        src={produto.imagem_url} 
                        alt={produto.titulo}
                        className="w-20 h-20 object-cover rounded-lg"
                      />
                    )}
                    <div className="flex-1">
                      <div className="flex items-start justify-between">
                        <div>
                          <h3 className="font-semibold">{produto.titulo}</h3>
                          <p className="text-sm text-muted-foreground capitalize">{produto.marketplace}</p>
                          {produto.preco && (
                            <p className="text-lg font-bold text-green-500 mt-1">
                              R$ {produto.preco.toFixed(2)}
                            </p>
                          )}
                        </div>
                        <div className="flex gap-2">
                          <Button variant="ghost" size="icon" onClick={() => handleEdit(produto)}>
                            <Edit className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => window.open(produto.link_afiliado, '_blank')}>
                            <ExternalLink className="h-4 w-4" />
                          </Button>
                          <Button variant="ghost" size="icon" onClick={() => handleDelete(produto.id)}>
                            <Trash2 className="h-4 w-4 text-red-500" />
                          </Button>
                        </div>
                      </div>
                      {produto.descricao && (
                        <p className="text-sm text-muted-foreground mt-2 line-clamp-2">{produto.descricao}</p>
                      )}
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal Importar CSV */}
        <ImportCSVAfiliadoModal
          isOpen={importModalOpen}
          onClose={() => setImportModalOpen(false)}
          onSuccess={loadProdutos}
        />
      </div>
    </div>
  );
}
