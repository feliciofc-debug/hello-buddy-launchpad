import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Badge } from '@/components/ui/badge';
import { Plus, Users, Edit, Trash2, Package } from 'lucide-react';
import { toast } from 'sonner';

interface Cliente {
  id: string;
  nome: string;
  tipo_negocio: string | null;
  logo_url: string | null;
  cor_marca: string | null;
  instagram: string | null;
  facebook: string | null;
  descricao: string | null;
  contato: string | null;
  email: string | null;
  telefone: string | null;
  ativo: boolean;
  created_at: string;
}

interface ClientesManagerProps {
  isOpen: boolean;
  onClose: () => void;
  onClienteSelect?: (clienteId: string) => void;
}

export function ClientesManager({ isOpen, onClose, onClienteSelect }: ClientesManagerProps) {
  const [clientes, setClientes] = useState<Cliente[]>([]);
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [editingCliente, setEditingCliente] = useState<Cliente | null>(null);
  const [produtosCounts, setProdutosCounts] = useState<Record<string, number>>({});
  const [formData, setFormData] = useState({
    nome: '',
    tipo_negocio: '',
    logo_url: '',
    cor_marca: '#000000',
    instagram: '',
    facebook: '',
    descricao: '',
    contato: '',
    email: '',
    telefone: ''
  });

  useEffect(() => {
    if (isOpen) {
      fetchClientes();
    }
  }, [isOpen]);

  const fetchClientes = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    const { data, error } = await supabase
      .from('clientes')
      .select('*')
      .eq('user_id', user.id)
      .order('created_at', { ascending: false });

    if (error) {
      toast.error('Erro ao carregar clientes');
      return;
    }

    setClientes(data || []);
    
    // Fetch produtos count for each cliente
    if (data) {
      const counts: Record<string, number> = {};
      for (const cliente of data) {
        const { count } = await supabase
          .from('produtos')
          .select('*', { count: 'exact', head: true })
          .eq('cliente_id', cliente.id);
        counts[cliente.id] = count || 0;
      }
      setProdutosCounts(counts);
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;

    if (editingCliente) {
      const { error } = await supabase
        .from('clientes')
        .update(formData)
        .eq('id', editingCliente.id);

      if (error) {
        toast.error('Erro ao atualizar cliente');
        return;
      }
      toast.success('Cliente atualizado!');
    } else {
      const { error } = await supabase
        .from('clientes')
        .insert([{ ...formData, user_id: user.id }]);

      if (error) {
        toast.error('Erro ao criar cliente');
        return;
      }
      toast.success('Cliente criado!');
    }

    setIsAddModalOpen(false);
    resetForm();
    fetchClientes();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Tem certeza que deseja excluir este cliente? Os produtos associados não serão excluídos.')) return;

    const { error } = await supabase
      .from('clientes')
      .delete()
      .eq('id', id);

    if (error) {
      toast.error('Erro ao excluir cliente');
      return;
    }

    toast.success('Cliente excluído!');
    fetchClientes();
  };

  const openAddModal = () => {
    resetForm();
    setEditingCliente(null);
    setIsAddModalOpen(true);
  };

  const openEditModal = (cliente: Cliente) => {
    setFormData({
      nome: cliente.nome,
      tipo_negocio: cliente.tipo_negocio || '',
      logo_url: cliente.logo_url || '',
      cor_marca: cliente.cor_marca || '#000000',
      instagram: cliente.instagram || '',
      facebook: cliente.facebook || '',
      descricao: cliente.descricao || '',
      contato: cliente.contato || '',
      email: cliente.email || '',
      telefone: cliente.telefone || ''
    });
    setEditingCliente(cliente);
    setIsAddModalOpen(true);
  };

  const resetForm = () => {
    setFormData({
      nome: '',
      tipo_negocio: '',
      logo_url: '',
      cor_marca: '#000000',
      instagram: '',
      facebook: '',
      descricao: '',
      contato: '',
      email: '',
      telefone: ''
    });
  };

  return (
    <>
      <Dialog open={isOpen} onOpenChange={onClose}>
        <DialogContent className="max-w-4xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2">
                <Users className="w-5 h-5" />
                👥 Meus Clientes
              </DialogTitle>
              <Button onClick={openAddModal} size="sm">
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Cliente
              </Button>
            </div>
          </DialogHeader>

          {clientes.length === 0 ? (
            <div className="text-center py-12">
              <Users className="w-16 h-16 mx-auto mb-4 text-muted-foreground" />
              <p className="text-muted-foreground mb-4">
                Você ainda não cadastrou nenhum cliente.
              </p>
              <p className="text-sm text-muted-foreground mb-6">
                Adicione seu primeiro cliente para gerenciar produtos e campanhas.
              </p>
              <Button onClick={openAddModal}>
                <Plus className="w-4 h-4 mr-2" />
                Adicionar Primeiro Cliente
              </Button>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {clientes.map((cliente) => (
                <Card key={cliente.id}>
                  <CardContent className="p-4">
                    <div className="flex items-start gap-4">
                      <Avatar className="w-12 h-12">
                        <AvatarImage src={cliente.logo_url || ''} alt={cliente.nome} />
                        <AvatarFallback style={{ backgroundColor: cliente.cor_marca || '#gray' }}>
                          {cliente.nome.substring(0, 2).toUpperCase()}
                        </AvatarFallback>
                      </Avatar>
                      <div className="flex-1 min-w-0">
                        <h3 className="font-semibold truncate">{cliente.nome}</h3>
                        {cliente.tipo_negocio && (
                          <p className="text-sm text-muted-foreground">{cliente.tipo_negocio}</p>
                        )}
                        <div className="flex items-center gap-2 mt-2">
                          <Badge variant="outline" className="flex items-center gap-1">
                            <Package className="w-3 h-3" />
                            {produtosCounts[cliente.id] || 0} produtos
                          </Badge>
                        </div>
                      </div>
                      <div className="flex gap-1">
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => openEditModal(cliente)}
                        >
                          <Edit className="w-4 h-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDelete(cliente.id)}
                        >
                          <Trash2 className="w-4 h-4 text-destructive" />
                        </Button>
                      </div>
                    </div>
                    {cliente.descricao && (
                      <p className="text-sm text-muted-foreground mt-2 line-clamp-2">
                        {cliente.descricao}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* Modal Adicionar/Editar Cliente */}
      <Dialog open={isAddModalOpen} onOpenChange={setIsAddModalOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {editingCliente ? '✏️ Editar Cliente' : '➕ Adicionar Cliente'}
            </DialogTitle>
          </DialogHeader>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <Label htmlFor="nome">Nome do Cliente/Empresa *</Label>
              <Input
                id="nome"
                value={formData.nome}
                onChange={(e) => setFormData({ ...formData, nome: e.target.value })}
                placeholder="Ex: Padaria do João"
                required
              />
            </div>

            <div>
              <Label htmlFor="tipo_negocio">Tipo de Negócio</Label>
              <Select 
                value={formData.tipo_negocio} 
                onValueChange={(v) => setFormData({ ...formData, tipo_negocio: v })}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Selecione..." />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="alimentacao">🍽️ Alimentação</SelectItem>
                  <SelectItem value="moda">👕 Moda e Vestuário</SelectItem>
                  <SelectItem value="beleza">💄 Beleza e Estética</SelectItem>
                  <SelectItem value="servicos">🛠️ Serviços</SelectItem>
                  <SelectItem value="varejo">🏪 Varejo/Comércio</SelectItem>
                  <SelectItem value="tecnologia">💻 Tecnologia</SelectItem>
                  <SelectItem value="saude">🏥 Saúde e Bem-estar</SelectItem>
                  <SelectItem value="outros">📦 Outros</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div>
              <Label htmlFor="descricao">Descrição</Label>
              <Textarea
                id="descricao"
                value={formData.descricao}
                onChange={(e) => setFormData({ ...formData, descricao: e.target.value })}
                placeholder="Breve descrição do negócio do cliente..."
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="logo_url">URL da Logo (opcional)</Label>
                <Input
                  id="logo_url"
                  type="url"
                  value={formData.logo_url}
                  onChange={(e) => setFormData({ ...formData, logo_url: e.target.value })}
                  placeholder="https://..."
                />
              </div>

              <div>
                <Label htmlFor="cor_marca">Cor da Marca</Label>
                <Input
                  id="cor_marca"
                  type="color"
                  value={formData.cor_marca}
                  onChange={(e) => setFormData({ ...formData, cor_marca: e.target.value })}
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="instagram">Instagram</Label>
                <Input
                  id="instagram"
                  value={formData.instagram}
                  onChange={(e) => setFormData({ ...formData, instagram: e.target.value })}
                  placeholder="@padaria_joao"
                />
              </div>

              <div>
                <Label htmlFor="facebook">Facebook</Label>
                <Input
                  id="facebook"
                  value={formData.facebook}
                  onChange={(e) => setFormData({ ...formData, facebook: e.target.value })}
                  placeholder="facebook.com/padariajoao"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
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
                {editingCliente ? 'Atualizar' : 'Criar Cliente'}
              </Button>
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddModalOpen(false)}
              >
                Cancelar
              </Button>
            </div>
          </form>
        </DialogContent>
      </Dialog>
    </>
  );
}
