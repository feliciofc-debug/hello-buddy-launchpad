import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";

type Row = {
  id: string;
  text: string;
  created_at: string;
  permalink: string | null;
  status: string | null;
};

export function MlQuestionsPanel() {
  const [rows, setRows] = useState<Row[]>([]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase
        .from("ml_questions" as "veiculos_estoque")
        .select("id, text, created_at, permalink, status")
        .order("created_at", { ascending: false })
        .limit(20);
      setRows((data as Row[]) ?? []);
    })();
  }, []);

  if (!rows.length) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Perguntas Mercado Livre</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3 text-sm">
        {rows.map((q) => (
          <div key={q.id} className="border-b pb-2 last:border-0">
            <p>{q.text}</p>
            <p className="text-xs text-muted-foreground">
              {new Date(q.created_at).toLocaleString("pt-BR")}
              {q.permalink && (
                <>
                  {" · "}
                  <a href={q.permalink} target="_blank" rel="noreferrer" className="underline">
                    anúncio
                  </a>
                </>
              )}
            </p>
          </div>
        ))}
      </CardContent>
    </Card>
  );
}
