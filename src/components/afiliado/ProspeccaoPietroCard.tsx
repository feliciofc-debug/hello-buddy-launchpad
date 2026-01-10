import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Progress } from "@/components/ui/progress";
import { toast } from "sonner";
import {
  Users,
  Play,
  Upload,
  Loader2,
  CheckCircle2,
  XCircle,
  RefreshCw,
  Trash2,
  Phone,
} from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

interface Stats {
  totalNaFila: number;
  pendentes: number;
  enviados: number;
  erros: number;
  loteAtual: number;
  totalLeadsDisponiveis: number;
}

export default function ProspeccaoPietroCard() {
  const [userId, setUserId] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [executando, setExecutando] = useState(false);
  const [carregando, setCarregando] = useState(false);
  const [stats, setStats] = useState<Stats>({
    totalNaFila: 0,
    pendentes: 0,
    enviados: 0,
    erros: 0,
    loteAtual: 0,
    totalLeadsDisponiveis: 0,
  });

  useEffect(() => {
    loadData();
  }, []);

  const loadData = async () => {
    try {
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) return;
      setUserId(user.id);

      // Buscar stats
      const { data, error } = await supabase.functions.invoke("executar-prospeccao-pietro", {
        body: { userId: user.id, action: "stats" },
      });

      if (error) throw error;
      if (data?.stats) {
        setStats(data.stats);
      }
    } catch (error) {
      console.error("Erro ao carregar stats:", error);
    } finally {
      setLoading(false);
    }
  };

  const carregarLote = async () => {
    if (!userId) return;
    setCarregando(true);
    try {
      const { data, error } = await supabase.functions.invoke("executar-prospeccao-pietro", {
        body: { userId, action: "carregar_lote" },
      });

      if (error) throw error;

      toast.success(data.message || "Lote carregado com sucesso!");
      await loadData();
    } catch (error: any) {
      console.error("Erro ao carregar lote:", error);
      toast.error(error.message || "Erro ao carregar lote");
    } finally {
      setCarregando(false);
    }
  };

  const executarLote = async () => {
    if (!userId) return;
    setExecutando(true);
    try {
      const { data, error } = await supabase.functions.invoke("executar-prospeccao-pietro", {
        body: { userId, action: "executar_lote" },
      });

      if (error) throw error;

      if (data.pendentesRestantes > 0) {
        toast.success(`Enviados ${data.enviados} de 20. Restam ${data.pendentesRestantes} pendentes. Clique novamente para continuar.`);
      } else {
        toast.success(`Lote ${data.lote} concluído! ${data.enviados} enviados, ${data.erros} erros`);
      }
      await loadData();
    } catch (error: any) {
      console.error("Erro ao executar lote:", error);
      toast.error(error.message || "Erro ao executar lote");
    } finally {
      setExecutando(false);
    }
  };

  const limparFila = async () => {
    if (!userId) return;
    try {
      const { data, error } = await supabase.functions.invoke("executar-prospeccao-pietro", {
        body: { userId, action: "limpar" },
      });

      if (error) throw error;

      toast.success("Fila limpa com sucesso!");
      await loadData();
    } catch (error: any) {
      console.error("Erro ao limpar fila:", error);
      toast.error(error.message || "Erro ao limpar fila");
    }
  };

  const progresso = stats.totalNaFila > 0 
    ? Math.round((stats.enviados / stats.totalNaFila) * 100) 
    : 0;

  const progressoTotal = stats.totalLeadsDisponiveis > 0
    ? Math.round(((stats.totalNaFila) / stats.totalLeadsDisponiveis) * 100)
    : 0;

  if (loading) {
    return (
      <Card className="border-blue-500/50 bg-gradient-to-br from-blue-500/5 to-purple-500/5">
        <CardContent className="p-6 flex items-center justify-center">
          <Loader2 className="h-6 w-6 animate-spin text-blue-500" />
        </CardContent>
      </Card>
    );
  }

  return (
    <Card className="border-blue-500/50 bg-gradient-to-br from-blue-500/5 to-purple-500/5">
      <CardHeader className="pb-3">
        <CardTitle className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Phone className="h-5 w-5 text-blue-500" />
            <span>Prospecção Pietro Eugenio</span>
          </div>
          <Badge variant="outline" className="text-xs font-mono">
            21 99537-9550
          </Badge>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Stats Grid */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="p-3 bg-muted/50 rounded-lg text-center">
            <Users className="h-5 w-5 mx-auto text-muted-foreground mb-1" />
            <p className="text-2xl font-bold">{stats.totalLeadsDisponiveis}</p>
            <p className="text-xs text-muted-foreground">Total Leads</p>
          </div>
          <div className="p-3 bg-yellow-500/10 rounded-lg text-center">
            <Upload className="h-5 w-5 mx-auto text-yellow-500 mb-1" />
            <p className="text-2xl font-bold text-yellow-600">{stats.pendentes}</p>
            <p className="text-xs text-muted-foreground">Pendentes</p>
          </div>
          <div className="p-3 bg-green-500/10 rounded-lg text-center">
            <CheckCircle2 className="h-5 w-5 mx-auto text-green-500 mb-1" />
            <p className="text-2xl font-bold text-green-600">{stats.enviados}</p>
            <p className="text-xs text-muted-foreground">Enviados</p>
          </div>
          <div className="p-3 bg-red-500/10 rounded-lg text-center">
            <XCircle className="h-5 w-5 mx-auto text-red-500 mb-1" />
            <p className="text-2xl font-bold text-red-600">{stats.erros}</p>
            <p className="text-xs text-muted-foreground">Erros</p>
          </div>
        </div>

        {/* Progress */}
        {stats.totalNaFila > 0 && (
          <div className="space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-muted-foreground">Progresso do Lote {stats.loteAtual}</span>
              <span className="font-medium">{progresso}%</span>
            </div>
            <Progress value={progresso} className="h-2" />
          </div>
        )}

        {/* Carregamento total */}
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span className="text-muted-foreground">
              Carregados: {stats.totalNaFila} de {stats.totalLeadsDisponiveis}
            </span>
            <span className="font-medium">{progressoTotal}%</span>
          </div>
          <Progress value={progressoTotal} className="h-2 bg-muted" />
        </div>

        {/* Info */}
        <div className="p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg">
          <p className="text-sm text-blue-700 dark:text-blue-300">
            💡 Carregue 200 contatos. O sistema envia **20 por vez** com delay de 5-10s. 
            Clique "Executar Lote" várias vezes até zerar os pendentes!
          </p>
        </div>

        {/* Actions */}
        <div className="flex flex-wrap gap-2">
          <Button
            onClick={carregarLote}
            disabled={carregando || stats.totalNaFila >= stats.totalLeadsDisponiveis}
            className="flex-1 gap-2"
            variant="outline"
          >
            {carregando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            Carregar +200
          </Button>

          <Button
            onClick={executarLote}
            disabled={executando || stats.pendentes === 0}
            className="flex-1 gap-2 bg-green-600 hover:bg-green-700"
          >
            {executando ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Play className="h-4 w-4" />
            )}
            Executar Lote
          </Button>

          <Button
            onClick={loadData}
            variant="ghost"
            size="icon"
            className="shrink-0"
          >
            <RefreshCw className="h-4 w-4" />
          </Button>

          <AlertDialog>
            <AlertDialogTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="shrink-0 text-destructive hover:text-destructive"
                disabled={stats.totalNaFila === 0}
              >
                <Trash2 className="h-4 w-4" />
              </Button>
            </AlertDialogTrigger>
            <AlertDialogContent>
              <AlertDialogHeader>
                <AlertDialogTitle>Limpar Fila</AlertDialogTitle>
                <AlertDialogDescription>
                  Isso vai remover todos os {stats.totalNaFila} registros da fila de prospecção.
                  Os leads originais não serão afetados.
                </AlertDialogDescription>
              </AlertDialogHeader>
              <AlertDialogFooter>
                <AlertDialogCancel>Cancelar</AlertDialogCancel>
                <AlertDialogAction onClick={limparFila} className="bg-destructive hover:bg-destructive/90">
                  Limpar
                </AlertDialogAction>
              </AlertDialogFooter>
            </AlertDialogContent>
          </AlertDialog>
        </div>

        {/* Status atual */}
        {executando && (
          <div className="p-3 bg-green-500/10 border border-green-500/20 rounded-lg flex items-center gap-2">
            <Loader2 className="h-4 w-4 animate-spin text-green-500" />
            <p className="text-sm text-green-700 dark:text-green-300">
              Enviando mensagens... Aguarde, isso pode demorar alguns minutos.
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
