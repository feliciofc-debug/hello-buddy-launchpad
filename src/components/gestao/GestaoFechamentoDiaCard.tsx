import { useCallback, useEffect, useState } from "react";
import { CalendarDays, Loader2, RefreshCw } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

type Props = {
  refreshKey?: number;
};

export function GestaoFechamentoDiaCard({ refreshKey = 0 }: Props) {
  const [periodo, setPeriodo] = useState<"hoje" | "ontem">("hoje");
  const [texto, setTexto] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    const { data, error: invokeError } = await supabase.functions.invoke(
      "gestao-fechamento-dia",
      { body: { periodo } },
    );
    if (invokeError || data?.success !== true) {
      setError("Não foi possível carregar o fechamento.");
      setTexto("");
    } else {
      setTexto(String(data.texto ?? ""));
    }
    setLoading(false);
  }, [periodo]);

  useEffect(() => {
    void load();
  }, [load, refreshKey]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle className="flex items-center gap-2 text-base">
              <CalendarDays className="h-4 w-4" />
              Fechamento do dia
            </CardTitle>
            <p className="mt-1 text-xs text-muted-foreground">
              O mesmo resumo enviado pelo Jarvis no WhatsApp.
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              size="sm"
              variant="outline"
              onClick={() => setPeriodo((p) => p === "hoje" ? "ontem" : "hoje")}
            >
              {periodo === "hoje" ? "Ver ontem" : "Ver hoje"}
            </Button>
            <Button
              size="icon"
              variant="ghost"
              aria-label="Atualizar fechamento"
              onClick={() => void load()}
            >
              <RefreshCw className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </CardHeader>
      <CardContent>
        {loading
          ? (
            <div className="flex items-center gap-2 py-4 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Gerando fechamento…
            </div>
          )
          : error
          ? <p className="py-2 text-sm text-destructive">{error}</p>
          : (
            <pre className="whitespace-pre-wrap font-sans text-sm leading-6">{texto}</pre>
          )}
      </CardContent>
    </Card>
  );
}
