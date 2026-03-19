import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Pause, Play, Trash2, Calendar, Clock } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
}

export function CampanhasList({ userId }: Props) {
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampanhas = async () => {
    const { data } = await supabase
      .from("campanhas_recorrentes")
      .select("*")
      .eq("user_id", userId)
      .order("created_at", { ascending: false });

    if (data) setCampanhas(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchCampanhas();

    const channel = supabase
      .channel("sophia-campanhas-list")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "campanhas_recorrentes", filter: `user_id=eq.${userId}` },
        () => fetchCampanhas()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const togglePause = async (id: string, currentAtiva: boolean) => {
    const newAtiva = !currentAtiva;
    const newStatus = newAtiva ? "ativa" : "pausada";
    
    await supabase
      .from("campanhas_recorrentes")
      .update({ ativa: newAtiva, status: newStatus })
      .eq("id", id);
    
    // Also pause/resume fila items linked to this campaign
    if (!newAtiva) {
      await supabase
        .from("fila_atendimento_pj")
        .update({ status: "pausado" })
        .eq("campanha_id", id)
        .eq("status", "pendente");
      toast.info("Campanha pausada");
    } else {
      await supabase
        .from("fila_atendimento_pj")
        .update({ status: "pendente" })
        .eq("campanha_id", id)
        .eq("status", "pausado");
      toast.success("Campanha retomada");
    }
    fetchCampanhas();
  };

  const deleteCampanha = async (id: string) => {
    if (!confirm("Excluir campanha e todos os envios pendentes?")) return;
    
    await supabase.from("fila_atendimento_pj").delete().eq("campanha_id", id).in("status", ["pendente", "pausado"]);
    await supabase.from("campanhas_recorrentes").delete().eq("id", id);
    toast.success("Campanha excluída");
    fetchCampanhas();
  };

  const statusBadge = (c: any) => {
    const status = c.status || (c.ativa ? "ativa" : "pausada");
    const colors: Record<string, string> = {
      ativa: "bg-green-100 text-green-700",
      enviada: "bg-emerald-100 text-emerald-700",
      pausada: "bg-yellow-100 text-yellow-700",
      agendada: "bg-blue-100 text-blue-700",
    };
    return <Badge variant="outline" className={`${colors[status] || ""} capitalize`}>{status}</Badge>;
  };

  const formatDate = (iso: string | null) => {
    if (!iso) return "—";
    return new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });
  };

  if (loading) {
    return <Card><CardContent className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">📋 Campanhas (da Área de Produtos)</CardTitle>
      </CardHeader>
      <CardContent>
        {campanhas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma campanha criada. Vá em <strong>Meus Produtos</strong> e clique em "Criar Campanha".
          </p>
        ) : (
          <div className="space-y-3">
            {campanhas.map((c) => (
              <div key={c.id} className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div className="min-w-0">
                    <p className="font-medium truncate">{c.nome}</p>
                    <p className="text-xs text-muted-foreground flex items-center gap-2">
                      {c.frequencia && <span>📅 {c.frequencia}</span>}
                      {c.horarios?.length > 0 && (
                        <span className="flex items-center gap-1">
                          <Clock className="h-3 w-3" />
                          {c.horarios.join(", ")}
                        </span>
                      )}
                    </p>
                  </div>
                  {statusBadge(c)}
                </div>

                <div className="grid grid-cols-3 gap-2 text-center">
                  <div className="bg-background rounded p-2">
                    <p className="text-lg font-bold text-green-600">{c.total_enviados || 0}</p>
                    <p className="text-xs text-muted-foreground">Enviados</p>
                  </div>
                  <div className="bg-background rounded p-2">
                    <p className="text-sm font-medium">{formatDate(c.proxima_execucao)}</p>
                    <p className="text-xs text-muted-foreground">Próximo Envio</p>
                  </div>
                  <div className="bg-background rounded p-2">
                    <p className="text-sm font-medium">{formatDate(c.ultima_execucao)}</p>
                    <p className="text-xs text-muted-foreground">Último Envio</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  {c.status !== "enviada" && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => togglePause(c.id, c.ativa)}
                      className="gap-1"
                    >
                      {c.ativa ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
                      {c.ativa ? "Pausar" : "Retomar"}
                    </Button>
                  )}
                  <Button
                    size="sm"
                    variant="ghost"
                    className="text-destructive gap-1"
                    onClick={() => deleteCampanha(c.id)}
                  >
                    <Trash2 className="h-3 w-3" />
                    Excluir
                  </Button>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
