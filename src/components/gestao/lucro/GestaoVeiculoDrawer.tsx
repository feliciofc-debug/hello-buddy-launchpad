import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
import { hojeSaoPaulo } from "../../../../supabase/functions/_shared/gestao-date-br.ts";
import {
  validateGestaoComissaoValor,
} from "../../../../supabase/functions/_shared/gestao-comissao-guard.ts";
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
import { GestaoMoneyInput } from "@/components/gestao/lucro/GestaoMoneyInput.tsx";
import { parseGestaoMoneyField } from "@/lib/gestao-money.ts";
import { loadGestaoVendedores, loadComissaoRegra, type GestaoVendedor } from "@/lib/gestao-equipe-load.ts";
import { calcGestaoComissao } from "../../../../supabase/functions/_shared/gestao-comissao-calc.ts";
import { comissaoLucroBase } from "@/lib/gestao-comissao-lucro.ts";
import { GestaoVendaRaioXPanel } from "@/components/gestao/lucro/GestaoVendaRaioXPanel.tsx";
import { syncComissaoAfterVenda } from "@/lib/gestao-comissao-client.ts";
import { useGestaoFocusnfeConnection } from "@/components/integracoes/useGestaoFocusnfeConnection";
import { GestaoEmitirNfeDialog } from "@/components/gestao/lucro/GestaoEmitirNfeDialog.tsx";

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
    automatica: "Automática (comissão)",
  };
  return map[o] ?? o;
}

