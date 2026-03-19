import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Loader2, Pause, Play, Trash2 } from "lucide-react";
import { toast } from "sonner";

interface Props {
  userId: string;
}

export function CampanhasList({ userId }: Props) {
  const [campanhas, setCampanhas] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchCampanhas = async () => {
    const { data } = await supabase
      .from("sophia_campanhas")
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
        { event: "*", schema: "public", table: "sophia_campanhas", filter: `user_id=eq.${userId}` },
        () => fetchCampanhas()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const togglePause = async (id: string, currentStatus: string) => {
    const newStatus = currentStatus === "pausada" ? "agendada" : "pausada";
    await supabase.from("sophia_campanhas").update({ status: newStatus }).eq("id", id);
    
    // Also pause/resume fila items
    if (newStatus === "pausada") {
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
    await supabase.from("sophia_campanhas").delete().eq("id", id);
    toast.success("Campanha excluída");
    fetchCampanhas();
  };

  const statusBadge = (status: string) => {
    const colors: Record<string, string> = {
      rascunho: "bg-gray-100 text-gray-700",
      agendada: "bg-blue-100 text-blue-700",
      executando: "bg-green-100 text-green-700",
      concluida: "bg-emerald-100 text-emerald-700",
      pausada: "bg-yellow-100 text-yellow-700",
    };
    return <Badge variant="outline" className={`${colors[status] || ""} capitalize`}>{status}</Badge>;
  };

  if (loading) {
    return <Card><CardContent className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Campanhas da Sophia</CardTitle>
      </CardHeader>
      <CardContent>
        {campanhas.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">
            Nenhuma campanha criada. Clique em "Nova Campanha" para começar.
          </p>
        ) : (
          <div className="space-y-3">
            {campanhas.map((c) => (
              <div key={c.id} className="p-4 bg-muted/50 rounded-lg space-y-2">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="font-medium">{c.nome}</p>
                    <p className="text-xs text-muted-foreground">
                      {c.tipo === "optin" ? "🔥 Opt-in" : "📚 Completa"} • {c.produto}
                    </p>
                  </div>
                  {statusBadge(c.status)}
                </div>

                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="bg-background rounded p-2">
                    <p className="text-lg font-bold">{c.total_leads}</p>
                    <p className="text-xs text-muted-foreground">Leads</p>
                  </div>
                  <div className="bg-background rounded p-2">
                    <p className="text-lg font-bold text-green-600">{c.total_enviados}</p>
                    <p className="text-xs text-muted-foreground">Enviados</p>
                  </div>
                  <div className="bg-background rounded p-2">
                    <p className="text-lg font-bold text-orange-500">{c.total_quentes}</p>
                    <p className="text-xs text-muted-foreground">Quentes</p>
                  </div>
                  <div className="bg-background rounded p-2">
                    <p className="text-lg font-bold text-destructive">{c.total_erros}</p>
                    <p className="text-xs text-muted-foreground">Erros</p>
                  </div>
                </div>

                <div className="flex gap-2 pt-1">
                  {(c.status === "agendada" || c.status === "executando" || c.status === "pausada") && (
                    <Button
                      size="sm"
                      variant="outline"
                      onClick={() => togglePause(c.id, c.status)}
                      className="gap-1"
                    >
                      {c.status === "pausada" ? <Play className="h-3 w-3" /> : <Pause className="h-3 w-3" />}
                      {c.status === "pausada" ? "Retomar" : "Pausar"}
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
