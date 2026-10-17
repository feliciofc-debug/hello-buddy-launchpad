import { useEffect, useState } from "react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { isActiveStock, vehicleLabel } from "@/lib/gestao-lucro-data.ts";
import { GESTAO_DESPESA_CATEGORIAS } from "@/lib/gestao-lucro-categories.ts";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  veiculos: GestaoVeiculoEnriched[];
  preselectedId?: string | null;
  onSaved: () => void;
};

export function GestaoBatchDespesaDialog({
  open,
  onOpenChange,
  userId,
  veiculos,
  preselectedId,
  onSaved,
}: Props) {
  const stock = veiculos.filter(isActiveStock);
  const [veiculoId, setVeiculoId] = useState(preselectedId ?? stock[0]?.id ?? "");
  const [valor, setValor] = useState("");
  const [data, setData] = useState(new Date().toISOString().slice(0, 10));
  const [categoria, setCategoria] = useState("outros");
  const [descricao, setDescricao] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (preselectedId) setVeiculoId(preselectedId);
  }, [preselectedId, open]);

  const submit = async () => {
    if (!veiculoId) {
      toast.error("Selecione um veículo.");
      return;
    }
    const v = Number(String(valor).replace(",", "."));
    if (!Number.isFinite(v) || v <= 0) {
      toast.error("Valor inválido.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("veiculo_despesas" as "veiculos_estoque").insert({
      user_id: userId,
      veiculo_id: veiculoId,
      valor: v,
      data,
      categoria,
      descricao: descricao.trim() || null,
      origem_lancamento: "painel",
      lancado_por: "painel",
    });
    setBusy(false);
    if (error) {
      toast.error("Erro ao lançar.");
      return;
    }
    toast.success("Despesa lançada.");
    setValor("");
    setDescricao("");
    onSaved();
    onOpenChange(false);
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Lançar despesa</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Veículo</Label>
            <Select value={veiculoId} onValueChange={setVeiculoId}>
              <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
              <SelectContent>
                {stock.map((v) => (
                  <SelectItem key={v.id} value={v.id}>{vehicleLabel(v)}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Valor (R$)</Label>
            <Input value={valor} onChange={(e) => setValor(e.target.value)} />
          </div>
          <div>
            <Label>Data</Label>
            <Input type="date" value={data} onChange={(e) => setData(e.target.value)} />
          </div>
          <div>
            <Label>Categoria</Label>
            <Select value={categoria} onValueChange={setCategoria}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GESTAO_DESPESA_CATEGORIAS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label>Descrição</Label>
            <Input value={descricao} onChange={(e) => setDescricao(e.target.value)} />
          </div>
          <Button disabled={busy} onClick={() => void submit()}>Lançar</Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}
