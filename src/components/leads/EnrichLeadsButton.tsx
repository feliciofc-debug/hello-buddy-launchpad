import { useState } from "react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { useToast } from "@/hooks/use-toast";
import { Loader2, Sparkles } from "lucide-react";

interface EnrichLeadsButtonProps {
  campanhaId: string;
  onEnrichComplete?: () => void;
}

export function EnrichLeadsButton({ campanhaId, onEnrichComplete }: EnrichLeadsButtonProps) {
  const [isEnriching, setIsEnriching] = useState(false);
  const [progress, setProgress] = useState({ current: 0, total: 0 });
  const { toast } = useToast();

  const enrichLeads = async () => {
    try {
      setIsEnriching(true);

      // 1. Buscar leads da campanha que ainda não foram enriquecidos
      const { data: leadsB2C, error: errorB2C } = await supabase
        .from("leads_b2c")
        .select("id, nome_completo")
        .eq("campanha_id", campanhaId)
        .is("enriched_at", null);

      const { data: leadsB2B, error: errorB2B } = await supabase
        .from("leads_b2b")
        .select("id, razao_social")
        .eq("campanha_id", campanhaId)
        .is("enriched_at", null);

      if (errorB2C || errorB2B) {
        throw new Error("Erro ao buscar leads");
      }

      const allLeads = [
        ...(leadsB2C || []).map(l => ({ ...l, tipo: "b2c" as const })),
        ...(leadsB2B || []).map(l => ({ ...l, tipo: "b2b" as const })),
      ];

      if (allLeads.length === 0) {
        toast({
          title: "✅ Tudo enriquecido!",
          description: "Todos os leads já foram enriquecidos.",
        });
        return;
      }

      setProgress({ current: 0, total: allLeads.length });

      // 2. Enriquecer cada lead (com delay para evitar rate limit)
      let enriched = 0;
      let failed = 0;

      for (const lead of allLeads) {
        try {
          const { data, error } = await supabase.functions.invoke("enrich-lead", {
            body: {
              lead_id: lead.id,
              lead_tipo: lead.tipo,
            },
          });

          if (error) {
            console.error(`Erro ao enriquecer lead ${lead.id}:`, error);
            failed++;
          } else {
            enriched++;
          }

          setProgress(prev => ({ ...prev, current: prev.current + 1 }));

          // Delay de 2 segundos entre cada lead
          await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.error(`Erro ao enriquecer lead ${lead.id}:`, error);
          failed++;
        }
      }

      // 3. Mostrar resultado
      toast({
        title: "🎉 Enriquecimento concluído!",
        description: `${enriched} leads enriquecidos com sucesso. ${failed > 0 ? `${failed} falharam.` : ""}`,
      });

      onEnrichComplete?.();
    } catch (error) {
      console.error("Erro ao enriquecer leads:", error);
      toast({
        variant: "destructive",
        title: "❌ Erro ao enriquecer",
        description: error.message || "Tente novamente.",
      });
    } finally {
      setIsEnriching(false);
      setProgress({ current: 0, total: 0 });
    }
  };

  return (
    <Button
      onClick={enrichLeads}
      disabled={isEnriching}
      className="gap-2"
    >
      {isEnriching ? (
        <>
          <Loader2 className="h-4 w-4 animate-spin" />
          Enriquecendo {progress.current}/{progress.total}
        </>
      ) : (
        <>
          <Sparkles className="h-4 w-4" />
          Enriquecer Leads
        </>
      )}
    </Button>
  );
}
