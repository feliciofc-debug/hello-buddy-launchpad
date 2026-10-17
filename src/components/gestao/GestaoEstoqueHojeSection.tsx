import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { loadGestaoEstoqueSnapshot, type GestaoEstoqueSnapshot } from "@/lib/gestao-estoque-load.ts";
import { EstoqueHojeCard } from "@/components/gestao/EstoqueHojeCard.tsx";

type Props = {
  userId: string;
  showDetailLink?: boolean;
  compact?: boolean;
};

export function GestaoEstoqueHojeSection({ userId, showDetailLink, compact }: Props) {
  const [loading, setLoading] = useState(true);
  const [snapshot, setSnapshot] = useState<GestaoEstoqueSnapshot | null>(null);

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
  }, [userId]);

  if (loading) {
    return (
      <div className="flex items-center gap-2 rounded-lg border bg-card p-6 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" />
        Carregando estoque…
      </div>
    );
  }

  if (!snapshot) return null;

  return (
    <EstoqueHojeCard
      snapshot={snapshot}
      showDetailLink={showDetailLink}
      compact={compact}
    />
  );
}
