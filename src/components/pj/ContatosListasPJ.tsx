"use client";

import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible";
import {
  Loader2, Plus, Trash2, Eye, Copy, ChevronDown, Search, Users, X,
} from "lucide-react";
import { toast } from "sonner";
import ImportContatosPJ from "./ImportContatosPJ";
import EnviosProgramadosPJ from "./EnviosProgramadosPJ";
import CriarGrupoWhatsAppPJ from "./CriarGrupoWhatsAppPJ";

interface ListaItem {
  id: string;
  nome: string;
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

  // Listas
  const [listas, setListas] = useState<ListaItem[]>([]);
  const [expandedLista, setExpandedLista] = useState<string | null>(null);
  const [listaMembros, setListaMembros] = useState<MembroItem[]>([]);
  const [loadingMembros, setLoadingMembros] = useState(false);

  // Grupos
  const [grupos, setGrupos] = useState<GrupoItem[]>([]);

  // Delete confirmation
  const [deleteTarget, setDeleteTarget] = useState<{ type: "lista" | "grupo" | "contato"; id: string; nome: string; count?: number } | null>(null);

  // Import modal
  const [showImportModal, setShowImportModal] = useState(false);
  const [importTipo, setImportTipo] = useState<"lista" | "grupo">("lista");

  // Contatos individuais
  const [contatos, setContatos] = useState<ContatoUnico[]>([]);
  const [buscaContato, setBuscaContato] = useState("");
  const [loadingContatos, setLoadingContatos] = useState(false);
  const [showAddContato, setShowAddContato] = useState(false);
  const [novoNome, setNovoNome] = useState("");
  const [novoTelefone, setNovoTelefone] = useState("");
  const [addingContato, setAddingContato] = useState(false);

  // Envios programados
  const [enviosAberto, setEnviosAberto] = useState(false);

  // Criar lista manual
  const [showCriarLista, setShowCriarLista] = useState(false);
  const [novaListaNome, setNovaListaNome] = useState("");
  const [novaListaDesc, setNovaListaDesc] = useState("");
  const [criandoLista, setCriandoLista] = useState(false);

  // Criar grupo manual
  const [showCriarGrupo, setShowCriarGrupo] = useState(false);

  useEffect(() => {
    loadUser();
  }, []);

  const loadUser = async () => {
    const { data } = await supabase.auth.getUser();
    if (data.user) {
      setUserId(data.user.id);
    }
  };

  useEffect(() => {
    if (userId) loadAll();
  }, [userId]);

  const loadAll = async () => {
    setLoading(true);
    await Promise.all([loadListas(), loadGrupos(), loadContatos()]);
    setLoading(false);
  };

