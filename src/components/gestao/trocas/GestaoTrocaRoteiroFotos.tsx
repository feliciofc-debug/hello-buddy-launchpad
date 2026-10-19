import { useMemo, useRef } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import {
  GESTAO_TROCA_ROTEIRO_SLOTS,
  gestaoTrocaRoteiroProgress,
  gestaoTrocaSlotDef,
  type GestaoTrocaFotoSlotId,
} from "@/lib/gestao-troca-roteiro.ts";
import {
  normalizeGestaoTrocaFotos,
  type GestaoTrocaFotoEntry,
} from "@/lib/gestao-troca-fotos.ts";

type Props = {
  trocaId: string;
  userId: string;
  fotosRaw: unknown;
  disabled?: boolean;
  onFotosChange: (entries: GestaoTrocaFotoEntry[]) => void;
};

export function GestaoTrocaRoteiroFotos({
  trocaId,
  userId,
  fotosRaw,
  disabled,
  onFotosChange,
}: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const pendingSlot = useRef<GestaoTrocaFotoSlotId | null>(null);
  const fotos = useMemo(() => normalizeGestaoTrocaFotos(fotosRaw), [fotosRaw]);
  const prog = useMemo(() => gestaoTrocaRoteiroProgress(fotos), [fotos]);

  const bySlot = useMemo(() => {
    const m = new Map<GestaoTrocaFotoSlotId, GestaoTrocaFotoEntry>();
    for (const f of fotos) {
      const slot = GESTAO_TROCA_ROTEIRO_SLOTS.find((s) =>
        f.slot === s.id || f.etiqueta === s.etiquetaLegado
      )?.id;
      if (slot && !m.has(slot)) m.set(slot, f);
    }
    return m;
  }, [fotos]);

  const openSlot = (slot: GestaoTrocaFotoSlotId) => {
    if (disabled) return;
    pendingSlot.current = slot;
    inputRef.current?.click();
  };

  const onFile = async (file: File | undefined) => {
    const slot = pendingSlot.current;
    pendingSlot.current = null;
    if (!file || !slot) return;
    if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) {
      toast.error("Use JPG, PNG ou WebP.");
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error("Máximo 10 MB.");
      return;
    }
    const def = gestaoTrocaSlotDef(slot);
    const path = `${userId}/${trocaId}/${Date.now()}-${file.name.replace(/\s+/g, "-")}`;
    const { error } = await supabase.storage.from("trocas").upload(path, file);
    if (error) {
      toast.error("Falha no upload.");
      return;
    }
    const rest = fotos.filter((f) => {
      const s = GESTAO_TROCA_ROTEIRO_SLOTS.find((x) =>
        f.slot === x.id || f.etiqueta === x.etiquetaLegado
      )?.id;
      return s !== slot;
    });
    onFotosChange([
      ...rest,
      { path, etiqueta: def.etiquetaLegado, slot },
    ]);
    toast.success(`${def.label} enviada.`);
  };

  return (
    <div className="space-y-2 rounded-md border bg-muted/20 p-3">
      <p className="text-sm font-semibold">
        Roteiro: {prog.preenchidos}/{prog.obrigatorios} obrigatórias
      </p>
      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => void onFile(e.target.files?.[0])}
      />
      <div className="flex flex-wrap gap-2">
        {GESTAO_TROCA_ROTEIRO_SLOTS.map((s) => {
          const ok = bySlot.has(s.id);
          return (
            <Button
              key={s.id}
              type="button"
              size="sm"
              variant={ok ? "secondary" : "outline"}
              className="h-auto min-h-8 whitespace-normal text-left text-xs"
              disabled={disabled}
              title={s.dica}
              onClick={() => openSlot(s.id)}
            >
              {ok ? "✅" : "⚪"} {s.label}
              {!s.obrigatorio ? " (opc.)" : ""}
            </Button>
          );
        })}
      </div>
      <p className="text-xs text-muted-foreground">
        Toque em um slot para enviar a foto. CRLV continua fora do roteiro IA.
      </p>
    </div>
  );
}
