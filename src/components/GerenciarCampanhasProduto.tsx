import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel,
  AlertDialogContent, AlertDialogDescription, AlertDialogFooter,
  AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Play, Pause, Trash2, Clock, Calendar, RefreshCw, Loader2, Megaphone, Plus, X } from "lucide-react";
import { toast } from "sonner";

interface Props {
  produtoId: string;
  produtoNome: string;
  produtoImagem?: string | null;
  onClose: () => void;
  onCriarNova: () => void;
}

interface Campanha {
  id: string;
  nome: string;
  frequencia: string;
  horarios: string[];
  dias_semana: number[];
  proxima_execucao: string | null;
  ultima_execucao: string | null;
  total_enviados: number;
  ativa: boolean;
  status: string;
}

const DIAS = ["Dom", "Seg", "Ter", "Qua", "Qui", "Sex", "Sáb"];

export default function GerenciarCampanhasProduto({ produtoId, produtoNome, produtoImagem, onClose, onCriarNova }: Props) {
  const [campanhas, setCampanhas] = useState<Campanha[]>([]);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [deleteId, setDeleteId] = useState<string | null>(null);

  useEffect(() => { load(); }, [produtoId]);

  const load = async () => {
    setLoading(true);
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;

      const { data, error } = await supabase
        .from("afiliado_campanhas")
        .select("id, nome, frequencia, horarios, dias_semana, proxima_execucao, ultima_execucao, total_enviados, ativa, status")
        .eq("user_id", user.id)
        .eq("produto_id", produtoId)
        .order("created_at", { ascending: false });

      if (error) throw error;
      setCampanhas(data || []);
    } catch (e) {
      console.error(e);
      toast.error("Erro ao carregar campanhas");
    } finally {
      setLoading(false);
    }
  };

  const toggle = async (id: string, ativar: boolean) => {
    setActionLoading(id);
    try {
      const { error } = await supabase
        .from("afiliado_campanhas")
        .update({ ativa: ativar, status: ativar ? "ativa" : "pausada" })
        .eq("id", id);
      if (error) throw error;
      setCampanhas(prev => prev.map(c => c.id === id ? { ...c, ativa: ativar, status: ativar ? "ativa" : "pausada" } : c));
      toast.success(ativar ? "Campanha ativada" : "Campanha pausada");
    } catch {
      toast.error("Erro ao alterar campanha");
    } finally {
      setActionLoading(null);
    }
  };

  const deletar = async () => {
    if (!deleteId) return;
    setActionLoading(deleteId);
    try {
      const { error } = await supabase.from("afiliado_campanhas").delete().eq("id", deleteId);
      if (error) throw error;
      setCampanhas(prev => prev.filter(c => c.id !== deleteId));
      toast.success("Campanha excluída");
    } catch {
      toast.error("Erro ao excluir");
    } finally {
      setActionLoading(null);
      setDeleteId(null);
    }
  };

  const toggleTodas = async (ativar: boolean) => {
    setActionLoading("bulk");
    try {
      const ids = campanhas.filter(c => c.ativa !== ativar).map(c => c.id);
      if (ids.length === 0) return;
      const { error } = await supabase
        .from("afiliado_campanhas")
        .update({ ativa: ativar, status: ativar ? "ativa" : "pausada" })
        .in("id", ids);
      if (error) throw error;
      setCampanhas(prev => prev.map(c => ({ ...c, ativa: ativar, status: ativar ? "ativa" : "pausada" })));
      toast.success(ativar ? "Todas ativadas" : "Todas pausadas");
    } catch {
      toast.error("Erro");
    } finally {
      setActionLoading(null);
    }
  };

  const fmt = (d: string | null) => {
    if (!d) return "-";
    return new Date(d).toLocaleString("pt-BR", { day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit" });
  };

  const freqLabel = (f: string) => f === "diario" ? "Diária" : f === "semanal" ? "Semanal" : f === "uma_vez" ? "Única" : f;

  const ativas = campanhas.filter(c => c.ativa);
  const pausadas = campanhas.filter(c => !c.ativa);

  return (
    <>
      <Card className="border-primary/30 shadow-lg">
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base flex items-center gap-2">
              <Megaphone className="h-4 w-4 text-primary" />
              Campanhas: {produtoNome.slice(0, 30)}{produtoNome.length > 30 ? "..." : ""}
            </CardTitle>
            <Button variant="ghost" size="sm" onClick={onClose}>
              <X className="h-4 w-4" />
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          {/* Ações globais */}
          <div className="flex flex-wrap gap-1.5">
            <Button size="sm" variant="outline" onClick={load} disabled={loading}>
              <RefreshCw className="h-3 w-3 mr-1" /> Atualizar
            </Button>
            <Button size="sm" className="gap-1" onClick={onCriarNova}>
              <Plus className="h-3 w-3" /> Nova Campanha
            </Button>
            {campanhas.length > 1 && (
              <>
                <Button size="sm" variant="outline" onClick={() => toggleTodas(true)}
                  disabled={actionLoading === "bulk" || pausadas.length === 0}
                  className="text-green-600 border-green-200 hover:bg-green-50 gap-1">
                  <Play className="h-3 w-3" /> Todas
                </Button>
                <Button size="sm" variant="outline" onClick={() => toggleTodas(false)}
                  disabled={actionLoading === "bulk" || ativas.length === 0}
                  className="text-orange-600 border-orange-200 hover:bg-orange-50 gap-1">
                  <Pause className="h-3 w-3" /> Todas
                </Button>
              </>
            )}
          </div>

          {loading ? (
            <div className="flex justify-center py-6">
              <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
            </div>
          ) : campanhas.length === 0 ? (
            <div className="text-center py-6 text-muted-foreground text-sm">
              <Megaphone className="h-8 w-8 mx-auto mb-2 opacity-30" />
              <p>Nenhuma campanha para este produto</p>
            </div>
          ) : (
            <ScrollArea className="max-h-[350px]">
              <div className="space-y-2">
                {campanhas.map(c => (
                  <div key={c.id} className={`p-3 rounded-lg border text-sm transition-colors ${
                    c.ativa ? "bg-green-50 border-green-200 dark:bg-green-950/20 dark:border-green-800"
                            : "bg-muted/30 border-border"
                  }`}>
                    <div className="flex items-center justify-between mb-1.5">
                      <div className="flex items-center gap-2">
                        <Badge variant={c.ativa ? "default" : "secondary"} className="text-[10px]">
                          {c.ativa ? "Ativa" : "Pausada"}
                        </Badge>
                        <Badge variant="outline" className="text-[10px]">
                          {freqLabel(c.frequencia)}
                        </Badge>
                      </div>
                      <div className="flex items-center gap-1">
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0"
                          onClick={() => toggle(c.id, !c.ativa)}
                          disabled={actionLoading === c.id}>
                          {actionLoading === c.id ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                            : c.ativa ? <Pause className="h-3.5 w-3.5 text-orange-500" />
                            : <Play className="h-3.5 w-3.5 text-green-500" />}
                        </Button>
                        <Button variant="ghost" size="sm" className="h-7 w-7 p-0 text-destructive hover:bg-destructive/10"
                          onClick={() => setDeleteId(c.id)}>
                          <Trash2 className="h-3.5 w-3.5" />
                        </Button>
                      </div>
                    </div>

                    {c.horarios?.length > 0 && (
                      <div className="flex items-center gap-1 text-xs text-muted-foreground">
                        <Clock className="h-3 w-3" />
                        {c.horarios.map(h => h.slice(0, 5)).join(", ")}
                      </div>
                    )}

                    {c.dias_semana?.length > 0 && (
                      <div className="flex gap-1 mt-1">
                        {[0,1,2,3,4,5,6].map(d => (
                          <span key={d} className={`text-[10px] px-1 rounded ${
                            c.dias_semana.includes(d) ? "bg-primary/20 text-primary font-medium" : "text-muted-foreground/40"
                          }`}>{DIAS[d]}</span>
                        ))}
                      </div>
                    )}

                    <div className="flex items-center gap-3 mt-1.5 text-xs text-muted-foreground">
                      {c.proxima_execucao && (
                        <span className="flex items-center gap-1">
                          <Calendar className="h-3 w-3" /> Próx: {fmt(c.proxima_execucao)}
                        </span>
                      )}
                      <span>📤 {c.total_enviados || 0}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          )}

          {/* Resumo */}
          {campanhas.length > 0 && (
            <div className="text-xs text-muted-foreground pt-2 border-t flex justify-between">
              <span>{ativas.length} ativas • {pausadas.length} pausadas</span>
              <span>Total enviados: {campanhas.reduce((a, c) => a + (c.total_enviados || 0), 0)}</span>
            </div>
          )}
        </CardContent>
      </Card>

      <AlertDialog open={!!deleteId} onOpenChange={(open) => !open && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir campanha?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação não pode ser desfeita.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={deletar} className="bg-destructive text-destructive-foreground hover:bg-destructive/90">
              Excluir
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
