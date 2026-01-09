import { useState, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { format } from "date-fns";
import { ptBR } from "date-fns/locale";
import {
  ArrowLeft,
  Plus,
  Users,
  Link as LinkIcon,
  Copy,
  Send,
  RefreshCw,
  MessageSquare,
  Loader2,
  Trash2,
  Lock,
  Unlock,
  Eye,
  CheckCircle,
  XCircle,
  Crown,
  User,
  Pencil
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ScrollArea } from "@/components/ui/scroll-area";

interface Grupo {
  id: string;
  group_jid: string;
  group_name: string;
  categoria: string | null;
  invite_link: string | null;
  member_count: number;
  ativo: boolean;
  is_announce: boolean;
  created_at: string;
}

interface Participant {
  jid: string;
  phone: string;
  isAdmin: boolean;
  isSuperAdmin: boolean;
}

interface HistoricoEnvio {
  id: string;
  whatsapp: string;
  tipo: string;
  mensagem: string;
  sucesso: boolean;
  erro: string | null;
  timestamp: string;
}

const CATEGORIAS = [
  { value: "casa", label: "🏠 Casa & Decoração" },
  { value: "beleza", label: "💄 Beleza & Cuidados" },
  { value: "eletronicos", label: "📱 Eletrônicos" },
  { value: "moda", label: "👗 Moda & Acessórios" },
  { value: "esportes", label: "⚽ Esportes & Lazer" },
  { value: "geral", label: "🎁 Ofertas Gerais" },
];

export default function AfiliadoGruposWhatsApp() {
  const navigate = useNavigate();
  const [grupos, setGrupos] = useState<Grupo[]>([]);
  const [loading, setLoading] = useState(true);
  const [syncing, setSyncing] = useState(false);
  const [creating, setCreating] = useState(false);
  const [userId, setUserId] = useState<string | null>(null);
  
  // Modal criar grupo
  const [modalOpen, setModalOpen] = useState(false);
  const [novoGrupoNome, setNovoGrupoNome] = useState("");
  const [novoGrupoCategoria, setNovoGrupoCategoria] = useState("geral");
  
  // Modal enviar mensagem
  const [enviarModalOpen, setEnviarModalOpen] = useState(false);
  const [grupoSelecionado, setGrupoSelecionado] = useState<Grupo | null>(null);
  const [mensagem, setMensagem] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [enviando, setEnviando] = useState(false);
  
  // Modal inserir link manualmente
  const [linkModalOpen, setLinkModalOpen] = useState(false);
  const [grupoParaLink, setGrupoParaLink] = useState<Grupo | null>(null);
  const [linkManual, setLinkManual] = useState("");
  const [salvandoLink, setSalvandoLink] = useState(false);
  const [alterandoConfig, setAlterandoConfig] = useState<string | null>(null);

  // Modal detalhes do grupo
  const [detalhesModalOpen, setDetalhesModalOpen] = useState(false);
  const [grupoDetalhes, setGrupoDetalhes] = useState<Grupo | null>(null);
  const [participants, setParticipants] = useState<Participant[]>([]);
  const [historicoEnvios, setHistoricoEnvios] = useState<HistoricoEnvio[]>([]);
  const [loadingParticipants, setLoadingParticipants] = useState(false);
  const [loadingHistorico, setLoadingHistorico] = useState(false);

  // Modal editar nome do grupo
  const [editarNomeModalOpen, setEditarNomeModalOpen] = useState(false);
  const [grupoParaEditar, setGrupoParaEditar] = useState<Grupo | null>(null);
  const [novoNomeGrupo, setNovoNomeGrupo] = useState("");
  const [salvandoNome, setSalvandoNome] = useState(false);

  const abrirEditarNomeModal = (grupo: Grupo) => {
    setGrupoParaEditar(grupo);
    setNovoNomeGrupo(grupo.group_name);
    setEditarNomeModalOpen(true);
  };

  const salvarNovoNome = async () => {
    if (!grupoParaEditar || !novoNomeGrupo.trim()) {
      toast.error("Digite o novo nome do grupo");
      return;
    }

    setSalvandoNome(true);
    try {
      const { error } = await supabase
        .from("whatsapp_grupos_afiliado")
        .update({ group_name: novoNomeGrupo.trim() })
        .eq("id", grupoParaEditar.id);

      if (error) throw error;

      toast.success("Nome do grupo atualizado!");
      setGrupos(prev => prev.map(g => 
        g.id === grupoParaEditar.id ? { ...g, group_name: novoNomeGrupo.trim() } : g
      ));
      setEditarNomeModalOpen(false);
    } catch (error: any) {
      console.error("Erro ao salvar nome:", error);
      toast.error("Erro ao atualizar nome");
    } finally {
      setSalvandoNome(false);
    }
  };

  const abrirLinkModal = (grupo: Grupo) => {
    setGrupoParaLink(grupo);
    setLinkManual(grupo.invite_link || "");
    setLinkModalOpen(true);
  };

  const abrirDetalhesModal = async (grupo: Grupo) => {
    setGrupoDetalhes(grupo);
    setDetalhesModalOpen(true);
    setParticipants([]);
    setHistoricoEnvios([]);
    
    // Carregar participantes e histórico em paralelo
    carregarParticipantes(grupo);
    carregarHistorico(grupo.group_jid);
  };

  const carregarParticipantes = async (grupo: Grupo) => {
    if (!userId) return;
    setLoadingParticipants(true);
    try {
      const { data, error } = await supabase.functions.invoke("get-group-participants", {
        body: { groupJid: grupo.group_jid, userId }
      });

      if (error) throw error;

      if (data.success) {
        setParticipants(data.participants || []);
        // Atualizar contagem local
        setGrupos(prev => prev.map(g => 
          g.id === grupo.id ? { ...g, member_count: data.totalMembers } : g
        ));
      }
    } catch (error: any) {
      console.error("Erro ao carregar participantes:", error);
      toast.error("Erro ao carregar membros");
    } finally {
      setLoadingParticipants(false);
    }
  };

  const carregarHistorico = async (groupJid: string) => {
    setLoadingHistorico(true);
    try {
      const { data, error } = await supabase
        .from("historico_envios")
        .select("*")
        .eq("whatsapp", groupJid)
        .order("timestamp", { ascending: false })
        .limit(50);

      if (error) throw error;
      setHistoricoEnvios(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar histórico:", error);
    } finally {
      setLoadingHistorico(false);
    }
  };

  const toggleAnnounce = async (grupo: Grupo) => {
    if (!userId) return;
    
    setAlterandoConfig(grupo.id);
    try {
      const action = grupo.is_announce ? "not_announce" : "announce";
      const { data, error } = await supabase.functions.invoke("group-settings-afiliado", {
        body: {
          groupJid: grupo.group_jid,
          action,
          userId
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success(grupo.is_announce 
          ? "Grupo desbloqueado! Todos podem enviar mensagens." 
          : "Grupo bloqueado! Só admins podem enviar.");
        setGrupos(prev => prev.map(g => 
          g.id === grupo.id ? { ...g, is_announce: !grupo.is_announce } : g
        ));
      } else {
        throw new Error(data.error || "Erro ao alterar configuração");
      }
    } catch (error: any) {
      console.error("Erro ao alterar grupo:", error);
      toast.error(error.message || "Erro ao alterar configuração");
    } finally {
      setAlterandoConfig(null);
    }
  };

  const salvarLinkManual = async () => {
    if (!grupoParaLink || !linkManual.trim()) {
      toast.error("Cole o link de convite");
      return;
    }

    if (!linkManual.includes("chat.whatsapp.com")) {
      toast.error("Link inválido. O link deve conter 'chat.whatsapp.com'");
      return;
    }

    setSalvandoLink(true);
    try {
      const { error } = await supabase
        .from("whatsapp_grupos_afiliado")
        .update({ invite_link: linkManual.trim() })
        .eq("id", grupoParaLink.id);

      if (error) throw error;

      toast.success("Link salvo com sucesso!");
      setGrupos(prev => prev.map(g => 
        g.id === grupoParaLink.id ? { ...g, invite_link: linkManual.trim() } : g
      ));
      setLinkModalOpen(false);
    } catch (error: any) {
      console.error("Erro ao salvar link:", error);
      toast.error("Erro ao salvar link");
    } finally {
      setSalvandoLink(false);
    }
  };
  useEffect(() => {
    checkUser();
  }, []);

  const checkUser = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      loadGrupos(user.id);
    } else {
      navigate("/login");
    }
  };

  const loadGrupos = async (uid: string) => {
    setLoading(true);
    try {
      const { data, error } = await supabase
        .from("whatsapp_grupos_afiliado")
        .select("*")
        .eq("user_id", uid)
        .eq("ativo", true)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setGrupos(data || []);
    } catch (error: any) {
      console.error("Erro ao carregar grupos:", error);
      toast.error("Erro ao carregar grupos");
    } finally {
      setLoading(false);
    }
  };

  const syncGrupos = async () => {
    if (!userId) return;
    setSyncing(true);
    try {
      const { data, error } = await supabase.functions.invoke("list-whatsapp-groups", {
        body: { userId, syncFromWhatsApp: true }
      });

      if (error) throw error;
      
      setGrupos(data.grupos || []);
      toast.success("Grupos sincronizados!");
    } catch (error: any) {
      console.error("Erro ao sincronizar:", error);
      toast.error("Erro ao sincronizar grupos");
    } finally {
      setSyncing(false);
    }
  };

  const criarGrupo = async () => {
    if (!userId || !novoGrupoNome.trim()) {
      toast.error("Digite o nome do grupo");
      return;
    }

    setCreating(true);
    try {
      const { data, error } = await supabase.functions.invoke("create-whatsapp-group", {
        body: {
          groupName: novoGrupoNome.trim(),
          categoria: novoGrupoCategoria,
          userId
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Grupo criado com sucesso!");
        setModalOpen(false);
        setNovoGrupoNome("");
        loadGrupos(userId);
      } else {
        throw new Error(data.error || "Erro ao criar grupo");
      }
    } catch (error: any) {
      console.error("Erro ao criar grupo:", error);
      toast.error(error.message || "Erro ao criar grupo");
    } finally {
      setCreating(false);
    }
  };

  const copiarLink = (link: string) => {
    navigator.clipboard.writeText(link);
    toast.success("Link copiado!");
  };

  const abrirEnviarModal = (grupo: Grupo) => {
    setGrupoSelecionado(grupo);
    setMensagem("");
    setImageUrl("");
    setEnviarModalOpen(true);
  };

  const enviarMensagem = async () => {
    if (!userId || !grupoSelecionado || !mensagem.trim()) {
      toast.error("Digite a mensagem");
      return;
    }

    setEnviando(true);
    try {
      const { data, error } = await supabase.functions.invoke("send-wuzapi-group-message", {
        body: {
          groupJid: grupoSelecionado.group_jid,
          message: mensagem.trim(),
          imageUrl: imageUrl.trim() || undefined,
          userId
        }
      });

      if (error) throw error;

      if (data.success) {
        toast.success("Mensagem enviada para o grupo!");
        setEnviarModalOpen(false);
      } else {
        throw new Error(data.error || "Erro ao enviar");
      }
    } catch (error: any) {
      console.error("Erro ao enviar:", error);
      toast.error(error.message || "Erro ao enviar mensagem");
    } finally {
      setEnviando(false);
    }
  };

  const excluirGrupo = async (grupo: Grupo) => {
    if (!confirm(`Deseja remover o grupo "${grupo.group_name}" do sistema? (O grupo não será excluído do WhatsApp)`)) {
      return;
    }

    try {
      const { error } = await supabase
        .from("whatsapp_grupos_afiliado")
        .update({ ativo: false })
        .eq("id", grupo.id);

      if (error) throw error;
      
      toast.success("Grupo removido do sistema");
      setGrupos(prev => prev.filter(g => g.id !== grupo.id));
    } catch (error: any) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir grupo");
    }
  };

  const getCategoriaLabel = (cat: string | null) => {
    const found = CATEGORIAS.find(c => c.value === cat);
    return found?.label || "🎁 Geral";
  };

  return (
    <div className="min-h-screen bg-background p-4 md:p-6">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <Button variant="ghost" size="icon" onClick={() => navigate(-1)}>
              <ArrowLeft className="h-5 w-5" />
            </Button>
            <div>
              <h1 className="text-2xl font-bold">Grupos WhatsApp</h1>
              <p className="text-sm text-muted-foreground">
                Gerencie seus grupos para envio de ofertas
              </p>
            </div>
          </div>

          <div className="flex gap-2">
            <Button variant="outline" onClick={syncGrupos} disabled={syncing}>
              {syncing ? (
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
              ) : (
                <RefreshCw className="h-4 w-4 mr-2" />
              )}
              Sincronizar
            </Button>

            <Dialog open={modalOpen} onOpenChange={setModalOpen}>
              <DialogTrigger asChild>
                <Button>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Grupo
                </Button>
              </DialogTrigger>
              <DialogContent>
                <DialogHeader>
                  <DialogTitle>Criar Novo Grupo</DialogTitle>
                </DialogHeader>
                <div className="space-y-4 mt-4">
                  <div>
                    <Label>Nome do Grupo</Label>
                    <Input
                      placeholder="Ex: 🔥 Ofertas Casa & Decoração"
                      value={novoGrupoNome}
                      onChange={(e) => setNovoGrupoNome(e.target.value)}
                    />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select value={novoGrupoCategoria} onValueChange={setNovoGrupoCategoria}>
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {CATEGORIAS.map(cat => (
                          <SelectItem key={cat.value} value={cat.value}>
                            {cat.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <Button 
                    className="w-full" 
                    onClick={criarGrupo}
                    disabled={creating}
                  >
                    {creating ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : (
                      <Plus className="h-4 w-4 mr-2" />
                    )}
                    Criar Grupo
                  </Button>
                </div>
              </DialogContent>
            </Dialog>
          </div>
        </div>

        {/* Info Card */}
        <Card className="mb-6 bg-green-50 border-green-200 dark:bg-green-950 dark:border-green-800">
          <CardContent className="p-4">
            <div className="flex items-start gap-3">
              <Users className="h-5 w-5 text-green-600 mt-0.5" />
              <div>
                <p className="font-medium text-green-800 dark:text-green-200">
                  Por que usar grupos?
                </p>
                <p className="text-sm text-green-700 dark:text-green-300">
                  Enviar para grupos é mais seguro! Uma mensagem atinge todos os membros, 
                  reduzindo o risco de bloqueio. Leads entram voluntariamente via link de convite.
                </p>
              </div>
            </div>
          </CardContent>
        </Card>

        {/* Lista de Grupos */}
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
          </div>
        ) : grupos.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <Users className="h-12 w-12 mx-auto text-muted-foreground mb-4" />
              <h3 className="text-lg font-medium mb-2">Nenhum grupo cadastrado</h3>
              <p className="text-muted-foreground mb-4">
                Crie seu primeiro grupo ou sincronize grupos existentes do WhatsApp
              </p>
              <div className="flex gap-2 justify-center">
                <Button variant="outline" onClick={syncGrupos}>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  Sincronizar do WhatsApp
                </Button>
                <Button onClick={() => setModalOpen(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Criar Grupo
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
            {grupos.map((grupo) => (
              <Card key={grupo.id} className="hover:shadow-md transition-shadow">
                <CardHeader className="pb-2">
                  <div className="flex items-start justify-between">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <CardTitle className="text-lg truncate">{grupo.group_name}</CardTitle>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-7 w-7 text-muted-foreground hover:text-foreground shrink-0"
                        onClick={() => abrirEditarNomeModal(grupo)}
                        title="Editar nome"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="h-8 w-8 text-destructive hover:text-destructive shrink-0"
                      onClick={() => excluirGrupo(grupo)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                  <div className="flex gap-2 flex-wrap">
                    <Badge variant="secondary">
                      {getCategoriaLabel(grupo.categoria)}
                    </Badge>
                    {grupo.is_announce && (
                      <Badge variant="outline" className="text-orange-600 border-orange-300">
                        <Lock className="h-3 w-3 mr-1" />
                        Só Admins
                      </Badge>
                    )}
                  </div>
                </CardHeader>
                <CardContent className="space-y-3">
                  <div className="flex items-center gap-2 text-sm text-muted-foreground">
                    <Users className="h-4 w-4" />
                    <span>{grupo.member_count} membros</span>
                  </div>

                  {grupo.invite_link && (
                    <div className="flex items-center gap-2">
                      <Input
                        value={grupo.invite_link}
                        readOnly
                        className="text-xs h-8"
                      />
                      <Button
                        variant="outline"
                        size="icon"
                        className="h-8 w-8 shrink-0"
                        onClick={() => copiarLink(grupo.invite_link!)}
                      >
                        <Copy className="h-4 w-4" />
                      </Button>
                    </div>
                  )}

                  {/* Botão bloquear/desbloquear */}
                  <Button
                    variant={grupo.is_announce ? "default" : "outline"}
                    size="sm"
                    className="w-full"
                    onClick={() => toggleAnnounce(grupo)}
                    disabled={alterandoConfig === grupo.id}
                  >
                    {alterandoConfig === grupo.id ? (
                      <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    ) : grupo.is_announce ? (
                      <Unlock className="h-4 w-4 mr-2" />
                    ) : (
                      <Lock className="h-4 w-4 mr-2" />
                    )}
                    {grupo.is_announce ? "Desbloquear Grupo" : "Bloquear (Só Admins)"}
                  </Button>

                  {/* Botão ver detalhes */}
                  <Button
                    variant="outline"
                    size="sm"
                    className="w-full"
                    onClick={() => abrirDetalhesModal(grupo)}
                  >
                    <Eye className="h-4 w-4 mr-2" />
                    Ver Membros & Envios
                  </Button>

                  <div className="flex gap-2 pt-2">
                    {grupo.invite_link ? (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => copiarLink(grupo.invite_link!)}
                      >
                        <Copy className="h-4 w-4 mr-1" />
                        Copiar Link
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => abrirLinkModal(grupo)}
                      >
                        <LinkIcon className="h-4 w-4 mr-1" />
                        Inserir Link
                      </Button>
                    )}
                    <Button
                      size="sm"
                      className="flex-1"
                      onClick={() => abrirEnviarModal(grupo)}
                    >
                      <Send className="h-4 w-4 mr-1" />
                      Enviar
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* Modal Inserir Link */}
        <Dialog open={linkModalOpen} onOpenChange={setLinkModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <LinkIcon className="h-5 w-5" />
                Inserir Link de Convite
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <p className="text-sm text-muted-foreground">
                Copie o link de convite do grupo no seu celular (WhatsApp → Grupo → Dados do Grupo → Convidar via link) e cole abaixo:
              </p>
              <div>
                <Label>Link de Convite</Label>
                <Input
                  placeholder="https://chat.whatsapp.com/..."
                  value={linkManual}
                  onChange={(e) => setLinkManual(e.target.value)}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={salvarLinkManual}
                disabled={salvandoLink || !linkManual.trim()}
              >
                {salvandoLink ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <LinkIcon className="h-4 w-4 mr-2" />
                )}
                Salvar Link
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Editar Nome do Grupo */}
        <Dialog open={editarNomeModalOpen} onOpenChange={setEditarNomeModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Pencil className="h-5 w-5" />
                Editar Nome do Grupo
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Nome do Grupo</Label>
                <Input
                  placeholder="Digite o novo nome..."
                  value={novoNomeGrupo}
                  onChange={(e) => setNovoNomeGrupo(e.target.value)}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={salvarNovoNome}
                disabled={salvandoNome || !novoNomeGrupo.trim()}
              >
                {salvandoNome ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Pencil className="h-4 w-4 mr-2" />
                )}
                Salvar Nome
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Enviar Mensagem */}
        <Dialog open={enviarModalOpen} onOpenChange={setEnviarModalOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <MessageSquare className="h-5 w-5" />
                Enviar para {grupoSelecionado?.group_name}
              </DialogTitle>
            </DialogHeader>
            <div className="space-y-4 mt-4">
              <div>
                <Label>Mensagem</Label>
                <Textarea
                  placeholder="Digite sua mensagem..."
                  value={mensagem}
                  onChange={(e) => setMensagem(e.target.value)}
                  rows={4}
                />
              </div>
              <div>
                <Label>URL da Imagem (opcional)</Label>
                <Input
                  placeholder="https://..."
                  value={imageUrl}
                  onChange={(e) => setImageUrl(e.target.value)}
                />
              </div>
              <Button 
                className="w-full" 
                onClick={enviarMensagem}
                disabled={enviando || !mensagem.trim()}
              >
                {enviando ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <Send className="h-4 w-4 mr-2" />
                )}
                Enviar Mensagem
              </Button>
            </div>
          </DialogContent>
        </Dialog>

        {/* Modal Detalhes do Grupo */}
        <Dialog open={detalhesModalOpen} onOpenChange={setDetalhesModalOpen}>
          <DialogContent className="max-w-2xl max-h-[80vh]">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Users className="h-5 w-5" />
                {grupoDetalhes?.group_name}
              </DialogTitle>
            </DialogHeader>
            
            <Tabs defaultValue="membros" className="mt-4">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="membros" className="flex items-center gap-2">
                  <Users className="h-4 w-4" />
                  Membros ({participants.length})
                </TabsTrigger>
                <TabsTrigger value="historico" className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4" />
                  Envios ({historicoEnvios.length})
                </TabsTrigger>
              </TabsList>

              <TabsContent value="membros" className="mt-4">
                {loadingParticipants ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : participants.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <Users className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum membro encontrado</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {participants.map((p, index) => (
                        <div 
                          key={p.jid || index}
                          className="flex items-center justify-between p-3 rounded-lg border bg-card"
                        >
                          <div className="flex items-center gap-3">
                            <div className="h-10 w-10 rounded-full bg-muted flex items-center justify-center">
                              {p.isSuperAdmin ? (
                                <Crown className="h-5 w-5 text-yellow-500" />
                              ) : p.isAdmin ? (
                                <Crown className="h-5 w-5 text-blue-500" />
                              ) : (
                                <User className="h-5 w-5 text-muted-foreground" />
                              )}
                            </div>
                            <div>
                              <p className="font-medium">+{p.phone}</p>
                              {(p.isAdmin || p.isSuperAdmin) && (
                                <Badge variant="outline" className="text-xs">
                                  {p.isSuperAdmin ? "Super Admin" : "Admin"}
                                </Badge>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>

              <TabsContent value="historico" className="mt-4">
                {loadingHistorico ? (
                  <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
                  </div>
                ) : historicoEnvios.length === 0 ? (
                  <div className="text-center py-8 text-muted-foreground">
                    <MessageSquare className="h-8 w-8 mx-auto mb-2 opacity-50" />
                    <p>Nenhum envio registrado para este grupo</p>
                  </div>
                ) : (
                  <ScrollArea className="h-[400px]">
                    <div className="space-y-2">
                      {historicoEnvios.map((envio) => (
                        <div 
                          key={envio.id}
                          className="p-3 rounded-lg border bg-card space-y-2"
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex items-center gap-2">
                              {envio.sucesso ? (
                                <CheckCircle className="h-4 w-4 text-green-500" />
                              ) : (
                                <XCircle className="h-4 w-4 text-red-500" />
                              )}
                              <span className="text-sm font-medium">
                                {envio.sucesso ? "Enviado" : "Falhou"}
                              </span>
                            </div>
                            <span className="text-xs text-muted-foreground">
                              {format(new Date(envio.timestamp), "dd/MM/yyyy HH:mm", { locale: ptBR })}
                            </span>
                          </div>
                          <p className="text-sm text-muted-foreground line-clamp-2">
                            {envio.mensagem}
                          </p>
                          {envio.erro && (
                            <p className="text-xs text-red-500">
                              Erro: {envio.erro}
                            </p>
                          )}
                        </div>
                      ))}
                    </div>
                  </ScrollArea>
                )}
              </TabsContent>
            </Tabs>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
