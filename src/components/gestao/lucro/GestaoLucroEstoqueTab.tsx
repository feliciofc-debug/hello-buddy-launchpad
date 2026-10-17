import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
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

  const saveCompraInline = async (v: GestaoVeiculoEnriched) => {
    const raw = editingCompra[v.id] ?? "";
    const valor = parseGestaoMoneyField(raw);
    if (valor == null) {
      toast.error("Valor de compra inválido.");
      return;
    }
    const { error } = await supabase.from("veiculo_compra" as "veiculos_estoque").upsert({
      user_id: userId,
      veiculo_id: v.id,
      valor_compra: valor,
      data_compra: v.dataCompra ?? new Date().toISOString().slice(0, 10),
      origem: "compra",
    }, { onConflict: "user_id,veiculo_id" });
    if (error) {
      toast.error("Não foi possível salvar.");
      return;
    }
    toast.success("Compra salva.");
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
                  <td className="py-2 pr-2 font-medium">{vehicleLabel(v)}</td>
                  <td className="py-2 pr-2">{v.placa ?? "—"}</td>
                  <td className="py-2 pr-2 align-top">
                    <Input
                      className="h-8 w-32"
                      placeholder="Compra"
                      value={editingCompra[v.id] ?? (v.valorCompra != null ? String(v.valorCompra) : "")}
                      onChange={(e) => setEditingCompra({ ...editingCompra, [v.id]: e.target.value })}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") void saveCompraInline(v);
                      }}
                    />
                    <p className="max-w-[8rem] truncate text-[10px] text-muted-foreground">
                      {formatGestaoMoneyInputPreview(parseGestaoMoneyBr(editingCompra[v.id] ?? ""))}
                    </p>
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