  const loadListas = async () => {
    const { data } = await supabase
      .from("pj_listas_categoria")
      .select("id, nome, total_membros, created_at")
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
    // Dedupe by telefone
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
    if (expandedLista === listaId) {
      setExpandedLista(null);
      return;
    }
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

  // Delete handlers
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
      }
    } catch (err: any) {
      toast.error("Erro ao deletar: " + err.message);
    }
    setDeleteTarget(null);
  };

  const handleAddContato = async () => {
    if (!novoTelefone.trim()) {
      toast.error("Preencha o telefone");
      return;
    }
    setAddingContato(true);
    try {
      // Get or create a default list for individual contacts
      let defaultListaId: string;
      const { data: existingList } = await supabase
        .from("pj_listas_categoria")
        .select("id")
        .eq("user_id", userId)
        .eq("nome", "Contatos Individuais")
        .single();

      if (existingList) {
        defaultListaId = existingList.id;
      } else {
        const { data: newList, error } = await supabase
          .from("pj_listas_categoria")
          .insert({
            user_id: userId,
            nome: "Contatos Individuais",
            descricao: "Contatos adicionados individualmente",
            ativa: true,
            total_membros: 0,
          })
          .select("id")
          .single();
        if (error) throw error;
        defaultListaId = newList!.id;
      }

      const { error } = await supabase.from("pj_lista_membros").insert({
        lista_id: defaultListaId,
        nome: novoNome.trim() || null,
        telefone: novoTelefone.trim(),
      });
      if (error) throw error;

      // Update total
      await supabase.rpc("atualizar_total_membros_lista" as any);
      
      toast.success("Contato adicionado!");
      setNovoNome("");
      setNovoTelefone("");
      setShowAddContato(false);
      await Promise.all([loadContatos(), loadListas()]);
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
    setAddingContato(false);
  };

  // Debounced search for contacts
  const filteredContatos = buscaContato.length >= 2
    ? contatos.filter(
        (c) =>
          c.nome?.toLowerCase().includes(buscaContato.toLowerCase()) ||
          c.telefone.includes(buscaContato)
      )
    : contatos;

  const handleCriarLista = async () => {
    if (!novaListaNome.trim()) {
      toast.error("Digite o nome da lista");
      return;
    }
    setCriandoLista(true);
    try {
      const { error } = await supabase.from("pj_listas_categoria").insert({
        user_id: userId,
        nome: novaListaNome.trim(),
        descricao: novaListaDesc.trim() || null,
        ativa: true,
        total_membros: 0,
      });
      if (error) throw error;
      toast.success(`Lista "${novaListaNome}" criada!`);
      setNovaListaNome("");
      setNovaListaDesc("");
      setShowCriarLista(false);
      await loadListas();
    } catch (err: any) {
      toast.error("Erro: " + err.message);
    }
    setCriandoLista(false);
  };

  const openImport = (tipo: "lista" | "grupo") => {
    setImportTipo(tipo);
    setShowImportModal(true);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* PARTE 1 — Duas colunas */}
      <div className="grid gap-6 md:grid-cols-2">
        {/* COLUNA ESQUERDA — Listas de Transmissão */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              📋 Listas de Transmissão
              <Badge variant="outline" className="bg-orange-100 text-orange-700 border-orange-200 text-[10px]">
                ⚠️ Máx 256
              </Badge>
            </h3>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setShowCriarLista(true)}>
                <Plus className="h-4 w-4 mr-1" /> Criar
              </Button>
              <Button size="sm" variant="outline" onClick={() => openImport("lista")}>
                <Users className="h-4 w-4 mr-1" /> Importar
              </Button>
            </div>
          </div>

          {listas.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                <p>Nenhuma lista criada ainda.</p>
                <Button size="sm" variant="link" onClick={() => openImport("lista")}>
                  Criar primeira lista
                </Button>
              </CardContent>
            </Card>
          ) : (
            listas.map((lista) => (
              <Card key={lista.id} className="border-border/50">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{lista.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {lista.total_membros} contatos • {new Date(lista.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      <Button size="icon" variant="ghost" className="h-8 w-8" onClick={() => loadListaMembros(lista.id)}>
                        <Eye className="h-4 w-4" />
                      </Button>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ type: "lista", id: lista.id, nome: lista.nome, count: lista.total_membros })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                  {expandedLista === lista.id && (
                    <div className="mt-3 border-t pt-3 max-h-40 overflow-y-auto space-y-1">
                      {loadingMembros ? (
                        <Loader2 className="h-4 w-4 animate-spin mx-auto" />
                      ) : listaMembros.length === 0 ? (
                        <p className="text-xs text-muted-foreground text-center">Lista vazia</p>
                      ) : (
                        listaMembros.map((m) => (
                          <div key={m.id} className="flex justify-between text-xs py-1">
                            <span>{m.nome || "(Sem nome)"}</span>
                            <span className="text-muted-foreground font-mono">{m.telefone}</span>
                          </div>
                        ))
                      )}
                    </div>
                  )}
                </CardContent>
              </Card>
            ))
          )}
        </div>

        {/* COLUNA DIREITA — Grupos WhatsApp */}
        <div className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-base font-semibold flex items-center gap-2">
              👥 Grupos WhatsApp
              <Badge variant="outline" className="bg-green-100 text-green-700 border-green-200 text-[10px]">
                ✅ Ilimitado
              </Badge>
            </h3>
            <div className="flex gap-1">
              <Button size="sm" variant="outline" onClick={() => setShowCriarGrupo(true)}>
                <Plus className="h-4 w-4 mr-1" /> Criar
              </Button>
              <Button size="sm" variant="outline" onClick={() => openImport("grupo")}>
                <Users className="h-4 w-4 mr-1" /> Importar
              </Button>
            </div>
          </div>

          {grupos.length === 0 ? (
            <Card className="border-dashed">
              <CardContent className="py-8 text-center text-sm text-muted-foreground">
                <p>Nenhum grupo criado ainda.</p>
                <Button size="sm" variant="link" onClick={() => openImport("grupo")}>
                  Criar primeiro grupo
                </Button>
              </CardContent>
            </Card>
          ) : (
            grupos.map((grupo) => (
              <Card key={grupo.id} className="border-border/50">
                <CardContent className="py-3 px-4">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="font-medium text-sm">{grupo.nome}</p>
                      <p className="text-xs text-muted-foreground">
                        {grupo.participantes_count} membros • {new Date(grupo.created_at).toLocaleDateString("pt-BR")}
                      </p>
                    </div>
                    <div className="flex gap-1">
                      {grupo.invite_link && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="h-8 w-8"
                          onClick={() => {
                            navigator.clipboard.writeText(grupo.invite_link!);
                            toast.success("Link copiado!");
                          }}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                      )}
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-8 w-8 text-destructive hover:text-destructive"
                        onClick={() => setDeleteTarget({ type: "grupo", id: grupo.id, nome: grupo.nome })}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))
          )}
        </div>
      </div>

      {/* PARTE 2 — Contatos Individuais */}
      <div className="space-y-3">
        <div className="flex items-center justify-between">
          <h3 className="text-base font-semibold">👤 Contatos Individuais</h3>
          <Button size="sm" variant="outline" onClick={() => setShowAddContato(true)}>
            <Plus className="h-4 w-4 mr-1" /> Adicionar
          </Button>
        </div>

        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Buscar por nome ou telefone..."
            value={buscaContato}
            onChange={(e) => setBuscaContato(e.target.value)}
            className="pl-9"
          />
        </div>

        <Card>
          <CardContent className="p-0">
            <div className="max-h-60 overflow-y-auto">
              {filteredContatos.length === 0 ? (
                <p className="text-sm text-muted-foreground text-center py-6">
                  {buscaContato ? "Nenhum contato encontrado." : "Nenhum contato cadastrado."}
                </p>
              ) : (
                <table className="w-full text-sm">
                  <thead className="border-b bg-muted/30 sticky top-0">
                    <tr>
                      <th className="text-left p-3 font-medium">Nome</th>
                      <th className="text-left p-3 font-medium">Telefone</th>
                      <th className="w-12 p-3"></th>
                    </tr>
                  </thead>
                  <tbody>
                    {filteredContatos.map((c) => (
                      <tr key={c.id} className="border-b last:border-0 hover:bg-muted/20">
                        <td className="p-3">{c.nome || "(Sem nome)"}</td>
                        <td className="p-3 font-mono text-muted-foreground">{c.telefone}</td>
                        <td className="p-3">
                          <Button
                            size="icon"
                            variant="ghost"
                            className="h-7 w-7 text-destructive hover:text-destructive"
                            onClick={() => setDeleteTarget({ type: "contato", id: c.id, nome: c.nome || c.telefone })}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </Button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

      {/* PARTE 3 — Envios Programados (colapsável) */}
      <Collapsible open={enviosAberto} onOpenChange={setEnviosAberto}>
        <CollapsibleTrigger asChild>
          <Button variant="ghost" className="w-full justify-between text-muted-foreground">
            <span className="flex items-center gap-2">📅 Envios Programados</span>
            <ChevronDown className={`h-4 w-4 transition-transform ${enviosAberto ? "rotate-180" : ""}`} />
          </Button>
        </CollapsibleTrigger>
        <CollapsibleContent className="pt-2">
          <EnviosProgramadosPJ />
        </CollapsibleContent>
      </Collapsible>

      {/* MODAL — Importar Contatos */}
      <Dialog open={showImportModal} onOpenChange={(open) => { setShowImportModal(open); if (!open) loadAll(); }}>
        <DialogContent className="max-w-3xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {importTipo === "lista" ? "📋 Nova Lista de Transmissão" : "👥 Novo Grupo WhatsApp"}
            </DialogTitle>
          </DialogHeader>
          <ImportContatosPJ />
        </DialogContent>
      </Dialog>

      {/* MODAL — Adicionar Contato Individual */}
      <Dialog open={showAddContato} onOpenChange={setShowAddContato}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>Adicionar Contato</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <Input placeholder="Nome (opcional)" value={novoNome} onChange={(e) => setNovoNome(e.target.value)} />
            <Input placeholder="Telefone (ex: 5511999998888)" value={novoTelefone} onChange={(e) => setNovoTelefone(e.target.value)} />
            <Button className="w-full" onClick={handleAddContato} disabled={addingContato}>
              {addingContato ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Adicionar
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL — Criar Lista Manual */}
      <Dialog open={showCriarLista} onOpenChange={setShowCriarLista}>
        <DialogContent className="max-w-sm">
          <DialogHeader>
            <DialogTitle>📋 Criar Lista de Transmissão</DialogTitle>
          </DialogHeader>
          <div className="space-y-3 pt-2">
            <div className="space-y-1">
              <Label>Nome da Lista</Label>
              <Input
                placeholder="Ex: Clientes VIP"
                value={novaListaNome}
                onChange={(e) => setNovaListaNome(e.target.value)}
              />
            </div>
            <div className="space-y-1">
              <Label>Descrição (opcional)</Label>
              <Textarea
                placeholder="Descrição da lista..."
                value={novaListaDesc}
                onChange={(e) => setNovaListaDesc(e.target.value)}
                className="min-h-[60px]"
              />
            </div>
            <Button className="w-full" onClick={handleCriarLista} disabled={criandoLista || !novaListaNome.trim()}>
              {criandoLista ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Plus className="h-4 w-4 mr-2" />}
              Criar Lista
            </Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* MODAL — Criar Grupo WhatsApp Manual */}
      <Dialog open={showCriarGrupo} onOpenChange={(open) => { setShowCriarGrupo(open); if (!open) loadGrupos(); }}>
        <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>👥 Criar Grupo WhatsApp</DialogTitle>
          </DialogHeader>
          <CriarGrupoWhatsAppPJ />
        </DialogContent>
      </Dialog>

      {/* ALERT — Confirmação de Exclusão */}
      <AlertDialog open={!!deleteTarget} onOpenChange={(open) => !open && setDeleteTarget(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Tem certeza?</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteTarget?.type === "lista"
                ? `Isso remove a lista "${deleteTarget.nome}" e todos os ${deleteTarget.count || 0} contatos.`
                : deleteTarget?.type === "grupo"
                ? `Isso remove o grupo "${deleteTarget.nome}" permanentemente.`
                : `Isso remove o contato "${deleteTarget?.nome}".`}
              <br />
              Esta ação não pode ser desfeita.
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
