import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, XCircle, Clock, Loader2 } from "lucide-react";

interface Props {
  userId: string;
}

export function HistoricoEnvios({ userId }: Props) {
  const [envios, setEnvios] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchEnvios = async () => {
    const { data } = await supabase
      .from("fila_atendimento_pj")
      .select("id, lead_phone, lead_name, status, opt_in_status, sent_at, erro, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(50);

    if (data) setEnvios(data);
    setLoading(false);
  };

  useEffect(() => {
    fetchEnvios();

    const channel = supabase
      .channel("fila-pj-historico")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fila_atendimento_pj", filter: `user_id=eq.${userId}` },
        () => fetchEnvios()
      )
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [userId]);

  const statusIcon = (status: string) => {
    switch (status) {
      case "enviado": return <CheckCircle className="h-4 w-4 text-green-500" />;
      case "erro": return <XCircle className="h-4 w-4 text-destructive" />;
      case "processando": return <Loader2 className="h-4 w-4 text-blue-500 animate-spin" />;
      default: return <Clock className="h-4 w-4 text-yellow-500" />;
    }
  };

  const optInBadge = (opt: string | null) => {
    if (!opt || opt === "novo") return null;
    const colors: Record<string, string> = {
      aguardando: "bg-yellow-100 text-yellow-800",
      quente: "bg-orange-100 text-orange-800",
      frio: "bg-sky-100 text-sky-800",
    };
    return (
      <Badge variant="outline" className={`text-xs ${colors[opt] || ""}`}>
        {opt === "quente" ? "🔥" : opt === "frio" ? "❄️" : "⏳"} {opt}
      </Badge>
    );
  };

  const formatDate = (iso: string) =>
    new Date(iso).toLocaleString("pt-BR", {
      day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit",
    });

  if (loading) {
    return <Card><CardContent className="p-8 text-center"><Loader2 className="h-6 w-6 animate-spin mx-auto" /></CardContent></Card>;
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Histórico de Envios</CardTitle>
      </CardHeader>
      <CardContent>
        {envios.length === 0 ? (
          <p className="text-sm text-muted-foreground text-center py-6">Nenhum envio na fila ainda</p>
        ) : (
          <div className="space-y-2 max-h-[500px] overflow-y-auto">
            {envios.map((e) => (
              <div key={e.id} className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
                <div className="flex items-center gap-3 min-w-0">
                  {statusIcon(e.status)}
                  <div className="min-w-0">
                    <p className="text-sm font-medium truncate">
                      {e.lead_name || "Sem nome"} — <span className="font-mono text-xs">{e.lead_phone}</span>
                    </p>
                    {e.erro && <p className="text-xs text-destructive truncate">{e.erro}</p>}
                    {e.sent_at && <p className="text-xs text-muted-foreground">Enviado: {formatDate(e.sent_at)}</p>}
                  </div>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                  {optInBadge(e.opt_in_status)}
                  <Badge variant="outline" className="text-xs capitalize">{e.status}</Badge>
                </div>
              </div>
            ))}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
