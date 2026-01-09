import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Checkbox } from "@/components/ui/checkbox";
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
import {
  Megaphone,
  Pause,
  Play,
  Trash2,
  Clock,
  Calendar,
  Package,
  RefreshCw,
  CheckSquare,
  Square,
  XCircle,
  Loader2,
} from "lucide-react";
import { toast } from "sonner";

interface CampanhaAtiva {
  id: string;
  nome: string;
  produto_id: string;
  frequencia: string;
  horarios: string[];
  dias_semana: number[];
  proxima_execucao: string | null;
  ultima_execucao: string | null;
  total_enviados: number;
  ativa: boolean;
  status: string;
  produto?: {
    titulo: string;
    imagem_url: string | null;
    preco: number | null;
  };
}

const DIAS_SEMANA = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function GerenciarCampanhasAtivas() {
  const [campanhas, setCampanhas] = useState<CampanhaAtiva[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteMode, setDeleteMode] = useState<"single" | "selected" | "all">("single");
  const [singleDeleteId, setSingleDeleteId] = useState<string | null>(null);

  useEffect(() => {
    loadCampanhas();
  }, []);

  const loadCampanhas = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      // Buscar TODAS as campanhas (ativas e pausadas) para gerenciamento
      const { data, error } = await supabase
        .from("afiliado_campanhas")
        .select(`
          id, nome, produto_id, frequencia, horarios, dias_semana,
          proxima_execucao, ultima_execucao, total_enviados, ativa, status
        `)
        .eq("user_id", user.id)
        .order("created_at", { ascending: false });

      if (error) throw error;

      // Buscar dados dos produtos
      const produtoIds = [...new Set((data || []).map((c) => c.produto_id).filter(Boolean))];
      
      let produtosMap: Record<string, any> = {};
      if (produtoIds.length > 0) {
        const { data: produtos } = await supabase
          .from("afiliado_produtos")
          .select("id, titulo, imagem_url, preco")
          .in("id", produtoIds);
        
        produtosMap = (produtos || []).reduce((acc, p) => {
          acc[p.id] = p;
          return acc;
        }, {} as Record<string, any>);
      }

      // Mapear campanhas com produtos
      const campanhasComProdutos = (data || []).map((c) => ({
        ...c,
        produto: produtosMap[c.produto_id] || null,
      }));

      setCampanhas(campanhasComProdutos);
    } catch (error) {
      console.error("Erro ao carregar campanhas:", error);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  };

  const toggleSelect = (id: string) => {
    setSelectedIds((prev) =>
      prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id]
    );
  };

  const selectAll = () => {
    if (selectedIds.length === campanhas.length) {
      setSelectedIds([]);
    } else {
      setSelectedIds(campanhas.map((c) => c.id));
    }
  };

  const pausarCampanha = async (id: string) => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from("afiliado_campanhas")
        .update({ ativa: false, status: "pausada" })
        .eq("id", id);

      if (error) throw error;

      setCampanhas((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ativa: false, status: "pausada" } : c))
      );
      toast.success("Campanha pausada");
    } catch (error) {
      console.error("Erro ao pausar:", error);
      toast.error("Erro ao pausar campanha");
    } finally {
      setActionLoading(null);
    }
  };

  const ativarCampanha = async (id: string) => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from("afiliado_campanhas")
        .update({ ativa: true, status: "ativa" })
        .eq("id", id);

      if (error) throw error;

      setCampanhas((prev) =>
        prev.map((c) => (c.id === id ? { ...c, ativa: true, status: "ativa" } : c))
      );
      toast.success("Campanha ativada");
    } catch (error) {
      console.error("Erro ao ativar:", error);
      toast.error("Erro ao ativar campanha");
    } finally {
      setActionLoading(null);
    }
  };

  const deletarCampanha = async (id: string) => {
    try {
      const { error } = await supabase
        .from("afiliado_campanhas")
        .delete()
        .eq("id", id);

      if (error) throw error;

      setCampanhas((prev) => prev.filter((c) => c.id !== id));
      setSelectedIds((prev) => prev.filter((i) => i !== id));
      toast.success("Campanha excluída");
    } catch (error) {
      console.error("Erro ao excluir:", error);
      toast.error("Erro ao excluir campanha");
    }
  };

  const handleDeleteConfirm = async () => {
    setActionLoading("bulk");
    try {
      let idsToDelete: string[] = [];

      if (deleteMode === "single" && singleDeleteId) {
        idsToDelete = [singleDeleteId];
      } else if (deleteMode === "selected") {
        idsToDelete = selectedIds;
      } else if (deleteMode === "all") {
        idsToDelete = campanhas.map((c) => c.id);
      }

      for (const id of idsToDelete) {
        await deletarCampanha(id);
      }

      toast.success(`${idsToDelete.length} campanha(s) excluída(s)`);
    } catch (error) {
      console.error("Erro ao excluir em massa:", error);
      toast.error("Erro ao excluir campanhas");
    } finally {
      setActionLoading(null);
      setShowDeleteDialog(false);
      setSingleDeleteId(null);
    }
  };

  const pausarSelecionadas = async () => {
    setActionLoading("bulk");
    try {
      const { error } = await supabase
        .from("afiliado_campanhas")
        .update({ ativa: false, status: "pausada" })
        .in("id", selectedIds);

      if (error) throw error;

      setCampanhas((prev) =>
        prev.map((c) =>
          selectedIds.includes(c.id) ? { ...c, ativa: false, status: "pausada" } : c
        )
      );
      toast.success(`${selectedIds.length} campanha(s) pausada(s)`);
      setSelectedIds([]);
    } catch (error) {
      console.error("Erro ao pausar em massa:", error);
      toast.error("Erro ao pausar campanhas");
    } finally {
      setActionLoading(null);
    }
  };

  const pausarTodas = async () => {
    setActionLoading("bulk");
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { error } = await supabase
        .from("afiliado_campanhas")
        .update({ ativa: false, status: "pausada" })
        .eq("user_id", user.id)
        .eq("ativa", true);

      if (error) throw error;

      setCampanhas((prev) =>
        prev.map((c) => ({ ...c, ativa: false, status: "pausada" }))
      );
      toast.success("Todas as campanhas foram pausadas");
    } catch (error) {
      console.error("Erro ao pausar todas:", error);
      toast.error("Erro ao pausar campanhas");
    } finally {
      setActionLoading(null);
    }
  };

  const formatDate = (date: string | null) => {
    if (!date) return "-";
    return new Date(date).toLocaleString("pt-BR", {
      day: "2-digit",
      month: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getFrequenciaLabel = (freq: string) => {
    switch (freq) {
      case "diario":
        return "Diária";
      case "semanal":
        return "Semanal";
      case "uma_vez":
        return "Única";
      default:
        return freq;
    }
  };

  const campanhasAtivas = campanhas.filter((c) => c.ativa || c.status === "ativa");
  const campanhasPausadas = campanhas.filter((c) => !c.ativa && c.status !== "ativa");

  if (loading) {
    return (
      <Card>
        <CardContent className="flex items-center justify-center py-8">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Megaphone className="h-5 w-5 text-primary" />
            Campanhas Ativas ({campanhasAtivas.length})
          </CardTitle>
          <div className="flex items-center gap-2">
            <Button variant="outline" size="sm" onClick={loadCampanhas}>
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4">
        {/* Ações em massa */}
        {campanhas.length > 0 && (
          <div className="flex flex-wrap items-center gap-2 p-3 bg-muted/50 rounded-lg">
            <Button
              variant="outline"
              size="sm"
              onClick={selectAll}
              className="gap-1"
            >
              {selectedIds.length === campanhas.length ? (
                <CheckSquare className="h-4 w-4" />
              ) : (
                <Square className="h-4 w-4" />
              )}
              {selectedIds.length === campanhas.length ? "Desmarcar" : "Selecionar"} Todas
            </Button>

            {selectedIds.length > 0 && (
              <>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={async () => {
                    setActionLoading("bulk");
                    try {
                      const { error } = await supabase
                        .from("afiliado_campanhas")
                        .update({ ativa: true, status: "ativa" })
                        .in("id", selectedIds);
                      if (error) throw error;
                      setCampanhas((prev) =>
                        prev.map((c) =>
                          selectedIds.includes(c.id) ? { ...c, ativa: true, status: "ativa" } : c
                        )
                      );
                      toast.success(`${selectedIds.length} campanha(s) ativada(s)`);
                      setSelectedIds([]);
                    } catch (error) {
                      console.error("Erro ao ativar em massa:", error);
                      toast.error("Erro ao ativar campanhas");
                    } finally {
                      setActionLoading(null);
                    }
                  }}
                  disabled={actionLoading === "bulk"}
                  className="gap-1 text-green-600 border-green-200 hover:bg-green-50"
                >
                  <Play className="h-4 w-4" />
                  Ativar ({selectedIds.length})
                </Button>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={pausarSelecionadas}
                  disabled={actionLoading === "bulk"}
                  className="gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
                >
                  <Pause className="h-4 w-4" />
                  Pausar ({selectedIds.length})
                </Button>
                <Button
                  variant="destructive"
                  size="sm"
                  onClick={() => {
                    setDeleteMode("selected");
                    setShowDeleteDialog(true);
                  }}
                  disabled={actionLoading === "bulk"}
                  className="gap-1"
                >
                  <Trash2 className="h-4 w-4" />
                  Excluir ({selectedIds.length})
                </Button>
              </>
            )}

            <div className="flex-1" />

            <Button
              variant="outline"
              size="sm"
              onClick={async () => {
                setActionLoading("bulk");
                try {
                  const { data: { user } } = await supabase.auth.getUser();
                  if (!user) return;
                  const { error } = await supabase
                    .from("afiliado_campanhas")
                    .update({ ativa: true, status: "ativa" })
                    .eq("user_id", user.id)
                    .eq("ativa", false);
                  if (error) throw error;
                  setCampanhas((prev) => prev.map((c) => ({ ...c, ativa: true, status: "ativa" })));
                  toast.success("Todas as campanhas foram ativadas");
                } catch (error) {
                  console.error("Erro ao ativar todas:", error);
                  toast.error("Erro ao ativar campanhas");
                } finally {
                  setActionLoading(null);
                }
              }}
              disabled={actionLoading === "bulk" || campanhasPausadas.length === 0}
              className="gap-1 text-green-600 border-green-200 hover:bg-green-50"
            >
              <Play className="h-4 w-4" />
              Ativar Todas
            </Button>

            <Button
              variant="outline"
              size="sm"
              onClick={pausarTodas}
              disabled={actionLoading === "bulk" || campanhasAtivas.length === 0}
              className="gap-1 text-orange-600 border-orange-200 hover:bg-orange-50"
            >
              <Pause className="h-4 w-4" />
              Pausar Todas
            </Button>

            <Button
              variant="destructive"
              size="sm"
              onClick={() => {
                setDeleteMode("all");
                setShowDeleteDialog(true);
              }}
              disabled={actionLoading === "bulk" || campanhas.length === 0}
              className="gap-1"
            >
              <XCircle className="h-4 w-4" />
              Excluir Todas
            </Button>
          </div>
        )}

        {campanhas.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground">
            <Megaphone className="h-12 w-12 mx-auto mb-2 opacity-30" />
            <p>Nenhuma campanha ativa</p>
          </div>
        ) : (
          <ScrollArea className="h-[400px]">
            <div className="space-y-2">
              {campanhas.map((campanha) => (
                <div
                  key={campanha.id}
                  className={`flex items-center gap-3 p-3 rounded-lg border transition-colors ${
                    campanha.ativa || campanha.status === "ativa"
                      ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                      : "bg-muted/30 border-border"
                  }`}
                >
                  {/* Checkbox */}
                  <Checkbox
                    checked={selectedIds.includes(campanha.id)}
                    onCheckedChange={() => toggleSelect(campanha.id)}
                  />

                  {/* Imagem do produto */}
                  <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted flex-shrink-0">
                    {campanha.produto?.imagem_url ? (
                      <img
                        src={campanha.produto.imagem_url}
                        alt={campanha.produto.titulo}
                        className="w-full h-full object-cover"
                      />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <Package className="h-6 w-6 text-muted-foreground" />
                      </div>
                    )}
                  </div>

                  {/* Info da campanha */}
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm truncate">
                      {campanha.produto?.titulo || campanha.nome}
                    </p>
                    <div className="flex flex-wrap items-center gap-2 mt-1">
                      <Badge variant={campanha.ativa ? "default" : "secondary"} className="text-xs">
                        {campanha.ativa ? "Ativa" : "Pausada"}
                      </Badge>
                      <Badge variant="outline" className="text-xs">
                        {getFrequenciaLabel(campanha.frequencia)}
                      </Badge>
                      {campanha.horarios?.length > 0 && (
                        <span className="text-xs text-muted-foreground flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {campanha.horarios.map((h) => h.slice(0, 5)).join(", ")}
                        </span>
                      )}
                    </div>
                    <div className="flex items-center gap-3 mt-1 text-xs text-muted-foreground">
                      {campanha.proxima_execucao && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" />
                          Próx: {formatDate(campanha.proxima_execucao)}
                        </span>
                      )}
                      <span>Enviados: {campanha.total_enviados || 0}</span>
                    </div>
                  </div>

                  {/* Ações */}
                  <div className="flex items-center gap-1">
                    {campanha.ativa || campanha.status === "ativa" ? (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => pausarCampanha(campanha.id)}
                        disabled={actionLoading === campanha.id}
                        className="gap-1 text-orange-600 hover:bg-orange-50"
                      >
                        {actionLoading === campanha.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Pause className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">Pausar</span>
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => ativarCampanha(campanha.id)}
                        disabled={actionLoading === campanha.id}
                        className="gap-1 text-green-600 hover:bg-green-50"
                      >
                        {actionLoading === campanha.id ? (
                          <Loader2 className="h-4 w-4 animate-spin" />
                        ) : (
                          <Play className="h-4 w-4" />
                        )}
                        <span className="hidden sm:inline">Ativar</span>
                      </Button>
                    )}

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => {
                        setDeleteMode("single");
                        setSingleDeleteId(campanha.id);
                        setShowDeleteDialog(true);
                      }}
                      className="text-destructive hover:bg-destructive/10"
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </ScrollArea>
        )}

        {/* Resumo */}
        {campanhas.length > 0 && (
          <div className="flex items-center justify-between text-sm text-muted-foreground pt-2 border-t">
            <span>
              {campanhasAtivas.length} ativas • {campanhasPausadas.length} pausadas
            </span>
            <span>
              Total enviados: {campanhas.reduce((acc, c) => acc + (c.total_enviados || 0), 0)}
            </span>
          </div>
        )}
      </CardContent>

      {/* Dialog de confirmação de exclusão */}
      <AlertDialog open={showDeleteDialog} onOpenChange={setShowDeleteDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar exclusão</AlertDialogTitle>
            <AlertDialogDescription>
              {deleteMode === "single" && "Deseja excluir esta campanha?"}
              {deleteMode === "selected" &&
                `Deseja excluir ${selectedIds.length} campanha(s) selecionada(s)?`}
              {deleteMode === "all" &&
                `Deseja excluir TODAS as ${campanhas.length} campanhas?`}
              <br />
              <strong className="text-destructive">Esta ação não pode ser desfeita.</strong>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeleteConfirm}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {actionLoading === "bulk" ? (
                <Loader2 className="h-4 w-4 animate-spin mr-2" />
              ) : null}
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
