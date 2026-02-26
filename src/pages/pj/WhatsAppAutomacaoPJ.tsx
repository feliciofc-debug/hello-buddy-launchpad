"use client";

import { useState, useEffect, useCallback, useMemo } from 'react';
import { ArrowLeft, Smartphone, Users, Trash2, Eye, EyeOff, Link2, Plus, Search, ChevronDown, ChevronUp, Calendar, Pencil, UserPlus, UserMinus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Link } from 'react-router-dom';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Label } from '@/components/ui/label';
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from '@/components/ui/collapsible';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ptBR } from 'date-fns/locale';

import WhatsAppConnectionPJ from '@/components/pj/WhatsAppConnectionPJ';
import EnviosProgramadosPJ from '@/components/pj/EnviosProgramadosPJ';
import ImportContatosPJ from '@/components/pj/ImportContatosPJ';
import CriarGrupoWhatsAppPJ from '@/components/pj/CriarGrupoWhatsAppPJ';
import { Textarea } from '@/components/ui/textarea';
import { Loader2 } from 'lucide-react';

// ─── Types ────────────────────────────────────────────
interface Lista {
  id: string;
  nome: string;
  total_membros: number | null;
  created_at: string | null;
}
interface Membro {
  id: string;
  nome: string | null;
  telefone: string | null;
}
interface Grupo {
  id: string;
  nome: string;
  participantes_count: number | null;
  created_at: string | null;
  invite_link: string | null;
}
interface Contato {
  id: string;
  nome: string | null;
  telefone: string | null;
}

