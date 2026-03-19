import { useEffect, useState } from "react";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Clock, Loader2, CheckCircle, XCircle, Flame, Snowflake } from "lucide-react";

interface Props {
  userId: string;
}

interface Contadores {
  pendentes: number;
  processando: number;
  enviados: number;
  erros: number;
  quentes: number;
  frios: number;
}

export function FilaContadores({ userId }: Props) {
  const [contadores, setContadores] = useState<Contadores>({
    pendentes: 0, processando: 0, enviados: 0, erros: 0, quentes: 0, frios: 0,
  });

  const fetchContadores = async () => {
    const { data } = await supabase
      .from("fila_atendimento_pj")
      .select("status, opt_in_status")
      .eq("user_id", userId);

    if (data) {
      setContadores({
        pendentes: data.filter((r: any) => r.status === "pendente").length,
        processando: data.filter((r: any) => r.status === "processando").length,
        enviados: data.filter((r: any) => r.status === "enviado").length,
        erros: data.filter((r: any) => r.status === "erro").length,
        quentes: data.filter((r: any) => r.opt_in_status === "quente").length,
        frios: data.filter((r: any) => r.opt_in_status === "frio").length,
      });
    }
  };

  useEffect(() => {
    fetchContadores();

    const channel = supabase
      .channel("fila-pj-contadores")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "fila_atendimento_pj", filter: `user_id=eq.${userId}` },
        () => fetchContadores()
      )
      .subscribe();

    const interval = setInterval(fetchContadores, 15000);

    return () => {
      supabase.removeChannel(channel);
      clearInterval(interval);
    };
  }, [userId]);

  const items = [
    { label: "Pendentes", value: contadores.pendentes, icon: Clock, color: "text-yellow-500" },
    { label: "Processando", value: contadores.processando, icon: Loader2, color: "text-blue-500" },
    { label: "Enviados", value: contadores.enviados, icon: CheckCircle, color: "text-green-500" },
    { label: "Erros", value: contadores.erros, icon: XCircle, color: "text-destructive" },
    { label: "Quentes", value: contadores.quentes, icon: Flame, color: "text-orange-500" },
    { label: "Frios", value: contadores.frios, icon: Snowflake, color: "text-sky-400" },
  ];

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">📊 Contadores da Fila</CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-3 gap-3">
          {items.map((item) => (
            <div key={item.label} className="flex items-center gap-2 p-2 bg-muted/50 rounded-lg">
              <item.icon className={`h-4 w-4 ${item.color}`} />
              <div>
                <p className="text-lg font-bold leading-none">{item.value}</p>
                <p className="text-xs text-muted-foreground">{item.label}</p>
              </div>
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
