import { useEffect, useState } from "react";
import { ChevronDown, Loader2 } from "lucide-react";
import { loadGestaoEstoqueSnapshot, type GestaoEstoqueSnapshot } from "@/lib/gestao-estoque-load.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import { EstoqueHojeCard } from "@/components/gestao/EstoqueHojeCard.tsx";
import { Button } from "@/components/ui/button";

const STORAGE_KEY = "gestao_estoque_hoje_expanded";

type Props = {
  userId: string;
  showDetailLink?: boolean;
  /** Incrementar após salvar compra, venda ou despesa para recarregar o snapshot. */
  refreshKey?: number;
};

export function GestaoEstoqueHojeCollapsible({ userId, showDetailLink, refreshKey = 0 }: Props) {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<GestaoEstoqueSnapshot | null>(null);
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    try {
      setExpanded(localStorage.getItem(STORAGE_KEY) === "1");
    } catch {
      setExpanded(false);
    }
  }, []);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void loadGestaoEstoqueSnapshot(userId).then((data) => {
      if (!cancelled) {
        setSnapshot(data);
        setLoading(false);
      }
    }).catch(() => {
      if (!cancelled) setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [userId, refreshKey]);

  const toggle = () => {
    const next = !expanded;
    setExpanded(next);
    try {
      localStorage.setItem(STORAGE_KEY, next ? "1" : "0");
    } catch {
      /* ignore */
    }
  };

  if (loading) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Estoque…
      </div>
    );
  }

  if (!snapshot) return null;

  const { totais, custoPendente } = snapshot;
  const resumo = [
    `${formatGestaoMoney(totais.valorVenda)} anunciado`,
    `${totais.quantidade} carros`,
    custoPendente.quantidade > 0
      ? `${custoPendente.quantidade} com custo pendente`
      : null,
  ].filter(Boolean).join(" · ");

  if (expanded) {
    return (
      <div className="space-y-2">
        <Button variant="ghost" size="sm" className="h-auto px-0 text-muted-foreground" onClick={toggle}>
          Estoque hoje: {resumo}
          <ChevronDown className="ml-1 h-4 w-4 rotate-180" />
          recolher
        </Button>
        <EstoqueHojeCard snapshot={snapshot} showDetailLink={showDetailLink} />
      </div>
    );
  }

  return (
    <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-muted/20 px-3 py-2 text-sm">
      <span>
        <span className="font-medium text-foreground">Estoque hoje:</span>{" "}
        <span className="text-muted-foreground">{resumo}</span>
      </span>
      <Button variant="link" size="sm" className="h-auto p-0" onClick={toggle}>
        ver detalhes
        <ChevronDown className="ml-0.5 h-4 w-4" />
      </Button>
    </div>
  );
}
