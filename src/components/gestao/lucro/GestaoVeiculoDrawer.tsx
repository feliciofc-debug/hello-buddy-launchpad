import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";
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
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { vehicleLabel } from "@/lib/gestao-lucro-data.ts";
import { GESTAO_DESPESA_CATEGORIAS, gestaoCategoriaLabel } from "@/lib/gestao-lucro-categories.ts";
import {
  formatGestaoMoney,
  formatGestaoPct,
  gestaoLucroTone,
  gestaoMargemPct,
} from "@/lib/gestao-format.ts";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  open: boolean;
  veiculo: GestaoVeiculoEnriched | null;
  userId: string;
  onClose: () => void;
  onSaved: () => void;
};

function origemLabel(o: string): string {
  const map: Record<string, string> = {
    painel: "Painel",
    whatsapp_texto: "WhatsApp (texto)",
    whatsapp_audio: "WhatsApp (áudio)",
    whatsapp_foto: "WhatsApp (foto)",
  };
  return map[o] ?? o;
}

export function GestaoVeiculoDrawer({ open, veiculo, userId, onClose, onSaved }: Props) {
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [compra, setCompra] = useState({ valor: "", data: "", origem: "compra", fornecedor: "" });
  const [venda, setVenda] = useState({ valor: "", data: "", vendedor: "", forma: "", marcar: false });
  const [despesaForm, setDespesaForm] = useState({
    valor: "",
    data: new Date().toISOString().slice(0, 10),
    categoria: "outros",
    descricao: "",
  });

  useEffect(() => {
    if (!veiculo) return;
    setCompra({
      valor: veiculo.valorCompra != null ? String(veiculo.valorCompra) : "",
      data: veiculo.dataCompra ?? new Date().toISOString().slice(0, 10),
      origem: "compra",
      fornecedor: "",
    });
    setVenda({
      valor: veiculo.valorVenda != null ? String(veiculo.valorVenda) : "",
      data: veiculo.dataVenda ?? new Date().toISOString().slice(0, 10),
      vendedor: veiculo.vendedor ?? "",
      forma: "",
      marcar: false,
    });
  }, [veiculo]);

  const saveCompra = useCallback(async () => {
    if (!veiculo) return;
    setBusy(true);
    const valor = Number(String(compra.valor).replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Informe o valor de compra.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("veiculo_compra" as "veiculos_estoque").upsert({
      user_id: userId,
      veiculo_id: veiculo.id,
      valor_compra: valor,
      data_compra: compra.data,
      origem: compra.origem,
      fornecedor_obs: compra.fornecedor.trim() || null,
    }, { onConflict: "user_id,veiculo_id" });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível salvar a compra.");
      return;
    }
    toast.success("Compra atualizada.");
    onSaved();
  }, [compra, onSaved, userId, veiculo]);

  const addDespesa = async () => {
    if (!veiculo) return;
    setBusy(true);
    const valor = Number(String(despesaForm.valor).replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Valor inválido.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("veiculo_despesas" as "veiculos_estoque").insert({
      user_id: userId,
      veiculo_id: veiculo.id,
      valor,
      data: despesaForm.data,
      categoria: despesaForm.categoria,
      descricao: despesaForm.descricao.trim() || null,
      origem_lancamento: "painel",
      lancado_por: "painel",
    });
    setBusy(false);
    if (error) {
      toast.error("Erro ao lançar despesa.");
      return;
    }
    toast.success("Despesa lançada.");
    setDespesaForm({ ...despesaForm, valor: "", descricao: "" });
    onSaved();
  };

  const confirmDeleteDespesa = async () => {
    if (!deleteId) return;
    setBusy(true);
    const { error } = await supabase.from("veiculo_despesas" as "veiculos_estoque").update({
      deleted_at: new Date().toISOString(),
      deleted_by: "painel",
    }).eq("id", deleteId);
    setBusy(false);
    setDeleteId(null);
    if (error) {
      toast.error("Não foi possível excluir.");
      return;
    }
    onSaved();
  };

  const saveVenda = async () => {
    if (!veiculo) return;
    setBusy(true);
    const valor = Number(String(venda.valor).replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Informe o valor de venda.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("veiculo_venda" as "veiculos_estoque").upsert({
      user_id: userId,
      veiculo_id: veiculo.id,
      valor_venda: valor,
      data_venda: venda.data,
      vendedor: venda.vendedor.trim() || null,
      forma_pagamento: venda.forma.trim() || null,
      marcou_vendido: venda.marcar,
    }, { onConflict: "user_id,veiculo_id" });
    if (error) {
      setBusy(false);
      toast.error("Erro ao salvar venda.");
      return;
    }
    if (venda.marcar) {
      await supabase.from("veiculos_estoque").update({
        status: "vendido",
        vendido_at: new Date().toISOString(),
      }).eq("id", veiculo.id);
    }
    setBusy(false);
    toast.success("Venda registrada.");
    onSaved();
  };

  if (!veiculo) return null;

  const lucro = veiculo.lucro;
  const margem = lucro.vendido
    ? lucro.margemPct
    : gestaoMargemPct(lucro.lucroProjetado, veiculo.preco);
  const lucroVal = lucro.vendido ? lucro.lucroLiquido : lucro.lucroProjetado;

  return (
    <>
      <Sheet open={open} onOpenChange={(v) => !v && onClose()}>
        <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
          <SheetHeader>
            <SheetTitle>{vehicleLabel(veiculo)}</SheetTitle>
            <p className="text-sm text-muted-foreground capitalize">{veiculo.status}</p>
          </SheetHeader>

          <div className="mt-6 space-y-6">
            <div className="grid grid-cols-2 gap-3 rounded-lg border p-3 text-sm">
              <div>
                <p className="text-xs text-muted-foreground">Investido</p>
                <p className="font-semibold">
                  {lucro.custoCompraPendente ? (
                    <span className="text-amber-600">Custo pendente</span>
                  ) : (
                    formatGestaoMoney(lucro.investido)
                  )}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Resultado</p>
                <p className={`font-semibold ${gestaoLucroTone(lucroVal)}`}>
                  {lucro.custoCompraPendente && !lucro.vendido
                    ? "—"
                    : formatGestaoMoney(lucroVal)}
                </p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Margem</p>
                <p className={gestaoLucroTone(margem)}>{formatGestaoPct(margem)}</p>
              </div>
              <div>
                <p className="text-xs text-muted-foreground">Despesas</p>
                <p className="font-semibold">{formatGestaoMoney(lucro.totalDespesas)}</p>
              </div>
            </div>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Compra</h3>
              <div className="grid gap-2">
                <Label className="text-xs">Valor (R$)</Label>
                <Input value={compra.valor} onChange={(e) => setCompra({ ...compra, valor: e.target.value })} />
                <Label className="text-xs">Data</Label>
                <Input type="date" value={compra.data} onChange={(e) => setCompra({ ...compra, data: e.target.value })} />
              </div>
              <Button size="sm" disabled={busy} onClick={() => void saveCompra()}>Salvar compra</Button>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Linha do tempo — despesas</h3>
              <ul className="max-h-48 space-y-2 overflow-y-auto text-sm">
                {veiculo.despesas.map((d) => (
                  <li key={d.id} className="rounded border p-2">
                    <div className="flex justify-between gap-2">
                      <span className="font-medium">
                        {d.data} · {gestaoCategoriaLabel(d.categoria)} · {formatGestaoMoney(Number(d.valor))}
                      </span>
                      <Button
                        size="icon"
                        variant="ghost"
                        className="h-7 w-7"
                        disabled={busy}
                        onClick={() => setDeleteId(d.id)}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </Button>
                    </div>
                    {d.descricao && <p className="text-muted-foreground">{d.descricao}</p>}
                    <p className="text-xs text-muted-foreground">
                      {origemLabel(d.origem_lancamento)}
                      {d.lancado_por ? ` · ${d.lancado_por}` : ""}
                    </p>
                  </li>
                ))}
                {!veiculo.despesas.length && (
                  <li className="text-muted-foreground">Nenhuma despesa lançada.</li>
                )}
              </ul>
              <div className="grid gap-2 border-t pt-2">
                <Input
                  placeholder="Valor"
                  value={despesaForm.valor}
                  onChange={(e) => setDespesaForm({ ...despesaForm, valor: e.target.value })}
                />
                <Input
                  type="date"
                  value={despesaForm.data}
                  onChange={(e) => setDespesaForm({ ...despesaForm, data: e.target.value })}
                />
                <Select
                  value={despesaForm.categoria}
                  onValueChange={(v) => setDespesaForm({ ...despesaForm, categoria: v })}
                >
                  <SelectTrigger><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {GESTAO_DESPESA_CATEGORIAS.map((c) => (
                      <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void addDespesa()}>
                  + Despesa
                </Button>
              </div>
            </section>

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Venda</h3>
              <Input
                placeholder="Valor venda"
                value={venda.valor}
                onChange={(e) => setVenda({ ...venda, valor: e.target.value })}
              />
              <Input
                type="date"
                value={venda.data}
                onChange={(e) => setVenda({ ...venda, data: e.target.value })}
              />
              <Input
                placeholder="Vendedor"
                value={venda.vendedor}
                onChange={(e) => setVenda({ ...venda, vendedor: e.target.value })}
              />
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={venda.marcar}
                  onChange={(e) => setVenda({ ...venda, marcar: e.target.checked })}
                />
                Marcar como vendido no estoque
              </label>
              <Button size="sm" disabled={busy} onClick={() => void saveVenda()}>
                Registrar venda
              </Button>
            </section>
          </div>
          {busy && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Salvando…
            </p>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={!!deleteId} onOpenChange={() => setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Excluir despesa?</AlertDialogTitle>
            <AlertDialogDescription>
              A despesa será marcada como excluída. Essa ação pode ser auditada.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmDeleteDespesa()}>Excluir</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}
