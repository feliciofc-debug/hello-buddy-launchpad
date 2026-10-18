import { useCallback, useEffect, useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { hojeSaoPaulo } from "../../../../supabase/functions/_shared/gestao-date-br.ts";
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
import {
  formatGestaoMoneyInputPreview,
  parseGestaoMoneyBr,
  parseGestaoMoneyField,
} from "@/lib/gestao-money.ts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { isActiveStock, vehicleDays, vehicleLabel } from "@/lib/gestao-lucro-data.ts";
import {
  formatGestaoMoney,
  formatGestaoPct,
  gestaoLucroTone,
  gestaoMargemPct,
} from "@/lib/gestao-format.ts";
import { supabase } from "@/integrations/supabase/client";

type SortKey = "dias" | "lucro" | "preco" | "marca";

type Props = {
  veiculos: GestaoVeiculoEnriched[];
  userId: string;
  highlightIds: Set<string>;
  onRefresh: () => void;
  onOpenDrawer: (v: GestaoVeiculoEnriched) => void;
  onQuickDespesa: (v: GestaoVeiculoEnriched) => void;
};

function compraFieldValue(v: GestaoVeiculoEnriched, editing: Record<string, string>): string {
  return editing[v.id] ?? (v.valorCompra != null ? String(v.valorCompra) : "");
}

function isCompraDirty(v: GestaoVeiculoEnriched, editing: Record<string, string>): boolean {
  const raw = compraFieldValue(v, editing);
  if (!raw.trim()) return v.valorCompra != null;
  const parsed = parseGestaoMoneyField(raw);
  if (parsed == null) return true;
  return v.valorCompra == null || parsed !== v.valorCompra;
}

function vendaRegistradaSemVendido(v: GestaoVeiculoEnriched): boolean {
  return v.valorVenda != null && v.status !== "vendido";
}

export function GestaoLucroEstoqueTab({
  veiculos,
  userId,
  highlightIds,
  onRefresh,
  onOpenDrawer,
  onQuickDespesa,
}: Props) {
  const [q, setQ] = useState("");
  const [status, setStatus] = useState<string>("all");
  const [sort, setSort] = useState<SortKey>("dias");
  const [editingCompra, setEditingCompra] = useState<Record<string, string>>({});
  const [editingPreco, setEditingPreco] = useState<Record<string, string>>({});
  const [precoConfirm, setPrecoConfirm] = useState<{
    veiculo: GestaoVeiculoEnriched;
    novo: number;
  } | null>(null);
  const [touchedCompra, setTouchedCompra] = useState<Record<string, boolean>>({});
  const [savingCompra, setSavingCompra] = useState(false);

  const stock = useMemo(() => {
    let list = veiculos.filter(isActiveStock);
    if (status !== "all") list = list.filter((v) => v.status === status);
    if (highlightIds.size) list = list.filter((v) => highlightIds.has(v.id));
    const term = q.trim().toLowerCase();
    if (term) {
      list = list.filter((v) => {
        const blob = [vehicleLabel(v), v.placa, v.codigo_origem].filter(Boolean).join(" ").toLowerCase();
        return blob.includes(term);
      });
    }
    list = [...list].sort((a, b) => {
      if (sort === "dias") return vehicleDays(b) - vehicleDays(a);
      if (sort === "preco") return (b.preco ?? 0) - (a.preco ?? 0);
      if (sort === "marca") return vehicleLabel(a).localeCompare(vehicleLabel(b));
      const la = a.lucro.lucroProjetado ?? -Infinity;
      const lb = b.lucro.lucroProjetado ?? -Infinity;
      return lb - la;
    });
    return list;
  }, [veiculos, status, q, sort, highlightIds]);

  const totals = useMemo(() => {
    let preco = 0;
    let investido = 0;
    let lucro = 0;
    for (const v of stock) {
      preco += v.preco ?? 0;
      if (!v.lucro.custoCompraPendente && v.lucro.investido != null) {
        investido += v.lucro.investido;
        lucro += v.lucro.lucroProjetado ?? 0;
      }
    }
    return { preco, investido, lucro, qtd: stock.length };
  }, [stock]);

  const unsavedCompraVeiculos = useMemo(
    () => stock.filter((v) => isCompraDirty(v, editingCompra)),
    [stock, editingCompra],
  );

  useEffect(() => {
    if (!unsavedCompraVeiculos.length) return;
    const onBeforeUnload = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = "";
    };
    window.addEventListener("beforeunload", onBeforeUnload);
    return () => window.removeEventListener("beforeunload", onBeforeUnload);
  }, [unsavedCompraVeiculos.length]);

  const saveCompraInline = useCallback(async (v: GestaoVeiculoEnriched) => {
    const raw = compraFieldValue(v, editingCompra);
    const valor = parseGestaoMoneyField(raw);
    if (valor == null) {
      toast.error("Valor de compra inválido.");
      return false;
    }
    const { error } = await supabase.from("veiculo_compra" as "veiculos_estoque").upsert({
      user_id: userId,
      veiculo_id: v.id,
      valor_compra: valor,
      data_compra: v.dataCompra ?? hojeSaoPaulo(),
      origem: "compra",
    }, { onConflict: "user_id,veiculo_id" });
    if (error) {
      toast.error("Não foi possível salvar.");
      return false;
    }
    setEditingCompra((prev) => {
      const next = { ...prev };
      delete next[v.id];
      return next;
    });
    setTouchedCompra((prev) => {
      const next = { ...prev };
      delete next[v.id];
      return next;
    });
    return true;
  }, [editingCompra, userId]);

  const saveAllCompras = async () => {
    if (!unsavedCompraVeiculos.length) return;
    setSavingCompra(true);
    let ok = 0;
    for (const v of unsavedCompraVeiculos) {
      if (await saveCompraInline(v)) ok += 1;
    }
    setSavingCompra(false);
    if (ok > 0) {
      toast.success(ok === 1 ? "Compra salva." : `${ok} compras salvas.`);
      onRefresh();
    }
  };

  const markSoldQuick = async (v: GestaoVeiculoEnriched) => {
    const { error: stErr } = await supabase.from("veiculos_estoque").update({
      status: "vendido",
      vendido_at: new Date().toISOString(),
    }).eq("id", v.id);
    if (stErr) {
      toast.error("Não foi possível marcar como vendido.");
      return;
    }
    await supabase.from("veiculo_venda" as "veiculos_estoque").update({ marcou_vendido: true })
      .eq("user_id", userId)
      .eq("veiculo_id", v.id);
    toast.success("Veículo marcado como vendido no estoque.");
    onRefresh();
  };

  const requestPrecoConfirm = (v: GestaoVeiculoEnriched) => {
    const raw = editingPreco[v.id] ?? "";
    const novo = parseGestaoMoneyField(raw, { allowZero: false });
    if (novo == null) {
      toast.error("Preço inválido.");
      return;
    }
    if (v.preco != null && novo === v.preco) return;
    setPrecoConfirm({ veiculo: v, novo });
  };

  const applyPrecoConfirm = async () => {
    if (!precoConfirm) return;
    const { veiculo, novo } = precoConfirm;
    const { error } = await supabase.from("veiculos_estoque").update({ preco: novo }).eq("id", veiculo.id);
    setPrecoConfirm(null);
    if (error) {
      toast.error("Erro ao atualizar preço.");
      return;
    }
    toast.success("Preço anunciado atualizado.");
    onRefresh();
  };

  const precoExtreme =
    precoConfirm?.veiculo.preco != null &&
    precoConfirm.veiculo.preco > 0 &&
    (precoConfirm.novo < precoConfirm.veiculo.preco * 0.5 ||
      precoConfirm.novo > precoConfirm.veiculo.preco * 2);

  if (!stock.length && !veiculos.some(isActiveStock)) {
    return (
      <div className="rounded-lg border border-dashed p-12 text-center">
        <p className="font-medium">Nenhum veículo no estoque ativo</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Cadastre veículos disponíveis ou reservados para acompanhar lucro aqui.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {unsavedCompraVeiculos.length > 0 && (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-sm">
          <span>
            {unsavedCompraVeiculos.length} valor
            {unsavedCompraVeiculos.length === 1 ? "" : "es"} de compra não salvo
            {unsavedCompraVeiculos.length === 1 ? "" : "s"}
          </span>
          <Button size="sm" disabled={savingCompra} onClick={() => void saveAllCompras()}>
            Salvar todos
          </Button>
        </div>
      )}
      <div className="flex flex-wrap gap-2">
        <div className="relative min-w-[200px] flex-1">
          <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
          <Input
            className="pl-8"
            placeholder="Buscar placa, código, marca…"
            value={q}
            onChange={(e) => setQ(e.target.value)}
          />
        </div>
        <Select value={status} onValueChange={setStatus}>
          <SelectTrigger className="w-[140px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos</SelectItem>
            <SelectItem value="disponivel">Disponível</SelectItem>
            <SelectItem value="reservado">Reservado</SelectItem>
          </SelectContent>
        </Select>
        <Select value={sort} onValueChange={(v) => setSort(v as SortKey)}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Ordenar" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="dias">Dias (maior)</SelectItem>
            <SelectItem value="lucro">Lucro projetado</SelectItem>
            <SelectItem value="preco">Preço</SelectItem>
            <SelectItem value="marca">Marca / modelo</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div className="hidden overflow-x-auto md:block">
        <table className="w-full min-w-[960px] text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-2 pr-2">Foto</th>
              <th className="pb-2 pr-2">Veículo</th>
              <th className="pb-2 pr-2">Placa</th>
              <th className="pb-2 pr-2">Compra (R$)</th>
              <th className="pb-2 pr-2">Despesas</th>
              <th className="pb-2 pr-2">Preço</th>
              <th className="pb-2 pr-2">Investido</th>
              <th className="pb-2 pr-2">Lucro proj.</th>
              <th className="pb-2 pr-2">Margem</th>
              <th className="pb-2 pr-2">Dias</th>
              <th className="pb-2">Ações</th>
            </tr>
          </thead>
          <tbody>
            {stock.map((v) => {
              const margem = gestaoMargemPct(v.lucro.lucroProjetado, v.preco);
              const foto = v.fotos?.[0];
              return (
                <tr
                  key={v.id}
                  className={`border-b last:border-0 ${highlightIds.has(v.id) ? "bg-amber-500/5" : ""}`}
                >
                  <td className="py-2 pr-2">
                    {foto ? (
                      <img src={foto} alt="" className="h-10 w-14 rounded object-cover" />
                    ) : (
                      <div className="flex h-10 w-14 items-center justify-center rounded bg-muted text-xs">—</div>
                    )}
                  </td>
                  <td className="py-2 pr-2 font-medium">
                    <div>{vehicleLabel(v)}</div>
                    {vendaRegistradaSemVendido(v) && (
                      <div className="mt-1 flex flex-wrap items-center gap-1">
                        <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-900">
                          Venda registrada — marcar vendido
                        </span>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="h-6 px-2 text-[10px]"
                          onClick={() => void markSoldQuick(v)}
                        >
                          Marcar vendido
                        </Button>
                      </div>
                    )}
                  </td>
                  <td className="py-2 pr-2">{v.placa ?? "—"}</td>
                  <td className="py-2 pr-2 align-top">
                    <div className="flex items-start gap-1">
                      <Input
                        className={`h-8 w-32 ${
                          isCompraDirty(v, editingCompra) ? "border-amber-400 ring-1 ring-amber-200" : ""
                        }`}
                        placeholder="Compra"
                        value={compraFieldValue(v, editingCompra)}
                        onChange={(e) => setEditingCompra({ ...editingCompra, [v.id]: e.target.value })}
                        onBlur={() => setTouchedCompra((t) => ({ ...t, [v.id]: true }))}
                      />
                      {isCompraDirty(v, editingCompra) && (
                        <Button
                          type="button"
                          size="sm"
                          className="h-8 shrink-0"
                          disabled={savingCompra}
                          onClick={() => void saveCompraInline(v).then((saved) => {
                            if (saved) {
                              toast.success("Compra salva.");
                              onRefresh();
                            }
                          })}
                        >
                          Salvar
                        </Button>
                      )}
                    </div>
                    <p className="max-w-[8rem] truncate text-[10px] text-muted-foreground">
                      {formatGestaoMoneyInputPreview(parseGestaoMoneyBr(compraFieldValue(v, editingCompra)))}
                    </p>
                    {touchedCompra[v.id] && isCompraDirty(v, editingCompra) && (
                      <p className="text-[10px] font-medium text-amber-700">não salvo</p>
                    )}
                  </td>
                  <td className="py-2 pr-2">
                    <button
                      type="button"
                      className="text-primary underline-offset-2 hover:underline"
                      onClick={() => onOpenDrawer(v)}
                    >
                      {formatGestaoMoney(v.lucro.totalDespesas)}
                    </button>
                  </td>
                  <td className="py-2 pr-2 align-top">
                    <Input
                      className="h-8 w-32"
                      placeholder="Preço"
                      value={
                        editingPreco[v.id] ??
                        (v.preco != null ? String(v.preco) : "")
                      }
                      onChange={(e) => setEditingPreco({ ...editingPreco, [v.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") requestPrecoConfirm(v);
                      }}
                    />
                    <p className="max-w-[8rem] truncate text-[10px] text-muted-foreground">
                      {formatGestaoMoneyInputPreview(
                        parseGestaoMoneyBr(editingPreco[v.id] ?? String(v.preco ?? "")),
                      )}
                    </p>
                  </td>
                  <td className="py-2 pr-2">
                    {v.lucro.custoCompraPendente ? (
                      <span className="text-amber-600">Pendente</span>
                    ) : (
                      formatGestaoMoney(v.lucro.investido)
                    )}
                  </td>
                  <td className={`py-2 pr-2 font-medium ${gestaoLucroTone(v.lucro.lucroProjetado)}`}>
                    {v.lucro.custoCompraPendente ? "—" : formatGestaoMoney(v.lucro.lucroProjetado)}
                  </td>
                  <td className={`py-2 pr-2 ${gestaoLucroTone(margem)}`}>{formatGestaoPct(margem)}</td>
                  <td className="py-2 pr-2">{vehicleDays(v)}</td>
                  <td className="py-2">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="outline" onClick={() => onQuickDespesa(v)}>+ Despesa</Button>
                      <Button size="sm" variant="outline" onClick={() => onOpenDrawer(v)}>Registrar venda</Button>
                      <Button size="sm" variant="ghost" onClick={() => onOpenDrawer(v)}>Detalhes</Button>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
          <tfoot>
            <tr className="border-t font-medium">
              <td colSpan={5} className="py-2 pr-2">Totais ({totals.qtd})</td>
              <td className="py-2 pr-2">{formatGestaoMoney(totals.preco)}</td>
              <td className="py-2 pr-2">{formatGestaoMoney(totals.investido)}</td>
              <td className={`py-2 pr-2 ${gestaoLucroTone(totals.lucro)}`}>{formatGestaoMoney(totals.lucro)}</td>
              <td colSpan={3} />
            </tr>
          </tfoot>
        </table>
      </div>

      <div className="space-y-3 md:hidden">
        {stock.map((v) => {
          const margem = gestaoMargemPct(v.lucro.lucroProjetado, v.preco);
          return (
            <div key={v.id} className="rounded-lg border p-4 space-y-2">
              <p className="font-semibold">{vehicleLabel(v)}</p>
              <p className="text-xs text-muted-foreground capitalize">{v.status} · {vehicleDays(v)} dias</p>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <span>Preço: {formatGestaoMoney(v.preco)}</span>
                <span className={gestaoLucroTone(v.lucro.lucroProjetado)}>
                  Lucro: {v.lucro.custoCompraPendente ? "Pendente" : formatGestaoMoney(v.lucro.lucroProjetado)}
                </span>
              </div>
              <p className={`text-sm ${gestaoLucroTone(margem)}`}>Margem {formatGestaoPct(margem)}</p>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" variant="outline" onClick={() => onOpenDrawer(v)}>Detalhes</Button>
                <Button size="sm" variant="outline" onClick={() => onQuickDespesa(v)}>+ Despesa</Button>
              </div>
            </div>
          );
        })}
      </div>

      <AlertDialog open={!!precoConfirm} onOpenChange={() => setPrecoConfirm(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Alterar preço anunciado?</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-2 text-sm text-muted-foreground">
                <p>
                  Alterar preço anunciado de{" "}
                  <strong>{formatGestaoMoney(precoConfirm?.veiculo.preco)}</strong> para{" "}
                  <strong>{formatGestaoMoney(precoConfirm?.novo ?? null)}</strong>?
                </p>
                <p>Isso muda a vitrine e os portais.</p>
                {precoExtreme && (
                  <p className="font-medium text-red-600">
                    Atenção: a variação é maior que 50% em relação ao preço atual. Confirme se
                    não é erro de digitação.
                  </p>
                )}
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void applyPrecoConfirm()}>Confirmar</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
