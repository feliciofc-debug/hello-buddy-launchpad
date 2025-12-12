import { useState, useEffect } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2, Plus, Search, Edit2, Users, CheckCircle, RefreshCw } from 'lucide-react';
import { toast } from 'sonner';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

interface GrupoTransmissao {
  id: string;
  group_name: string;
}

interface Contact {
  id: string;
  nome: string;
  phone: string;
  notes?: string;
  tags?: string[];
}

interface Props {
  selectedContacts: string[];
  onContactsChange: (contacts: string[]) => void;
  reloadTrigger?: number;
}

export default function WhatsAppContactManager({ 
  selectedContacts, 
  onContactsChange,
  reloadTrigger 
}: Props) {
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [grupos, setGrupos] = useState<GrupoTransmissao[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState('');
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);
  const [isGroupDialogOpen, setIsGroupDialogOpen] = useState(false);
  const [syncingOptIn, setSyncingOptIn] = useState(false);
  const [selectedContactForGroup, setSelectedContactForGroup] = useState<Contact | null>(null);
  
  const [newContact, setNewContact] = useState({
    name: '',
    phone: '',
    notes: ''
  });

  const [editingContact, setEditingContact] = useState<Contact | null>(null);

  useEffect(() => {
    loadContacts();
    loadGrupos();
  }, []);

  // Reload quando o trigger mudar, mas mantém seleção
  useEffect(() => {
    if (reloadTrigger && reloadTrigger > 0) {
      loadContacts();
    }
  }, [reloadTrigger]);

  const loadContacts = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_contacts')
        .select('*')
        .eq('user_id', user.id)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setContacts(data || []);
    } catch (error) {
      console.error('Erro ao carregar contatos:', error);
      toast.error('Erro ao carregar contatos');
    } finally {
      setLoading(false);
    }
  };

  const loadGrupos = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from('whatsapp_groups')
        .select('id, group_name')
        .eq('user_id', user.id)
        .order('group_name');

      if (error) throw error;
      setGrupos(data || []);
    } catch (error) {
      console.error('Erro ao carregar grupos:', error);
    }
  };

  const handleAddToGroup = async (grupoId: string) => {
    if (!selectedContactForGroup) return;

    try {
      // Buscar grupo atual
      const { data: grupo, error: findError } = await supabase
        .from('whatsapp_groups')
        .select('phone_numbers')
        .eq('id', grupoId)
        .single();

      if (findError) throw findError;

      const currentNumbers = grupo?.phone_numbers || [];
      const phoneToAdd = selectedContactForGroup.phone;

      // Verificar se já está no grupo
      if (currentNumbers.includes(phoneToAdd)) {
        toast.info('Contato já está neste grupo');
        setIsGroupDialogOpen(false);
        setSelectedContactForGroup(null);
        return;
      }

      // Adicionar ao grupo
      const { error: updateError } = await supabase
        .from('whatsapp_groups')
        .update({
          phone_numbers: [...currentNumbers, phoneToAdd],
          member_count: currentNumbers.length + 1
        })
        .eq('id', grupoId);

      if (updateError) throw updateError;

      toast.success('✅ Contato adicionado ao grupo!');
      setIsGroupDialogOpen(false);
      setSelectedContactForGroup(null);
    } catch (error) {
      console.error('Erro ao adicionar ao grupo:', error);
      toast.error('Erro ao adicionar ao grupo');
    }
  };

  const handleAddContact = async () => {
    if (!newContact.name.trim() || !newContact.phone.trim()) {
      toast.error('Preencha nome e telefone');
      return;
    }

    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from('whatsapp_contacts')
        .insert({
          user_id: user.id,
          nome: newContact.name.trim(),
          phone: newContact.phone.trim().replace(/\D/g, ''),
          notes: newContact.notes.trim() || null
        });

      if (error) {
        if (error.code === '23505') {
          toast.error('Este número já está cadastrado');
          return;
        }
        throw error;
      }

      toast.success('✅ Contato adicionado!');
      setNewContact({ name: '', phone: '', notes: '' });
      setIsAddDialogOpen(false);
      loadContacts();

    } catch (error) {
      console.error('Erro ao adicionar contato:', error);
      toast.error('Erro ao adicionar contato');
    }
  };

  const handleDeleteContact = async (contactId: string) => {
    if (!confirm('Tem certeza que deseja excluir este contato?')) return;

    try {
      const { error } = await supabase
        .from('whatsapp_contacts')
        .delete()
        .eq('id', contactId);

      if (error) throw error;

      toast.success('🗑️ Contato excluído');
      loadContacts();

      const deletedContact = contacts.find(c => c.id === contactId);
      if (deletedContact && selectedContacts.includes(deletedContact.phone)) {
        onContactsChange(selectedContacts.filter(p => p !== deletedContact.phone));
      }

    } catch (error) {
      console.error('Erro ao excluir contato:', error);
      toast.error('Erro ao excluir contato');
    }
  };

  const handleDeleteSelected = async () => {
    const selectedContactIds = contacts
      .filter(c => selectedContacts.includes(c.phone))
      .map(c => c.id);

    if (selectedContactIds.length === 0) {
      toast.error('Selecione contatos para excluir');
      return;
    }

    if (!confirm(`Excluir ${selectedContactIds.length} contatos?`)) return;

    try {
      const { error } = await supabase
        .from('whatsapp_contacts')
        .delete()
        .in('id', selectedContactIds);

      if (error) throw error;

      toast.success(`🗑️ ${selectedContactIds.length} contatos excluídos`);
      loadContacts();
      onContactsChange([]);

    } catch (error) {
      console.error('Erro ao excluir contatos:', error);
      toast.error('Erro ao excluir contatos');
    }
  };

  const handleEditContact = (contact: Contact) => {
    setEditingContact(contact);
    setIsEditDialogOpen(true);
  };

  const handleUpdateContact = async () => {
    if (!editingContact || !editingContact.nome.trim()) {
      toast.error('Preencha o nome do contato');
      return;
    }

    try {
      const { error } = await supabase
        .from('whatsapp_contacts')
        .update({
          nome: editingContact.nome.trim(),
          notes: editingContact.notes?.trim() || null
        })
        .eq('id', editingContact.id);

      if (error) throw error;

      toast.success('✅ Contato atualizado!');
      setIsEditDialogOpen(false);
      setEditingContact(null);
      loadContacts();

    } catch (error) {
      console.error('Erro ao atualizar contato:', error);
      toast.error('Erro ao atualizar contato');
    }
  };

  const toggleContact = (phone: string) => {
    const newSelected = selectedContacts.includes(phone)
      ? selectedContacts.filter(p => p !== phone)
      : [...selectedContacts, phone];
    onContactsChange(newSelected);
  };

  const selectAll = () => {
    if (selectedContacts.length === filteredContacts.length) {
      onContactsChange([]);
    } else {
      onContactsChange(filteredContacts.map(c => c.phone));
    }
  };

  // Sincronizar contatos para opt-in (cadastros)
  const syncToOptIn = async () => {
    if (contacts.length === 0) {
      toast.error('Nenhum contato para sincronizar');
      return;
    }

    setSyncingOptIn(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) throw new Error('Usuário não autenticado');

      // Buscar instância Wuzapi ativa do usuário para pegar o número de envio
      const { data: instancia } = await supabase
        .from('wuzapi_instances')
        .select('phone_number, instance_name')
        .eq('assigned_to_user', user.id)
        .maybeSingle();

      const numeroEnvio = instancia?.phone_number || '5521995379550'; // fallback para número AMZ
      const origemSync = `sync_whatsapp_${numeroEnvio}`;

      let sincronizados = 0;
      let atualizados = 0;

      for (const contact of contacts) {
        // Verificar se já existe em cadastros
        const { data: existing } = await supabase
          .from('cadastros')
          .select('id')
          .eq('whatsapp', contact.phone)
          .eq('user_id', user.id)
          .maybeSingle();

        if (existing) {
          // Atualizar para opt_in = true
          await supabase
            .from('cadastros')
            .update({ 
              opt_in: true, 
              origem: origemSync,
              updated_at: new Date().toISOString() 
            })
            .eq('id', existing.id);
          atualizados++;
        } else {
          // Criar novo cadastro com opt_in = true
          await supabase
            .from('cadastros')
            .insert({
              user_id: user.id,
              nome: contact.nome,
              whatsapp: contact.phone,
              opt_in: true,
              origem: origemSync
            });
          sincronizados++;
        }
      }

      toast.success(`✅ Sincronizado! ${sincronizados} novos, ${atualizados} atualizados (via ${numeroEnvio})`);
    } catch (error: any) {
      console.error('Erro ao sincronizar:', error);
      toast.error('Erro ao sincronizar: ' + error.message);
    } finally {
      setSyncingOptIn(false);
    }
  };

  const filteredContacts = contacts.filter(contact =>
    contact.nome.toLowerCase().includes(search.toLowerCase()) ||
    contact.phone.includes(search.replace(/\D/g, ''))
  );

  if (loading) {
    return <div className="text-center py-4">Carregando contatos...</div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-lg font-semibold">
          📞 Seus Contatos ({contacts.length})
        </h3>
        <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
          <DialogTrigger asChild>
            <Button size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Novo Contato
            </Button>
          </DialogTrigger>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Adicionar Contato</DialogTitle>
            </DialogHeader>
            <div className="space-y-4">
              <div>
                <Label>Nome *</Label>
                <Input
                  placeholder="Ex: Maria Silva"
                  value={newContact.name}
                  onChange={(e) => setNewContact({ ...newContact, name: e.target.value })}
                />
              </div>
              <div>
                <Label>Telefone * (com DDD)</Label>
                <Input
                  placeholder="Ex: 5521999998888"
                  value={newContact.phone}
                  onChange={(e) => setNewContact({ ...newContact, phone: e.target.value })}
                />
              </div>
              <div>
                <Label>Observações (opcional)</Label>
                <Input
                  placeholder="Ex: Cliente VIP"
                  value={newContact.notes}
                  onChange={(e) => setNewContact({ ...newContact, notes: e.target.value })}
                />
              </div>
              <Button onClick={handleAddContact} className="w-full">
                Adicionar Contato
              </Button>
            </div>
          </DialogContent>
        </Dialog>
      </div>

      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>✏️ Editar Contato</DialogTitle>
          </DialogHeader>
          {editingContact && (
            <div className="space-y-4">
              <div>
                <Label>Telefone (não editável)</Label>
                <Input
                  value={editingContact.phone}
                  disabled
                  className="bg-muted"
                />
              </div>
              <div>
                <Label>Nome *</Label>
                <Input
                  placeholder="Ex: Maria Silva"
                  value={editingContact.nome}
                  onChange={(e) => setEditingContact({ 
                    ...editingContact, 
                    nome: e.target.value 
                  })}
                />
              </div>
              <div>
                <Label>Observações (opcional)</Label>
                <Input
                  placeholder="Ex: Cliente VIP"
                  value={editingContact.notes || ''}
                  onChange={(e) => setEditingContact({ 
                    ...editingContact, 
                    notes: e.target.value 
                  })}
                />
              </div>
              <Button onClick={handleUpdateContact} className="w-full">
                💾 Salvar Alterações
              </Button>
            </div>
          )}
        </DialogContent>
      </Dialog>

      <div className="relative">
        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="🔍 Buscar contato..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="pl-10"
        />
      </div>

      <div className="border rounded-lg divide-y max-h-96 overflow-y-auto">
        {filteredContacts.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            {search ? 'Nenhum contato encontrado' : 'Nenhum contato cadastrado'}
          </div>
        ) : (
          filteredContacts.map(contact => {
            const isSelected = selectedContacts.includes(contact.phone);
            return (
              <div
                key={contact.id}
                className="flex items-center gap-3 p-3 hover:bg-muted/50 transition-colors"
              >
                <Checkbox
                  checked={isSelected}
                  onCheckedChange={() => toggleContact(contact.phone)}
                  className="flex-shrink-0"
                />

                {/* INFO DO CONTATO */}
                <div className="flex-1 min-w-0">
                  <p className="font-medium truncate">{contact.nome}</p>
                  <p className="text-sm text-muted-foreground">{contact.phone}</p>
                  {contact.notes && (
                    <p className="text-xs text-muted-foreground italic">{contact.notes}</p>
                  )}
                </div>

                {/* BOTÕES DE AÇÃO */}
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleEditContact(contact);
                  }}
                  className="text-blue-600 hover:text-blue-700 flex-shrink-0"
                  title="Editar contato"
                >
                  <Edit2 className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    setSelectedContactForGroup(contact);
                    setIsGroupDialogOpen(true);
                  }}
                  className="text-green-600 hover:text-green-700 flex-shrink-0"
                  title="Adicionar a grupo"
                >
                  <Users className="h-4 w-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={(e) => {
                    e.stopPropagation();
                    handleDeleteContact(contact.id);
                  }}
                  className="text-destructive hover:text-destructive flex-shrink-0"
                  title="Excluir contato"
                >
                  <Trash2 className="h-4 w-4" />
                </Button>
              </div>
            );
          })
        )}
      </div>

      {contacts.length > 0 && (
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Button
              variant="outline"
              onClick={selectAll}
              className="flex-1"
            >
              {selectedContacts.length === filteredContacts.length
                ? '☐ Desmarcar Todos'
                : '✅ Selecionar Todos'}
            </Button>
            <Button
              variant="destructive"
              onClick={handleDeleteSelected}
              disabled={selectedContacts.length === 0}
            >
              <Trash2 className="h-4 w-4 mr-2" />
              Excluir ({selectedContacts.length})
            </Button>
          </div>
          
          {/* Botão principal de Sync para Opt-in */}
          <Button
            onClick={syncToOptIn}
            disabled={syncingOptIn || contacts.length === 0}
            className="w-full bg-green-600 hover:bg-green-700"
          >
            {syncingOptIn ? (
              <RefreshCw className="h-4 w-4 mr-2 animate-spin" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            🔄 Sincronizar TODOS ({contacts.length}) para Opt-in
          </Button>
        </div>
      )}

      {/* Dialog para selecionar grupo */}
      <Dialog open={isGroupDialogOpen} onOpenChange={setIsGroupDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>👥 Adicionar a Grupo</DialogTitle>
          </DialogHeader>
          {selectedContactForGroup && (
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Adicionar <strong>{selectedContactForGroup.nome}</strong> a qual grupo?
              </p>
              
              {grupos.length === 0 ? (
                <div className="text-center py-4 text-muted-foreground">
                  <p>Nenhum grupo criado ainda.</p>
                  <p className="text-xs mt-2">Vá em "Grupos de Transmissão" para criar um grupo.</p>
                </div>
              ) : (
                <div className="space-y-2 max-h-60 overflow-y-auto">
                  {grupos.map(grupo => (
                    <Button
                      key={grupo.id}
                      variant="outline"
                      className="w-full justify-start"
                      onClick={() => handleAddToGroup(grupo.id)}
                    >
                      <Users className="w-4 h-4 mr-2 text-primary" />
                      {grupo.group_name}
                    </Button>
                  ))}
                </div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
