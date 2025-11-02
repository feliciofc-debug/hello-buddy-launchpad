import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Card } from '@/components/ui/card';
import { Plus, Store, Edit, Trash2 } from 'lucide-react';
import { toast } from 'sonner';

interface Loja {
  id: string;
  nome: string;
  descricao: string | null;
  contato: string | null;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
}

export function LojasManager() {
  const [lojas, setLojas] = useState<Loja[]>([]);
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [editingLoja, setEditingLoja] = useState<Loja | null>(null);
  const [formData, setFormData] = useState({
    nome: '',
    descricao: '',
    contato: '',
    email: '',
    telefone: ''
  });

  useEffect(() => {
    fetchLojas();
  }, []);

  const fetchLojas = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('lojas')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar lojas');
      return;
    }

    setLojas(data || []);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingLoja) {
      const { error } = await supabase
        .from('lojas')
        .update(formData)
        .eq('id', editingLoja.id);

      if (error) {
        toast.error('Erro ao atualizar loja');
        return;
      }
      toast.success('Loja atualizada!');
    } else {
      const { error } = await supabase
        .from('lojas')
        .insert([{ ...formData, user_id: user.id }]);

      if (error) {
        toast.error('Erro ao criar loja');
        return;
      }
      toast.success('Loja criada!');
    }

    setIsModalOpen(false);
    resetForm();
    fetchLojas();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir esta loja?')) return;

    const { error } = await supabase
      .from('lojas')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir loja');
      return;
    }

    toast.success('Loja excluída!');
    fetchLojas();
  };

  const openAddModal = () => {
    resetForm();
    setEditingLoja(null);
    setIsModalOpen(true);
  };

  const openEditModal = (loja: Loja) => {
    setFormData({
      nome: loja.nome,
      descricao: loja.descricao || '',
      contato: loja.contato || '',
      email: loja.email || '',
      telefone: loja.telefone || ''
    });
    setEditingLoja(loja);
    setIsModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      descricao: '',
      contato: '',
      email: '',
      telefone: ''
    });
  };

  return (
    <div className="space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-2xl font-bold">Gerenciar Lojas/Clientes</h2>
        <Button onClick={openAddModal}>
          <Plus className="w-4 h-4 mr-2" />
          Nova Loja
        </Button>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
        {lojas.map((loja) => (
          <Card key={loja.id} className="p-4">
            <div className="flex items-start justify-between mb-3">
              <div className="flex items-center gap-2">
                <Store className="w-5 h-5 text-primary" />
                <h3 className="font-semibold">{loja.nome}</h3>
              </div>
              <div className="flex gap-2">
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => openEditModal(loja)}
                >
                  <Edit className="w-4 h-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => handleDelete(loja.id)}
                >
                  <Trash2 className="w-4 h-4 text-destructive" />
                </Button>
              </div>
            </div>
            {loja.descricao && (
              <p className="text-sm text-muted-foreground mb-2">{loja.descricao}</p>
            )}
            {loja.email && (
              <p className="text-sm">Email: {loja.email}</p>
            )}
            {loja.telefone && (
              <p className="text-sm">Tel: {loja.telefone}</p>
            )}
          </Card>
        ))}
      </div>

      <Dialog open={isModalOpen} onOpenChange={setIsModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {editingLoja ? 'Editar Loja' : 'Nova Loja/Cliente'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome da Loja/Cliente *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                required
              />
            </div>
            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={formData.email}
                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="telefone">Telefone</Label>
              <Input
                id="telefone"
                value={formData.telefone}
                onChange={(e) => setFormData({ ...formData, telefone: e.target.value })}
              />
            </div>
            <div>
              <Label htmlFor="contato">Pessoa de Contato</Label>
              <Input
                id="contato"
                value={formData.contato}
                onChange={(e) => setFormData({ ...formData, contato: e.target.value })}
              />
            </div>
            <div className="flex gap-2">
              <Button type="submit" className="flex-1">
                {editingLoja ? 'Atualizar' : 'Criar'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsModalOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
