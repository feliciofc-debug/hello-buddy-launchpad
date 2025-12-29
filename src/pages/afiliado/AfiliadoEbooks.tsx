import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Switch } from "@/components/ui/switch";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { ArrowLeft, Plus, BookOpen, Trash2, Edit, ExternalLink, Eye, EyeOff } from "lucide-react";
import { toast } from "sonner";

interface Ebook {
  id: string;
  titulo: string;
  arquivo_url: string;
  descricao: string | null;
  ativo: boolean;
}

export default function AfiliadoEbooks() {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [ebooks, setEbooks] = useState<Ebook[]>([]);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  
  const [form, setForm] = useState({
    titulo: '',
    arquivo_url: '',
    descricao: '',
    ativo: true
  });

  useEffect(() => {
    loadEbooks();
  }, []);

  const loadEbooks = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) {
        navigate('/login');
        return;
      }

      const { data, error } = await supabase
        .from('afiliado_ebooks')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;
      setEbooks(data || []);
    } catch (error) {
      console.error('Erro ao carregar ebooks:', error);
      toast.error('Erro ao carregar e-books');
    } finally {
      setLoading(false);
    }
  };

  const resetForm = () => {
    setForm({
      titulo: '',
      arquivo_url: '',
      descricao: '',
      ativo: true
    });
    setEditingId(null);
  };

  const handleEdit = (ebook: Ebook) => {
    setForm({
      titulo: ebook.titulo,
      arquivo_url: ebook.arquivo_url,
      descricao: ebook.descricao || '',
      ativo: ebook.ativo
    });
    setEditingId(ebook.id);
    setDialogOpen(true);
  };

  const handleSave = async () => {
    if (!form.titulo || !form.arquivo_url) {
      toast.error('Preencha título e URL do arquivo');
      return;
    }

    setSaving(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Não autenticado');

      const ebookData = {
        titulo: form.titulo,
        arquivo_url: form.arquivo_url,
        descricao: form.descricao || null,
        ativo: form.ativo,
        user_id: user.id
      };

      if (editingId) {
        const { error } = await supabase
          .from('afiliado_ebooks')
          .update(ebookData)
          .eq('id', editingId);
        if (error) throw error;
        toast.success('E-book atualizado');
      } else {
        const { error } = await supabase
          .from('afiliado_ebooks')
          .insert(ebookData);
        if (error) throw error;
        toast.success('E-book cadastrado');
      }

      resetForm();
      setDialogOpen(false);
      loadEbooks();
    } catch (error: any) {
      console.error('Erro ao salvar:', error);
      toast.error(error.message || 'Erro ao salvar e-book');
    } finally {
      setSaving(false);
    }
  };

  const handleToggleAtivo = async (ebook: Ebook) => {
    try {
      const { error } = await supabase
        .from('afiliado_ebooks')
        .update({ ativo: !ebook.ativo })
        .eq('id', ebook.id);
      
      if (error) throw error;
      toast.success(ebook.ativo ? 'E-book desativado' : 'E-book ativado');
      loadEbooks();
    } catch (error: any) {
      console.error('Erro:', error);
      toast.error(error.message || 'Erro ao atualizar');
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Excluir este e-book?')) return;

    try {
      const { error } = await supabase
        .from('afiliado_ebooks')
        .delete()
        .eq('id', id);
      
      if (error) throw error;
      toast.success('E-book excluído');
      loadEbooks();
    } catch (error: any) {
      console.error('Erro ao excluir:', error);
      toast.error(error.message || 'Erro ao excluir');
    }
  };

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
              <h1 className="text-2xl font-bold text-foreground">E-books</h1>
              <p className="text-muted-foreground">Gerencie seus materiais de apoio</p>
            </div>
          </div>
          
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
            <DialogContent>
              <DialogHeader>
                <DialogTitle>{editingId ? 'Editar E-book' : 'Novo E-book'}</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label>Título *</Label>
                  <Input 
                    value={form.titulo}
                    onChange={(e) => setForm({...form, titulo: e.target.value})}
                    placeholder="Nome do e-book"
                  />
                </div>
                <div>
                  <Label>URL do Arquivo *</Label>
                  <Input 
                    value={form.arquivo_url}
                    onChange={(e) => setForm({...form, arquivo_url: e.target.value})}
                    placeholder="https://drive.google.com/..."
                  />
                  <p className="text-xs text-muted-foreground mt-1">
                    Link do Google Drive, Dropbox ou outro serviço
                  </p>
                </div>
                <div>
                  <Label>Descrição</Label>
                  <Textarea 
                    value={form.descricao}
                    onChange={(e) => setForm({...form, descricao: e.target.value})}
                    placeholder="Descrição do e-book..."
                    rows={3}
                  />
                </div>
                <div className="flex items-center justify-between">
                  <Label>Ativo</Label>
                  <Switch 
                    checked={form.ativo}
                    onCheckedChange={(checked) => setForm({...form, ativo: checked})}
                  />
                </div>
                <Button onClick={handleSave} disabled={saving} className="w-full">
                  {saving ? 'Salvando...' : (editingId ? 'Atualizar' : 'Cadastrar')}
                </Button>
              </div>
            </DialogContent>
          </Dialog>
        </div>

        {/* Lista de Ebooks */}
        {ebooks.length === 0 ? (
          <Card>
            <CardContent className="p-8 text-center">
              <BookOpen className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <p className="text-muted-foreground">Nenhum e-book cadastrado</p>
              <Button className="mt-4" onClick={() => setDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                Adicionar Primeiro E-book
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4">
            {ebooks.map((ebook) => (
              <Card key={ebook.id} className={!ebook.ativo ? 'opacity-60' : ''}>
                <CardContent className="p-4">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className="p-2 bg-pink-100 dark:bg-pink-900/30 rounded-lg">
                        <BookOpen className="h-5 w-5 text-pink-500" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <h3 className="font-semibold">{ebook.titulo}</h3>
                          {!ebook.ativo && (
                            <span className="text-xs bg-muted px-2 py-0.5 rounded">Inativo</span>
                          )}
                        </div>
                        {ebook.descricao && (
                          <p className="text-sm text-muted-foreground mt-1">{ebook.descricao}</p>
                        )}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <Button 
                        variant="ghost" 
                        size="icon" 
                        onClick={() => handleToggleAtivo(ebook)}
                        title={ebook.ativo ? 'Desativar' : 'Ativar'}
                      >
                        {ebook.ativo ? <Eye className="h-4 w-4" /> : <EyeOff className="h-4 w-4" />}
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleEdit(ebook)}>
                        <Edit className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => window.open(ebook.arquivo_url, '_blank')}>
                        <ExternalLink className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" onClick={() => handleDelete(ebook.id)}>
                        <Trash2 className="h-4 w-4 text-red-500" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
