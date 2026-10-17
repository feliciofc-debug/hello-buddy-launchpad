import { useMemo, useState } from "react";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { vehicleLabel } from "@/lib/gestao-lucro-data.ts";

type Props = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  veiculos: GestaoVeiculoEnriched[];
  onPick: (veiculo: GestaoVeiculoEnriched) => void;
};

export function GestaoVeiculoPickerDialog({
  open,
  onOpenChange,
  title,
  veiculos,
  onPick,
}: Props) {
  const [q, setQ] = useState("");

  const filtered = useMemo(() => {
    const t = q.trim().toLowerCase();
    if (!t) return veiculos.slice(0, 30);
    return veiculos.filter((v) => {
      const label = vehicleLabel(v).toLowerCase();
      return label.includes(t) || (v.placa?.toLowerCase().includes(t) ?? false);
    }).slice(0, 30);
  }, [q, veiculos]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Buscar por modelo, marca ou placa…"
          value={q}
          onChange={(e) => setQ(e.target.value)}
          autoFocus
        />
        <ul className="max-h-64 space-y-1 overflow-y-auto">
          {filtered.map((v) => (
            <li key={v.id}>
              <Button
                variant="ghost"
                className="h-auto w-full justify-start py-2 text-left"
                onClick={() => {
                  onPick(v);
                  onOpenChange(false);
                  setQ("");
                }}
              >
                <span className="font-medium">{vehicleLabel(v)}</span>
                {v.placa && (
                  <span className="ml-2 text-xs text-muted-foreground">{v.placa}</span>
                )}
              </Button>
            </li>
          ))}
          {!filtered.length && (
            <p className="py-4 text-center text-sm text-muted-foreground">Nenhum veículo encontrado.</p>
          )}
        </ul>
      </DialogContent>
    </Dialog>
  );
}
