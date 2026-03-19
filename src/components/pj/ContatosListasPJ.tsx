"use client";

import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2, Plus, Trash2, Eye, Copy, ChevronDown, Search, Users, Edit2, Save, X, UserPlus, FileDown,
} from "lucide-react";
import { toast } from "sonner";
import ImportContatosPJ from "./ImportContatosPJ";
import EnviosProgramadosPJ from "./EnviosProgramadosPJ";
import CriarGrupoWhatsAppPJ from "./CriarGrupoWhatsAppPJ";

interface ListaItem {
  id: string;
  nome: string;
  descricao?: string | null;
  total_membros: number;
  created_at: string;
}

interface GrupoItem {
  id: string;
  nome: string;
  grupo_jid: string;
  participantes_count: number;
  invite_link?: string | null;
  created_at: string;
}

interface MembroItem {
  id: string;
  nome: string | null;
  telefone: string;
  lista_id: string;
}

interface ContatoUnico {
  id: string;
  nome: string | null;
  telefone: string;
}

export default function ContatosListasPJ() {
  const [userId, setUserId] = useState("");
  const [loading, setLoading] = useState(true);

  const [listas, setListas] = useState<ListaItem[]>([]);
  const [expandedLista, setExpandedLista] = useState<string | null>(null);
  const [listaMembros, setListaMembros] = useState<MembroItem[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(false);

  const [grupos, setGrupos] = useState<GrupoItem[]>([]);

  const [deleteTarget, setDeleteTarget] = useState<{ type: "lista" | "grupo" | "contato" | "membro"; id: string; nome: string; count?: number } | null>(null);

  const [showImportModal, setShowImportModal] = useState(false);
  const [importTipo, setImportTipo] = useState<"lista" | "grupo">("lista");

  const [contatos, setContatos] = useState<ContatoUnico[]>([]);
  const [buscaContato, setBuscaContato] = useState("");
  const [loadingContatos, setLoadingContatos] = useState(false);
  const [showAddContato, setShowAddContato] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [addingContato, setAddingContato] = useState(false);

  const [enviosAberto, setEnviosAberto] = useState(false);

  const [showCriarLista, setShowCriarLista] = useState(false);
  const [novaListaNome, setNovaListaNome] = useState("");
  const [novaListaDesc, setNovaListaDesc] = useState("");
  const [criandoLista, setCriandoLista] = useState(false);

  const [showCriarGrupo, setShowCriarGrupo] = useState(false);

  // Edit states
  const [editingListaId, setEditingListaId] = useState<string | null>(null);
  const [editListaNome, setEditListaNome] = useState("");
  const [editingMembroId, setEditingMembroId] = useState<string | null>(null);
  const [editMembroNome, setEditMembroNome] = useState("");
  const [editMembroTelefone, setEditMembroTelefone] = useState("");
  const [editingContatoId, setEditingContatoId] = useState<string | null>(null);
  const [editContatoNome, setEditContatoNome] = useState("");
  const [editContatoTelefone, setEditContatoTelefone] = useState("");

  // Add member to list
  const [addMemberListaId, setAddMemberListaId] = useState<string | null>(null);
  const [newMemberNome, setNewMemberNome] = useState("");
  const [newMemberTelefone, setNewMemberTelefone] = useState("");

  useEffect(() => { loadUser(); }, []);

  const loadUser = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) setUserId(data.user.id);
  };

  useEffect(() => { if (userId) loadAll(); }, [userId]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadListas(), loadGrupos(), loadContatos()]);
    setLoading(false);
  };

  const loadListas = async () => {
    const { data } = await supabase
      .from("pj_listas_categoria")
      .select("id, nome, descricao, total_membros, created_at")
      .eq("user_id", userId)
      .eq("ativa", true)
      .order("created_at", { ascending: false });
    setListas((data as ListaItem[]) || []);
  };

  const loadGrupos = async () => {
    const { data } = await supabase
      .from("pj_grupos_whatsapp")
      .select("id, nome, grupo_jid, participantes_count, invite_link, created_at")
      .eq("user_id", userId)
      .eq("ativo", true)
      .order("created_at", { ascending: false });
    setGrupos((data as unknown as GrupoItem[]) || []);
  };

  const loadContatos = async () => {
    setLoadingContatos(true);
    const { data } = await supabase
      .from("pj_lista_membros")
      .select("id, nome, telefone, lista_id")
      .order("nome", { ascending: true })
      .limit(200);
    const seen = new Set<string>();
    const unique: ContatoUnico[] = [];
    (data || []).forEach((c: any) => {
      if (!seen.has(c.telefone)) {
        seen.add(c.telefone);
        unique.push({ id: c.id, nome: c.nome, telefone: c.telefone });
      }
    });
    setContatos(unique);
    setLoadingContatos(false);
  };

  const loadListaMembros = async (listaId: string) => {
    if (expandedLista === listaId) { setExpandedLista(null); return; }
    setLoadingMembros(true);
    setExpandedLista(listaId);
    const { data } = await supabase
      .from("pj_lista_membros")
      .select("id, nome, telefone, lista_id")
      .eq("lista_id", listaId)
      .order("nome", { ascending: true });
    setListaMembros((data as unknown as MembroItem[]) || []);
    setLoadingMembros(false);
  };

  // ── Delete ──
  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      if (deleteTarget.type === "lista") {
        await supabase.from("pj_lista_membros").delete().eq("lista_id", deleteTarget.id);
        await supabase.from("pj_listas_categoria").delete().eq("id", deleteTarget.id);
        toast.success("Lista removida!");
        await loadListas();
        if (expandedLista === deleteTarget.id) setExpandedLista(null);
      } else if (deleteTarget.type === "grupo") {
        await supabase.from("pj_grupos_whatsapp").delete().eq("id", deleteTarget.id);
        toast.success("Grupo removido!");
        await loadGrupos();
      } else if (deleteTarget.type === "contato") {
        await supabase.from("pj_lista_membros").delete().eq("id", deleteTarget.id);
        toast.success("Contato removido!");
        await loadContatos();
      } else if (deleteTarget.type === "membro") {
        await supabase.from("pj_lista_membros").delete().eq("id", deleteTarget.id);
        toast.success("Membro removido!");
        if (expandedLista) await loadListaMembros(expandedLista);
        await loadListas();
      }
    } catch (err: any) {
      toast.error("Erro ao deletar: " + err.message);
    }
    setDeleteTarget(null);
  };

  // ── Edit Lista Name ──
  const startEditLista = (lista: ListaItem) => {
    setEditingListaId(lista.id);
    setEditListaNome(lista.nome);
  };

  const saveEditLista = async () => {
    if (!editingListaId || !editListaNome.trim()) return;
    try {
      await supabase.from("pj_listas_categoria").update({ nome: editListaNome.trim() }).eq("id", editingListaId);
      toast.success("Nome da lista atualizado!");
      setEditingListaId(null);
      await loadListas();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  // ── Edit Membro ──
  const startEditMembro = (m: MembroItem) => {
    setEditingMembroId(m.id);
    setEditMembroNome(m.nome || "");
    setEditMembroTelefone(m.telefone);
  };

  const saveEditMembro = async () => {
    if (!editingMembroId) return;
    try {
      await supabase.from("pj_lista_membros").update({
        nome: editMembroNome.trim() || null,
        telefone: editMembroTelefone.trim(),
      }).eq("id", editingMembroId);
      toast.success("Membro atualizado!");
      setEditingMembroId(null);
      if (expandedLista) await loadListaMembros(expandedLista);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  // ── Add member to lista ──
  const handleAddMemberToList = async () => {
    if (!addMemberListaId || !newMemberTelefone.trim()) {
      toast.error("Preencha o telefone");
      return;
    }
    try {
      await supabase.from("pj_lista_membros").insert({
        lista_id: addMemberListaId,
        nome: newMemberNome.trim() || null,
        telefone: newMemberTelefone.trim(),
      });
      toast.success("Membro adicionado!");
      setNewMemberNome("");
      setNewMemberTelefone("");
      setAddMemberListaId(null);
      if (expandedLista) await loadListaMembros(expandedLista);
      await loadListas();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  // ── Edit Contato ──
  const startEditContato = (c: ContatoUnico) => {
    setEditingContatoId(c.id);
    setEditContatoNome(c.nome || "");
    setEditContatoTelefone(c.telefone);
  };

  const saveEditContato = async () => {
    if (!editingContatoId) return;
    try {
      await supabase.from("pj_lista_membros").update({
        nome: editContatoNome.trim() || null,
        telefone: editContatoTelefone.trim(),
      }).eq("id", editingContatoId);
      toast.success("Contato atualizado!");
      setEditingContatoId(null);
      await loadContatos();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
  };

  // ── Add individual contact ──
  const handleAddContato = async () => {
    if (!novoTelefone.trim()) { toast.error("Preencha o telefone"); return; }
    setAddingContato(true);
    try {
      let defaultListaId: string;
      const { data: existingList } = await supabase
        .from("pj_listas_categoria").select("id")
        .eq("user_id", userId).eq("nome", "Contatos Individuais").single();

      if (existingList) {
        defaultListaId = existingList.id;
      } else {
        const { data: newList, error } = await supabase
          .from("pj_listas_categoria")
          .insert({ user_id: userId, nome: "Contatos Individuais", descricao: "Contatos adicionados individualmente", ativa: true, total_membros: 0 })
          .select("id").single();
        if (error) throw error;
        defaultListaId = newList!.id;
      }

      const { error } = await supabase.from("pj_lista_membros").insert({
        lista_id: defaultListaId,
        nome: novoNome.trim() || null,
        telefone: novoTelefone.trim(),
      });
      if (error) throw error;

      toast.success("Contato adicionado!");
      setNovoNome(""); setNovoTelefone(""); setShowAddContato(false);
      await Promise.all([loadContatos(), loadListas()]);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
    setAddingContato(false);
  };

  const handleCriarLista = async () => {
    if (!novaListaNome.trim()) { toast.error("Digite o nome da lista"); return; }
    setCriandoLista(true);
    try {
      const { error } = await supabase.from("pj_listas_categoria").insert({
        user_id: userId, nome: novaListaNome.trim(), descricao: novaListaDesc.trim() || null, ativa: true, total_membros: 0,
      });
      if (error) throw error;
      toast.success(`Lista "${novaListaNome}" criada!`);
      setNovaListaNome(""); setNovaListaDesc(""); setShowCriarLista(false);
      await loadListas();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
    setCriandoLista(false);
  };

  const filteredContatos = buscaContato.length >= 2
    ? contatos.filter(c => c.nome?.toLowerCase().includes(buscaContato.toLowerCase()) || c.telefone.includes(buscaContato))
    : contatos;

  const openImport = (tipo: "lista" | "grupo") => { setImportTipo(tipo); setShowImportModal(true); };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold tracking-tight">📋 Listas & Contatos</h2>
        <p className="text-sm text-muted-foreground mt-1">Gerencie suas listas, grupos e contatos para campanhas</p>
      </div>

      {/* GRID: Listas + Grupos */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* ── Listas de Transmissão ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">📋 Listas de Transmissão</h3>
              <Badge variant="outline" className="text-[10px] bg-orange-50 text-orange-600 border-orange-200">Máx 256</Badge>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setShowCriarLista(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Criar
              </Button>
              <Button size="sm" variant="outline" onClick={() => openImport("lista")} className="gap-1.5">
                <FileDown className="h-3.5 w-3.5" /> Importar
              </Button>
            </div>
          </div>

          {listas.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-10 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhuma lista criada ainda</p>
                <Button size="sm" variant="link" onClick={() => openImport("lista")} className="mt-2">
                  Criar primeira lista →
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {listas.map((lista) => (
                <Card key={lista.id} className="group hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      {editingListaId === lista.id ? (
                        <div className="flex items-center gap-2 flex-1 mr-2">
                          <Input
                            value={editListaNome}
                            onChange={(e) => setEditListaNome(e.target.value)}
                            className="h-8 text-sm"
                            autoFocus
                            onKeyDown={(e) => e.key === "Enter" && saveEditLista()}
                          />
                          <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={saveEditLista}>
                            <Save className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingListaId(null)}>
                            <X className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      ) : (
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-sm truncate">{lista.nome}</p>
                          <p className="text-xs text-muted-foreground">
                            {lista.total_membros} contatos • {new Date(lista.created_at).toLocaleDateString("pt-BR")}
                          </p>
                        </div>
                      )}
                      {editingListaId !== lista.id && (
                        <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Editar nome" onClick={() => startEditLista(lista)}>
                            <Edit2 className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Ver membros" onClick={() => loadListaMembros(lista.id)}>
                            <Eye className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Adicionar membro" onClick={() => { setAddMemberListaId(lista.id); if (expandedLista !== lista.id) loadListaMembros(lista.id); }}>
                            <UserPlus className="h-3.5 w-3.5" />
                          </Button>
                          <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir lista" onClick={() => setDeleteTarget({ type: "lista", id: lista.id, nome: lista.nome, count: lista.total_membros })}>
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </div>
                      )}
                    </div>

                    {/* Add member inline */}
                    {addMemberListaId === lista.id && (
                      <div className="mt-3 border-t pt-3 flex gap-2 items-end">
                        <div className="flex-1">
                          <Label className="text-xs">Nome</Label>
                          <Input value={newMemberNome} onChange={(e) => setNewMemberNome(e.target.value)} placeholder="Nome" className="h-8 text-xs" />
                        </div>
                        <div className="flex-1">
                          <Label className="text-xs">Telefone *</Label>
                          <Input value={newMemberTelefone} onChange={(e) => setNewMemberTelefone(e.target.value)} placeholder="5511999..." className="h-8 text-xs" />
                        </div>
                        <Button size="sm" className="h-8" onClick={handleAddMemberToList}>
                          <Plus className="h-3.5 w-3.5" />
                        </Button>
                        <Button size="sm" variant="ghost" className="h-8" onClick={() => setAddMemberListaId(null)}>
                          <X className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    )}

                    {/* Expanded members */}
                    {expandedLista === lista.id && (
                      <div className="mt-3 border-t pt-3 max-h-52 overflow-y-auto space-y-1">
                        {loadingMembros ? (
                          <Loader2 className="h-4 w-4 animate-spin mx-auto my-4" />
                        ) : listaMembros.length === 0 ? (
                          <p className="text-xs text-muted-foreground text-center py-4">Lista vazia — adicione membros acima</p>
                        ) : (
                          listaMembros.map((m) => (
                            <div key={m.id} className="flex items-center justify-between text-xs py-1.5 px-2 rounded hover:bg-muted/50 group/member">
                              {editingMembroId === m.id ? (
                                <div className="flex items-center gap-2 flex-1">
                                  <Input value={editMembroNome} onChange={(e) => setEditMembroNome(e.target.value)} className="h-7 text-xs flex-1" placeholder="Nome" />
                                  <Input value={editMembroTelefone} onChange={(e) => setEditMembroTelefone(e.target.value)} className="h-7 text-xs flex-1 font-mono" placeholder="Telefone" />
                                  <Button size="icon" variant="ghost" className="h-6 w-6 text-green-600" onClick={saveEditMembro}>
                                    <Save className="h-3 w-3" />
                                  </Button>
                                  <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => setEditingMembroId(null)}>
                                    <X className="h-3 w-3" />
                                  </Button>
                                </div>
                              ) : (
                                <>
                                  <span className="truncate flex-1">{m.nome || "(Sem nome)"}</span>
                                  <span className="text-muted-foreground font-mono mx-2">{m.telefone}</span>
                                  <div className="flex gap-0.5 opacity-0 group-hover/member:opacity-100 transition-opacity">
                                    <Button size="icon" variant="ghost" className="h-6 w-6" onClick={() => startEditMembro(m)}>
                                      <Edit2 className="h-3 w-3" />
                                    </Button>
                                    <Button size="icon" variant="ghost" className="h-6 w-6 text-destructive" onClick={() => setDeleteTarget({ type: "membro", id: m.id, nome: m.nome || m.telefone })}>
                                      <Trash2 className="h-3 w-3" />
                                    </Button>
                                  </div>
                                </>
                              )}
                            </div>
                          ))
                        )}
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>

        {/* ── Grupos WhatsApp ── */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h3 className="text-lg font-semibold">👥 Grupos WhatsApp</h3>
              <Badge variant="outline" className="text-[10px] bg-green-50 text-green-600 border-green-200">Ilimitado</Badge>
            </div>
            <div className="flex gap-1.5">
              <Button size="sm" variant="outline" onClick={() => setShowCriarGrupo(true)} className="gap-1.5">
                <Plus className="h-3.5 w-3.5" /> Criar
              </Button>
              <Button size="sm" variant="outline" onClick={() => openImport("grupo")} className="gap-1.5">
                <FileDown className="h-3.5 w-3.5" /> Importar
              </Button>
            </div>
          </div>

          {grupos.length === 0 ? (
            <Card className="border-dashed border-2">
              <CardContent className="py-10 text-center">
                <Users className="h-10 w-10 mx-auto text-muted-foreground/40 mb-3" />
                <p className="text-sm text-muted-foreground">Nenhum grupo criado ainda</p>
                <Button size="sm" variant="link" onClick={() => openImport("grupo")} className="mt-2">
                  Criar primeiro grupo →
                </Button>
              </CardContent>
            </Card>
          ) : (
            <div className="space-y-2">
              {grupos.map((grupo) => (
                <Card key={grupo.id} className="group hover:shadow-md transition-shadow">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex-1 min-w-0">
                        <p className="font-semibold text-sm truncate">{grupo.nome}</p>
                        <p className="text-xs text-muted-foreground">
                          {grupo.participantes_count} membros • {new Date(grupo.created_at).toLocaleDateString("pt-BR")}
                        </p>
                      </div>
                      <div className="flex gap-0.5 opacity-60 group-hover:opacity-100 transition-opacity">
                        {grupo.invite_link && (
                          <Button size="icon" variant="ghost" className="h-8 w-8" title="Copiar link" onClick={() => { navigator.clipboard.writeText(grupo.invite_link!); toast.success("Link copiado!"); }}>
                            <Copy className="h-3.5 w-3.5" />
                          </Button>
                        )}
                        <Button size="icon" variant="ghost" className="h-8 w-8 text-destructive hover:text-destructive" title="Excluir grupo" onClick={() => setDeleteTarget({ type: "grupo", id: grupo.id, nome: grupo.nome })}>
                          <Trash2 className="h-3.5 w-3.5" />
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

      {/* ── Contatos Individuais ── */}
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">👤 Contatos Individuais ({contatos.length})</h3>
          <Button size="sm" onClick={() => setShowAddContato(true)} className="gap-1.5">
            <Plus className="h-3.5 w-3.5" /> Adicionar
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input placeholder="Buscar por nome ou telefone..." value={buscaContato} onChange={(e) => setBuscaContato(e.target.value)} className="pl-10" />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="max-h-80 overflow-y-auto">
              {filteredContatos.length === 0 ? (
                <div className="text-center py-10">
                  <Users className="h-8 w-8 mx-auto text-muted-foreground/40 mb-2" />
                  <p className="text-sm text-muted-foreground">{buscaContato ? "Nenhum contato encontrado" : "Nenhum contato cadastrado"}</p>
                </div>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30 sticky top-0 z-10">
                    <tr>
                      <th className="text-left p-3 font-medium text-xs uppercase text-muted-foreground">Nome</th>
                      <th className="text-left p-3 font-medium text-xs uppercase text-muted-foreground">Telefone</th>
                      <th className="w-24 p-3 text-right font-medium text-xs uppercase text-muted-foreground">Ações</th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContatos.map((c) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/30 group/row transition-colors">
                        {editingContatoId === c.id ? (
                          <>
                            <td className="p-2">
                              <Input value={editContatoNome} onChange={(e) => setEditContatoNome(e.target.value)} className="h-8 text-sm" placeholder="Nome" />
                            </td>
                            <td className="p-2">
                              <Input value={editContatoTelefone} onChange={(e) => setEditContatoTelefone(e.target.value)} className="h-8 text-sm font-mono" placeholder="Telefone" />
                            </td>
                            <td className="p-2 text-right">
                              <Button size="icon" variant="ghost" className="h-7 w-7 text-green-600" onClick={saveEditContato}>
                                <Save className="h-3.5 w-3.5" />
                              </Button>
                              <Button size="icon" variant="ghost" className="h-7 w-7" onClick={() => setEditingContatoId(null)}>
                                <X className="h-3.5 w-3.5" />
                              </Button>
                            </td>
                          </>
                        ) : (
                          <>
                            <td className="p-3">{c.nome || <span className="text-muted-foreground italic">Sem nome</span>}</td>
                            <td className="p-3 font-mono text-muted-foreground text-xs">{c.telefone}</td>
                            <td className="p-3 text-right">
                              <div className="flex justify-end gap-0.5 opacity-0 group-hover/row:opacity-100 transition-opacity">
                                <Button size="icon" variant="ghost" className="h-7 w-7" title="Editar" onClick={() => startEditContato(c)}>
                                  <Edit2 className="h-3.5 w-3.5" />
                                </Button>
                                <Button size="icon" variant="ghost" className="h-7 w-7 text-destructive hover:text-destructive" title="Excluir" onClick={() => setDeleteTarget({ type: "contato", id: c.id, nome: c.nome || c.telefone })}>
                                  <Trash2 className="h-3.5 w-3.5" />
                                </Button>
                              </div>
                            </td>
                          </>
                        )}
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* ── Envios Programados ── */}
      <Collapsible open={enviosAberto} onOpenChange={setEnviosAberto}>
        <CollapsibleTrigger asChild>
          <Button variant="outline" className="w-full justify-between">
            <span className="flex items-center gap-2">📅 Envios Programados</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${enviosAberto ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-3">
          <EnviosProgramadosPJ />
        </CollapsibleContent>
      </Collapsible>

      {/* ── Modals ── */}
      <Dialog open={showImportModal} onOpenChange={(open) => { setShowImportModal(open); if (!open) loadAll(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>{importTipo === "lista" ? "📋 Nova Lista de Transmissão" : "👥 Novo Grupo WhatsApp"}</DialogTitle>
          </DialogHeader>
          <ImportContatosPJ />
        </DialogContent>
      </Dialog>

      <Dialog open={showAddContato} onOpenChange={setShowAddContato}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>Adicionar Contato</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label className="text-xs">Nome (opcional)</Label><Input placeholder="Ex: Maria" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} /></div>
            <div><Label className="text-xs">Telefone *</Label><Input placeholder="5511999998888" value={novoTelefone} onChange={(e) => setNovoTelefone(e.target.value)} /></div>
            <Button className="w-full" onClick={handleAddContato} disabled={addingContato}>
              {addingContato ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCriarLista} onOpenChange={setShowCriarLista}>
        <DialogContent className="max-w-sm">
          <DialogHeader><DialogTitle>📋 Criar Lista de Transmissão</DialogTitle></DialogHeader>
          <div className="space-y-3 pt-2">
            <div><Label>Nome da Lista</Label><Input placeholder="Ex: Clientes VIP" value={novaListaNome} onChange={(e) => setNovaListaNome(e.target.value)} /></div>
            <div><Label>Descrição (opcional)</Label><Textarea placeholder="Descrição..." value={novaListaDesc} onChange={(e) => setNovaListaDesc(e.target.value)} className="min-h-[60px]" /></div>
            <Button className="w-full" onClick={handleCriarLista} disabled={criandoLista || !novaListaNome.trim()}>
              {criandoLista ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar Lista
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      <Dialog open={showCriarGrupo} onOpenChange={(open) => { setShowCriarGrupo(open); if (!open) loadGrupos(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader><DialogTitle>👥 Criar Grupo WhatsApp</DialogTitle></DialogHeader>
          <CriarGrupoWhatsAppPJ />
        </DialogContent>
      </Dialog>

      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "lista"
                ? `Isso remove a lista "${deleteTarget.nome}" e todos os ${deleteTarget.count || 0} contatos.`
                : deleteTarget?.type === "grupo"
                ? `Isso remove o grupo "${deleteTarget.nome}" permanentemente.`
                : `Isso remove "${deleteTarget?.nome}" permanentemente.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleDelete} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Deletar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