export function GestaoVeiculoDrawer({ open, veiculo, userId, onClose, onSaved }: Props) {
  const focusnfe = useGestaoFocusnfeConnection();
  const [nfeOpen, setNfeOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const [deleteId, setDeleteId] = useState<string | null>(null);
  const [compra, setCompra] = useState({ valor: "", data: "", origem: "compra", fornecedor: "" });
  const [venda, setVenda] = useState({ valor: "", data: "", vendedor: "", forma: "", marcar: true });
  const [despesaForm, setDespesaForm] = useState({
    valor: "",
    data: hojeSaoPaulo(),
    categoria: "outros",
    descricao: "",
  });
  const [vendedores, setVendedores] = useState<GestaoVendedor[]>([]);
  const [vendedorId, setVendedorId] = useState<string>("");
  const [comissaoConfirmOpen, setComissaoConfirmOpen] = useState(false);
  const [comissaoPreview, setComissaoPreview] = useState(0);
  const [comissaoOverride, setComissaoOverride] = useState("");
  const [comissaoConfirmAlto, setComissaoConfirmAlto] = useState(false);

  useEffect(() => {
    if (!userId) return;
    void loadGestaoVendedores(userId).then(setVendedores);
  }, [userId]);

  useEffect(() => {
    if (!veiculo) return;
    setCompra({
      valor: veiculo.valorCompra != null ? String(veiculo.valorCompra) : "",
      data: veiculo.dataCompra ?? hojeSaoPaulo(),
      origem: "compra",
      fornecedor: "",
    });
    setVenda({
      valor: veiculo.valorVenda != null ? String(veiculo.valorVenda) : "",
      data: veiculo.dataVenda ?? hojeSaoPaulo(),
      vendedor: veiculo.vendedor ?? "",
      forma: "",
      marcar: true,
    });
    setVendedorId(veiculo.vendedor_id ?? "");
  }, [veiculo]);

  const saveCompra = useCallback(async () => {
    if (!veiculo) return;
    setBusy(true);
    const valor = parseGestaoMoneyField(compra.valor);
    if (valor == null) {
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
    const valor = parseGestaoMoneyField(despesaForm.valor);
    if (valor == null) {
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

  const prepareVenda = async () => {
    if (!veiculo) return;
    const valor = parseGestaoMoneyField(venda.valor);
    if (valor == null) {
      toast.error("Informe o valor de venda.");
      return;
    }
    if (vendedorId) {
      const regra = await loadComissaoRegra(userId, vendedorId);
      const { lucroLiquido, margemPct } = comissaoLucroBase({
        valorCompra: veiculo.valorCompra,
        valorVenda: valor,
        despesas: veiculo.despesas.map((d) => ({
          valor: Number(d.valor),
          categoria: d.categoria,
          origem_lancamento: d.origem_lancamento,
        })),
      });
      const prev = calcGestaoComissao({
        valorVenda: valor,
        lucroLiquido,
        margemPct,
        regra,
      });
      setComissaoPreview(prev.total);
      setComissaoOverride(String(prev.total));
      setComissaoConfirmAlto(false);
      setComissaoConfirmOpen(true);
      return;
    }
    await commitVenda(null);
  };

  const commitVenda = async (overrideComissao: number | null) => {
    if (!veiculo) return;
    setBusy(true);
    const valor = parseGestaoMoneyField(venda.valor);
    if (valor == null) {
      setBusy(false);
      toast.error("Valor inválido.");
      return;
    }
    if (overrideComissao != null && vendedorId) {
      const guard = validateGestaoComissaoValor(overrideComissao, valor, {
        allowAbove10Pct: comissaoConfirmAlto,
      });
      if (!guard.ok) {
        setBusy(false);
        toast.error(guard.message);
        return;
      }
    }
    const vend = vendedores.find((x) => x.id === vendedorId);
    const { error } = await supabase.from("veiculo_venda" as "veiculos_estoque").upsert({
      user_id: userId,
      veiculo_id: veiculo.id,
      valor_venda: valor,
      data_venda: venda.data,
      vendedor: vend?.nome ?? (venda.vendedor.trim() || null),
      vendedor_id: vendedorId || null,
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
    const comTotal = await syncComissaoAfterVenda({
      userId,
      veiculoId: veiculo.id,
      vendedorId: vendedorId || null,
      valorVenda: valor,
      dataVenda: venda.data,
      valorComissaoOverride: overrideComissao,
      statusVeiculo: venda.marcar ? "vendido" : veiculo.status,
    });
    setBusy(false);
    setComissaoConfirmOpen(false);
    toast.success(
      comTotal > 0
        ? `Venda registrada. Comissão ${formatGestaoMoney(comTotal)} lançada no carro.`
        : "Venda registrada.",
    );
    onSaved();
  };

  if (!veiculo) return null;

  const valorVendaDialog = parseGestaoMoneyField(venda.valor);
  const comissaoDialogValor = parseGestaoMoneyField(comissaoOverride) ?? comissaoPreview;
  const comissaoGuard = valorVendaDialog != null && comissaoDialogValor > 0
    ? validateGestaoComissaoValor(comissaoDialogValor, valorVendaDialog, {
      allowAbove10Pct: comissaoConfirmAlto,
    })
    : { ok: true as const, pctVenda: 0 };
  const comissaoPctLabel = valorVendaDialog != null && valorVendaDialog > 0
    ? formatGestaoPct((comissaoDialogValor / valorVendaDialog) * 100)
    : "—";

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

            {lucro.vendido && (
              <GestaoVendaRaioXPanel
                valorVenda={veiculo.valorVenda}
                valorCompra={veiculo.valorCompra}
                despesas={veiculo.despesas.map((d) => ({
                  valor: Number(d.valor),
                  categoria: d.categoria,
                }))}
              />
            )}

            <section className="space-y-2">
              <h3 className="text-sm font-semibold">Compra</h3>
              <div className="grid gap-2">
                <GestaoMoneyInput
                  label="Valor (R$)"
                  value={compra.valor}
                  onChange={(v) => setCompra({ ...compra, valor: v })}
                />
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
                <GestaoMoneyInput
                  value={despesaForm.valor}
                  onChange={(v) => setDespesaForm({ ...despesaForm, valor: v })}
                  placeholder="Valor"
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
              <GestaoMoneyInput
                label="Valor venda"
                value={venda.valor}
                onChange={(v) => setVenda({ ...venda, valor: v })}
              />
              <Input
                type="date"
                value={venda.data}
                onChange={(e) => setVenda({ ...venda, data: e.target.value })}
              />
              <Label className="text-xs">Vendedor</Label>
              <Select value={vendedorId || "none"} onValueChange={(v) => setVendedorId(v === "none" ? "" : v)}>
                <SelectTrigger><SelectValue placeholder="Selecione" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sem vendedor</SelectItem>
                  {vendedores.filter((v) => v.ativo).map((v) => (
                    <SelectItem key={v.id} value={v.id}>{v.nome}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <label className="flex items-center gap-2 text-sm">
                <input
                  type="checkbox"
                  checked={venda.marcar}
                  onChange={(e) => setVenda({ ...venda, marcar: e.target.checked })}
                />
                Marcar como vendido no estoque
              </label>
              <Button size="sm" disabled={busy} onClick={() => void prepareVenda()}>
                Registrar venda
              </Button>
              {focusnfe.status?.connected && (
                <Button size="sm" variant="secondary" disabled={busy} onClick={() => setNfeOpen(true)}>
                  Emitir nota fiscal
                </Button>
              )}
            </section>
          </div>
          {busy && (
            <p className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
              <Loader2 className="h-4 w-4 animate-spin" /> Salvando…
            </p>
          )}
        </SheetContent>
      </Sheet>

      <AlertDialog open={comissaoConfirmOpen} onOpenChange={setComissaoConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar comissão</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm">
                <p>
                  Comissão calculada: <strong>{formatGestaoMoney(comissaoPreview)}</strong>
                </p>
                <p>Será lançada automaticamente como despesa do carro (categoria comissão).</p>
                <GestaoMoneyInput
                  label="Comissão do vendedor (R$)"
                  value={comissaoOverride}
                  onChange={(v) => {
                    setComissaoOverride(v);
                    setComissaoConfirmAlto(false);
                  }}
                />
                <p className="text-muted-foreground">
                  = {comissaoPctLabel} do valor da venda
                </p>
                {!comissaoGuard.ok && comissaoGuard.code === "above_10pct" && (
                  <div className="space-y-2 rounded-md border border-red-200 bg-red-50 p-2 text-red-700">
                    <p className="font-medium">{comissaoGuard.message}</p>
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={comissaoConfirmAlto}
                        onChange={(e) => setComissaoConfirmAlto(e.target.checked)}
                      />
                      Confirmo este valor
                    </label>
                  </div>
                )}
                {!comissaoGuard.ok && comissaoGuard.code === "gte_venda" && (
                  <p className="font-medium text-red-600">{comissaoGuard.message}</p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              disabled={!comissaoGuard.ok}
              onClick={() => void commitVenda(parseGestaoMoneyField(comissaoOverride) ?? comissaoPreview)}
            >
              Confirmar venda
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {veiculo && (
        <GestaoEmitirNfeDialog
          open={nfeOpen}
          onOpenChange={setNfeOpen}
          veiculo={veiculo}
          onSuccess={onSaved}
        />
      )}

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