// ─── Contatos Tab ─────────────────────────────────────
function ContatosTab() {
  const [userId, setUserId] = useState<string | null>(null);

  // Lists
  const [listas, setListas] = useState<Lista[]>([]);
  const [expandedLista, setExpandedLista] = useState<string | null>(null);
  const [listaMembros, setListaMembros] = useState<Membro[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(false);
  const [importDialogOpen, setImportDialogOpen] = useState(false);
  const [importTipo, setImportTipo] = useState<'lista' | 'grupo'>('lista');

  // Groups
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [expandedGrupo, setExpandedGrupo] = useState<string | null>(null);

  // Individual contacts
  const [contatos, setContatos] = useState<Contato[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [addContactOpen, setAddContactOpen] = useState(false);
  const [newNome, setNewNome] = useState('');
  const [newTelefone, setNewTelefone] = useState('');

  // Envios programados
  const [enviosOpen, setEnviosOpen] = useState(false);

  // Criar lista manual
  const [showCriarLista, setShowCriarLista] = useState(false);
  const [novaListaNome, setNovaListaNome] = useState('');
  const [novaListaDesc, setNovaListaDesc] = useState('');
  const [criandoLista, setCriandoLista] = useState(false);

  // Criar grupo manual
  const [showCriarGrupo, setShowCriarGrupo] = useState(false);

  // Editar lista (gerenciar membros)
  const [editListaId, setEditListaId] = useState<string | null>(null);
  const [editListaNome, setEditListaNome] = useState('');
  const [editMembros, setEditMembros] = useState<Membro[]>([]);
  const [loadingEditMembros, setLoadingEditMembros] = useState(false);
  const [addMembroNome, setAddMembroNome] = useState('');
  const [addMembroTel, setAddMembroTel] = useState('');
  const [addingMembro, setAddingMembro] = useState(false);

  // Init
  useEffect(() => {
    (async () => {
      const { data: { user } } = await supabase.auth.getUser();
      if (user) {
        setUserId(user.id);
      }
    })();
  }, []);

  useEffect(() => {
    if (userId) {
      loadListas();
      loadGrupos();
      loadContatos();
    }
  }, [userId]);

  // ── Listas ──
  const loadListas = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('pj_listas_categoria')
      .select('id, nome, total_membros, created_at')
      .eq('user_id', userId)
      .order('created_at', { ascending: false });
    setListas(data || []);
  };

  const toggleListaMembros = async (listaId: string) => {
    if (expandedLista === listaId) {
      setExpandedLista(null);
      setListaMembros([]);
      return;
    }
    setLoadingMembros(true);
    setExpandedLista(listaId);
    const { data } = await supabase
      .from('pj_lista_membros')
      .select('id, nome, telefone')
      .eq('lista_id', listaId);
    setListaMembros(data || []);
    setLoadingMembros(false);
  };

  const deleteLista = async (listaId: string) => {
    await supabase.from('pj_lista_membros').delete().eq('lista_id', listaId);
    await supabase.from('pj_listas_categoria').delete().eq('id', listaId);
    toast.success('Lista removida');
    if (expandedLista === listaId) {
      setExpandedLista(null);
      setListaMembros([]);
    }
    loadListas();
  };

  // ── Grupos ──
  const loadGrupos = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('pj_grupos_whatsapp')
      .select('id, nome, participantes_count, created_at, invite_link')
      .eq('user_id', userId)
      .eq('ativo', true)
      .order('created_at', { ascending: false });
    setGrupos(data || []);
  };

  const deleteGrupo = async (grupoId: string) => {
    await supabase.from('pj_grupos_whatsapp').update({ ativo: false }).eq('id', grupoId);
    toast.success('Grupo removido');
    loadGrupos();
  };

  const copyLink = (link: string | null) => {
    if (!link) { toast.error('Sem link disponível'); return; }
    navigator.clipboard.writeText(link);
    toast.success('Link copiado!');
  };

  // ── Contatos individuais ──
  const loadContatos = async () => {
    if (!userId) return;
    const { data } = await supabase
      .from('pj_lista_membros')
      .select('id, nome, telefone')
      .order('nome', { ascending: true });
    // Deduplicate by telefone
    const seen = new Set<string>();
    const unique: Contato[] = [];
    (data || []).forEach(c => {
      if (c.telefone && !seen.has(c.telefone)) {
        seen.add(c.telefone);
        unique.push(c);
      }
    });
    setContatos(unique);
  };

  const filteredContatos = useMemo(() => {
    if (!searchTerm) return contatos;
    const term = searchTerm.toLowerCase();
    return contatos.filter(c =>
      (c.nome?.toLowerCase().includes(term)) ||
      (c.telefone?.includes(term))
    );
  }, [contatos, searchTerm]);

  const addContact = async () => {
    if (!newTelefone.trim()) { toast.error('Telefone obrigatório'); return; }
    const { error } = await supabase.from('pj_lista_membros').insert({
      nome: newNome.trim() || null,
      telefone: newTelefone.trim(),
      lista_id: null,
    });
    if (error) { toast.error('Erro ao adicionar'); return; }
    toast.success('Contato adicionado');
    setNewNome('');
    setNewTelefone('');
    setAddContactOpen(false);
    loadContatos();
  };

  const deleteContato = async (id: string) => {
    await supabase.from('pj_lista_membros').delete().eq('id', id);
    toast.success('Contato removido');
    loadContatos();
  };

  const openImport = (tipo: 'lista' | 'grupo') => {
    setImportTipo(tipo);
    setImportDialogOpen(true);
  };

  const handleCriarLista = async () => {
    if (!novaListaNome.trim()) { toast.error('Digite o nome da lista'); return; }
    setCriandoLista(true);
    try {
      const { error } = await supabase.from('pj_listas_categoria').insert({
        user_id: userId,
        nome: novaListaNome.trim(),
        descricao: novaListaDesc.trim() || null,
        ativa: true,
        total_membros: 0,
      });
      if (error) throw error;
      toast.success(`Lista "${novaListaNome}" criada!`);
      setNovaListaNome('');
      setNovaListaDesc('');
      setShowCriarLista(false);
      loadListas();
    } catch (err: any) {
      toast.error('Erro: ' + err.message);
    }
    setCriandoLista(false);
  };

  // ── Editar lista (gerenciar membros) ──
  const openEditLista = async (lista: Lista) => {
    setEditListaId(lista.id);
    setEditListaNome(lista.nome);
    setLoadingEditMembros(true);
    setEditMembros([]);
    const { data } = await supabase
      .from('pj_lista_membros')
      .select('id, nome, telefone')
      .eq('lista_id', lista.id)
      .order('nome', { ascending: true });
    setEditMembros(data || []);
    setLoadingEditMembros(false);
  };

  const addMembroToLista = async () => {
    if (!addMembroTel.trim() || !editListaId) { toast.error('Telefone obrigatório'); return; }
    setAddingMembro(true);
    const { error } = await supabase.from('pj_lista_membros').insert({
      lista_id: editListaId,
      nome: addMembroNome.trim() || null,
      telefone: addMembroTel.trim(),
    });
    if (error) { toast.error('Erro: ' + error.message); setAddingMembro(false); return; }
    // Update count
    await supabase.from('pj_listas_categoria').update({
      total_membros: (editMembros.length + 1),
    }).eq('id', editListaId);
    setAddMembroNome('');
    setAddMembroTel('');
    setAddingMembro(false);
    // Reload members
    const { data } = await supabase
      .from('pj_lista_membros')
      .select('id, nome, telefone')
      .eq('lista_id', editListaId)
      .order('nome', { ascending: true });
    setEditMembros(data || []);
    toast.success('Membro adicionado!');
  };

  const removeMembroFromLista = async (membroId: string) => {
    await supabase.from('pj_lista_membros').delete().eq('id', membroId);
    const updated = editMembros.filter(m => m.id !== membroId);
    setEditMembros(updated);
    if (editListaId) {
      await supabase.from('pj_listas_categoria').update({
        total_membros: updated.length,
      }).eq('id', editListaId);
    }
    toast.success('Membro removido');
  };

  const closeEditLista = () => {
    setEditListaId(null);
    setEditMembros([]);
    setAddMembroNome('');
    setAddMembroTel('');
    loadListas();
  };

  const fmtDate = (d: string | null) => {
    if (!d) return '—';
    try { return format(new Date(d), "dd/MM/yyyy", { locale: ptBR }); }
    catch { return '—'; }
  };

  return (
    <div className="space-y-6">
      {/* ── PARTE 1: Duas colunas ── */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* COLUNA ESQUERDA — Listas */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">📋 Listas de Transmissão</CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setShowCriarLista(true)}>
                <Plus className="h-4 w-4 mr-1" /> Criar
              </Button>
              <Button size="sm" variant="outline" onClick={() => openImport('lista')}>
                <Users className="h-4 w-4 mr-1" /> Importar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {listas.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhuma lista criada</p>
            )}
            {listas.map(lista => (
              <div key={lista.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{lista.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {lista.total_membros || 0} membros · {fmtDate(lista.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-orange-600 border-orange-300 bg-orange-50 text-xs">
                    ⚠️ Máx 256
                  </Badge>
                </div>
                <div className="flex gap-2 flex-wrap">
                  <Button variant="outline" size="sm" onClick={() => openEditLista(lista)}>
                    <Pencil className="h-3 w-3 mr-1" /> Editar
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => toggleListaMembros(lista.id)}>
                    {expandedLista === lista.id ? <EyeOff className="h-3 w-3 mr-1" /> : <Eye className="h-3 w-3 mr-1" />}
                    {expandedLista === lista.id ? 'Fechar' : 'Ver'}
                  </Button>
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-3 w-3 mr-1" /> Deletar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Tem certeza? Isso remove a lista e todos os contatos dela.
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteLista(lista.id)}>Confirmar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
                {expandedLista === lista.id && (
                  <div className="mt-2 border-t pt-2 space-y-1 max-h-48 overflow-y-auto">
                    {loadingMembros ? (
                      <p className="text-xs text-muted-foreground">Carregando...</p>
                    ) : listaMembros.length === 0 ? (
                      <p className="text-xs text-muted-foreground">Nenhum membro</p>
                    ) : (
                      listaMembros.map(m => (
                        <div key={m.id} className="flex justify-between text-xs py-1">
                          <span>{m.nome || 'Sem nome'}</span>
                          <span className="text-muted-foreground">{m.telefone}</span>
                        </div>
                      ))
                    )}
                  </div>
                )}
              </div>
            ))}
          </CardContent>
        </Card>

        {/* COLUNA DIREITA — Grupos */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between pb-3">
            <CardTitle className="text-lg">👥 Grupos WhatsApp</CardTitle>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setShowCriarGrupo(true)}>
                <Plus className="h-4 w-4 mr-1" /> Criar
              </Button>
              <Button size="sm" variant="outline" onClick={() => openImport('grupo')}>
                <Users className="h-4 w-4 mr-1" /> Importar
              </Button>
            </div>
          </CardHeader>
          <CardContent className="space-y-3">
            {grupos.length === 0 && (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum grupo ativo</p>
            )}
            {grupos.map(grupo => (
              <div key={grupo.id} className="border rounded-lg p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium text-sm">{grupo.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {grupo.participantes_count || 0} participantes · {fmtDate(grupo.created_at)}
                    </p>
                  </div>
                  <Badge variant="outline" className="text-green-600 border-green-300 bg-green-50 text-xs">
                    ✅ Ilimitado
                  </Badge>
                </div>
                <div className="flex gap-2 flex-wrap">
                  {grupo.invite_link && (
                    <>
                      <Button variant="outline" size="sm" onClick={() => copyLink(grupo.invite_link)}>
                        <Link2 className="h-3 w-3 mr-1" /> Copiar link
                      </Button>
                    </>
                  )}
                  <AlertDialog>
                    <AlertDialogTrigger asChild>
                      <Button variant="destructive" size="sm">
                        <Trash2 className="h-3 w-3 mr-1" /> Deletar
                      </Button>
                    </AlertDialogTrigger>
                    <AlertDialogContent>
                      <AlertDialogHeader>
                        <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
                        <AlertDialogDescription>
                          Deseja desativar este grupo?
                        </AlertDialogDescription>
                      </AlertDialogHeader>
                      <AlertDialogFooter>
                        <AlertDialogCancel>Cancelar</AlertDialogCancel>
                        <AlertDialogAction onClick={() => deleteGrupo(grupo.id)}>Confirmar</AlertDialogAction>
                      </AlertDialogFooter>
                    </AlertDialogContent>
                  </AlertDialog>
                </div>
              </div>
            ))}
          </CardContent>
        </Card>
      </div>

      {/* ── PARTE 2: Contatos individuais ── */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between pb-3">
          <CardTitle className="text-lg">👤 Contatos Salvos</CardTitle>
          <Dialog open={addContactOpen} onOpenChange={setAddContactOpen}>
            <DialogTrigger asChild>
              <Button size="sm"><Plus className="h-4 w-4 mr-1" /> Adicionar contato</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Novo Contato</DialogTitle>
                <DialogDescription>Adicione um contato individual</DialogDescription>
              </DialogHeader>
              <div className="space-y-3">
                <div>
                  <Label>Nome</Label>
                  <Input value={newNome} onChange={e => setNewNome(e.target.value)} placeholder="Nome (opcional)" />
                </div>
                <div>
                  <Label>Telefone *</Label>
                  <Input value={newTelefone} onChange={e => setNewTelefone(e.target.value)} placeholder="5511999999999" />
                </div>
              </div>
              <DialogFooter>
                <Button onClick={addContact}>Salvar</Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </CardHeader>
        <CardContent>
          <div className="mb-3">
            <div className="relative">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Buscar por nome ou telefone..."
                className="pl-9"
                value={searchTerm}
                onChange={e => setSearchTerm(e.target.value)}
              />
            </div>
          </div>
          {filteredContatos.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Nenhum contato encontrado</p>
          ) : (
            <div className="max-h-80 overflow-y-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Nome</TableHead>
                    <TableHead>Telefone</TableHead>
                    <TableHead className="w-16"></TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredContatos.map(c => (
                    <TableRow key={c.id}>
                      <TableCell className="text-sm">{c.nome || '—'}</TableCell>
                      <TableCell className="text-sm font-mono">{c.telefone}</TableCell>
                      <TableCell>
                        <AlertDialog>
                          <AlertDialogTrigger asChild>
                            <Button variant="ghost" size="sm"><Trash2 className="h-3 w-3 text-destructive" /></Button>
                          </AlertDialogTrigger>
                          <AlertDialogContent>
                            <AlertDialogHeader>
                              <AlertDialogTitle>Remover contato?</AlertDialogTitle>
                              <AlertDialogDescription>Essa ação não pode ser desfeita.</AlertDialogDescription>
                            </AlertDialogHeader>
                            <AlertDialogFooter>
                              <AlertDialogCancel>Cancelar</AlertDialogCancel>
                              <AlertDialogAction onClick={() => deleteContato(c.id)}>Remover</AlertDialogAction>
                            </AlertDialogFooter>
                          </AlertDialogContent>
                        </AlertDialog>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── PARTE 3: Envios Programados (colapsável) ── */}
      <Collapsible open={enviosOpen} onOpenChange={setEnviosOpen}>
        <Card>
          <CollapsibleTrigger asChild>
            <CardHeader className="cursor-pointer flex flex-row items-center justify-between pb-3">
              <CardTitle className="text-lg flex items-center gap-2">
                <Calendar className="h-5 w-5" /> 📅 Envios Programados
              </CardTitle>
              {enviosOpen ? <ChevronUp className="h-5 w-5" /> : <ChevronDown className="h-5 w-5" />}
            </CardHeader>
          </CollapsibleTrigger>
          <CollapsibleContent>
            <CardContent>
              <EnviosProgramadosPJ />
            </CardContent>
          </CollapsibleContent>
        </Card>
      </Collapsible>

      {/* ── Dialog para importação ── */}
      <Dialog open={importDialogOpen} onOpenChange={setImportDialogOpen}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{importTipo === 'grupo' ? 'Importar Grupo WhatsApp' : 'Importar Lista de Transmissão'}</DialogTitle>
          </DialogHeader>
          <ImportContatosPJ />
        </DialogContent>
      </Dialog>

      {/* ── Dialog para criar lista manual ── */}
      <Dialog open={showCriarLista} onOpenChange={setShowCriarLista}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Criar Lista de Transmissão</DialogTitle>
            <DialogDescription>Crie uma lista vazia e adicione contatos depois.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div>
              <Label>Nome da Lista *</Label>
              <Input value={novaListaNome} onChange={e => setNovaListaNome(e.target.value)} placeholder="Ex: Clientes VIP" />
            </div>
            <div>
              <Label>Descrição (opcional)</Label>
              <Textarea value={novaListaDesc} onChange={e => setNovaListaDesc(e.target.value)} placeholder="Descrição da lista..." className="min-h-[80px]" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowCriarLista(false)}>Cancelar</Button>
            <Button onClick={handleCriarLista} disabled={criandoLista || !novaListaNome.trim()}>
              {criandoLista ? <><Loader2 className="h-4 w-4 mr-2 animate-spin" /> Criando...</> : 'Criar Lista'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* ── Dialog para criar grupo manual ── */}
      <Dialog open={showCriarGrupo} onOpenChange={setShowCriarGrupo}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Criar Grupo WhatsApp</DialogTitle>
            <DialogDescription>Crie um grupo real no WhatsApp via seu celular conectado.</DialogDescription>
          </DialogHeader>
          <CriarGrupoWhatsAppPJ />
        </DialogContent>
      </Dialog>

      {/* ── Dialog para editar lista (gerenciar membros) ── */}
      <Dialog open={!!editListaId} onOpenChange={(open) => !open && closeEditLista()}>
        <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>✏️ Editar Lista: {editListaNome}</DialogTitle>
            <DialogDescription>Adicione ou remova membros desta lista.</DialogDescription>
          </DialogHeader>

          {/* Adicionar membro */}
          <div className="border rounded-lg p-3 space-y-2 bg-muted/30">
            <p className="text-sm font-medium flex items-center gap-1"><UserPlus className="h-4 w-4" /> Adicionar Membro</p>
            <div className="flex gap-2">
              <Input
                placeholder="Nome (opcional)"
                value={addMembroNome}
                onChange={e => setAddMembroNome(e.target.value)}
                className="flex-1"
              />
              <Input
                placeholder="5511999999999"
                value={addMembroTel}
                onChange={e => setAddMembroTel(e.target.value)}
                className="flex-1"
              />
              <Button size="sm" onClick={addMembroToLista} disabled={addingMembro || !addMembroTel.trim()}>
                {addingMembro ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
              </Button>
            </div>
          </div>

          {/* Lista de membros */}
          <div className="space-y-1">
            <p className="text-sm font-medium">{editMembros.length} membro(s)</p>
            {loadingEditMembros ? (
              <div className="flex justify-center py-4"><Loader2 className="h-5 w-5 animate-spin text-muted-foreground" /></div>
            ) : editMembros.length === 0 ? (
              <p className="text-sm text-muted-foreground text-center py-4">Nenhum membro nesta lista</p>
            ) : (
              <div className="max-h-60 overflow-y-auto border rounded-lg">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>Telefone</TableHead>
                      <TableHead className="w-12"></TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {editMembros.map(m => (
                      <TableRow key={m.id}>
                        <TableCell className="text-sm">{m.nome || '—'}</TableCell>
                        <TableCell className="text-sm font-mono">{m.telefone}</TableCell>
                        <TableCell>
                          <Button variant="ghost" size="sm" onClick={() => removeMembroFromLista(m.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={closeEditLista}>Fechar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ─── Main Page ────────────────────────────────────────
export default function WhatsAppAutomacaoPJ() {
  return (
    <div className="container mx-auto p-6 max-w-5xl">
      <div className="mb-6">
        <Link to="/dashboard">
          <Button variant="ghost" size="sm">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Voltar ao Dashboard
          </Button>
        </Link>
      </div>

      <div className="mb-6">
        <h1 className="text-2xl font-bold">📱 WhatsApp</h1>
        <p className="text-muted-foreground">
          Conecte seu celular e gerencie contatos & listas
        </p>
      </div>

      <Tabs defaultValue="conexao" className="w-full">
        <TabsList className="grid w-full grid-cols-2">
          <TabsTrigger value="conexao" className="flex items-center gap-2">
            <Smartphone className="h-4 w-4" />
            Conectar Celular
          </TabsTrigger>
          <TabsTrigger value="contatos" className="flex items-center gap-2">
            <Users className="h-4 w-4" />
            Contatos & Listas
          </TabsTrigger>
        </TabsList>

        <TabsContent value="conexao" className="mt-4">
          <WhatsAppConnectionPJ />
        </TabsContent>

        <TabsContent value="contatos" className="mt-4">
          <ContatosTab />
        </TabsContent>
      </Tabs>
    </div>
  );
}
