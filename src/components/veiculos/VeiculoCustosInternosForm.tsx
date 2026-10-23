import { hojeSaoPaulo } from "../../../supabase/functions/_shared/gestao-date-br.ts";
import {
  forwardRef,
  useCallback,
  useEffect,
  useImperativeHandle,
  useState,
} from "react";
import { ChevronDown, ChevronUp, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import { Textarea } from "@/components/ui/textarea";
import { GestaoMoneyInput } from "@/components/gestao/lucro/GestaoMoneyInput.tsx";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import { GESTAO_DESPESA_CATEGORIAS, gestaoCategoriaLabel } from "@/lib/gestao-lucro-categories.ts";
import { parseGestaoMoneyField } from "@/lib/gestao-money.ts";
import { supabase } from "@/integrations/supabase/client";

export type VeiculoCustosSaveHandle = {
  save: (userId: string, vehicleId: string) => Promise<boolean>;
};

type DespesaRow = {
  id: string;
  valor: number;
  data: string;
  categoria: string;
  descricao: string | null;
  persisted: boolean;
};

type PendingDespesa = {
  tempId: string;
  valor: string;
  data: string;
  categoria: string;
  descricao: string;
};

type Props = {
  vehicleId: string | null;
  defaultExpanded?: boolean;
};

export const VeiculoCustosInternosForm = forwardRef<VeiculoCustosSaveHandle, Props>(
  function VeiculoCustosInternosForm({ vehicleId, defaultExpanded = false }, ref) {
    const [expanded, setExpanded] = useState(defaultExpanded);
    const [loading, setLoading] = useState(false);
    const [compra, setCompra] = useState({
      valor: "",
      data: hojeSaoPaulo(),
      origem: "compra",
      fornecedor: "",
    });
    const [despesas, setDespesas] = useState<DespesaRow[]>([]);
    const [pending, setPending] = useState<PendingDespesa[]>([]);
    const [draft, setDraft] = useState<PendingDespesa>({
      tempId: "",
      valor: "",
      data: hojeSaoPaulo(),
      categoria: "outros",
      descricao: "",
    });

    useEffect(() => {
      setExpanded(defaultExpanded);
    }, [defaultExpanded]);

    const load = useCallback(async () => {
      if (!vehicleId) {
        setCompra({
          valor: "",
          data: hojeSaoPaulo(),
          origem: "compra",
          fornecedor: "",
        });
        setDespesas([]);
        setPending([]);
        return;
      }
      setLoading(true);
      const [{ data: c }, { data: d }] = await Promise.all([
        supabase.from("veiculo_compra" as "veiculos_estoque")
          .select("valor_compra, data_compra, origem, fornecedor_obs")
          .eq("veiculo_id", vehicleId)
          .maybeSingle(),
        supabase.from("veiculo_despesas" as "veiculos_estoque")
          .select("id, valor, data, categoria, descricao")
          .eq("veiculo_id", vehicleId)
          .is("deleted_at", null)
          .order("data", { ascending: false }),
      ]);
      if (c) {
        setCompra({
          valor: String(c.valor_compra ?? ""),
          data: c.data_compra ?? hojeSaoPaulo(),
          origem: String(c.origem ?? "compra"),
          fornecedor: String(c.fornecedor_obs ?? ""),
        });
      } else {
        setCompra({
          valor: "",
          data: hojeSaoPaulo(),
          origem: "compra",
          fornecedor: "",
        });
      }
      setDespesas(
        (d ?? []).map((row) => ({
          id: String(row.id),
          valor: Number(row.valor),
          data: String(row.data),
          categoria: String(row.categoria),
          descricao: row.descricao ? String(row.descricao) : null,
          persisted: true,
        })),
      );
      setPending([]);
      setLoading(false);
    }, [vehicleId]);

    useEffect(() => {
      void load();
    }, [load]);

    const addPendingDespesa = () => {
      const valor = parseGestaoMoneyField(draft.valor);
      if (valor == null) {
        toast.error("Informe o valor da despesa.");
        return;
      }
      setPending((prev) => [
        ...prev,
        {
          ...draft,
          tempId: crypto.randomUUID(),
          valor: String(valor),
        },
      ]);
      setDraft({
        tempId: "",
        valor: "",
        data: hojeSaoPaulo(),
        categoria: "outros",
        descricao: "",
      });
    };

    const removePending = (tempId: string) => {
      setPending((prev) => prev.filter((p) => p.tempId !== tempId));
    };

    const softDeleteDespesa = async (id: string) => {
      const { error } = await supabase.from("veiculo_despesas" as "veiculos_estoque").update({
        deleted_at: new Date().toISOString(),
        deleted_by: "painel",
      }).eq("id", id);
      if (error) {
        toast.error("Não foi possível remover a despesa.");
        return;
      }
      setDespesas((prev) => prev.filter((d) => d.id !== id));
    };

    const save = useCallback(async (userId: string, vid: string): Promise<boolean> => {
      const valorCompra = parseGestaoMoneyField(compra.valor);
      if (valorCompra != null && valorCompra > 0) {
        const { error } = await supabase.from("veiculo_compra" as "veiculos_estoque").upsert({
          user_id: userId,
          veiculo_id: vid,
          valor_compra: valorCompra,
          data_compra: compra.data,
          origem: compra.origem,
          fornecedor_obs: compra.fornecedor.trim() || null,
        }, { onConflict: "user_id,veiculo_id" });
        if (error) {
          toast.error("Não foi possível salvar o custo de compra.");
          return false;
        }
      }

      for (const p of pending) {
        const valor = Number(p.valor);
        const { error } = await supabase.from("veiculo_despesas" as "veiculos_estoque").insert({
          user_id: userId,
          veiculo_id: vid,
          valor,
          data: p.data,
          categoria: p.categoria,
          descricao: p.descricao.trim() || null,
          origem_lancamento: "painel",
          lancado_por: "painel",
        });
        if (error) {
          toast.error("Erro ao salvar uma despesa.");
          return false;
        }
      }
      if (pending.length) setPending([]);
      await load();
      return true;
    }, [compra, pending, load]);

    useImperativeHandle(ref, () => ({ save }), [save]);

    const valorPreview = parseGestaoMoneyField(compra.valor);

    return (
      <div className="sm:col-span-2 rounded-lg border border-dashed border-amber-500/40 bg-amber-500/5">
        <button
          type="button"
          className="flex w-full items-center justify-between gap-2 px-4 py-3 text-left"
          onClick={() => setExpanded((e) => !e)}
        >
          <div>
            <p className="font-medium">Custos — uso interno (o cliente nunca vê)</p>
            <p className="text-xs text-muted-foreground">
              Compra e despesas não vão para vitrine, portais ou anúncios.
            </p>
          </div>
          {expanded ? <ChevronUp className="h-5 w-5 shrink-0" /> : <ChevronDown className="h-5 w-5 shrink-0" />}
        </button>
        {expanded && (
          <div className="space-y-4 border-t px-4 pb-4 pt-3">
            {loading ? (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-4 w-4 animate-spin" />
                Carregando custos…
              </div>
            ) : (
              <>
                <div className="grid gap-3 sm:grid-cols-2">
                  <div>
                    <Label>Valor de compra</Label>
                    <GestaoMoneyInput
                      value={compra.valor}
                      onChange={(v) => setCompra({ ...compra, valor: v })}
                    />
                    {valorPreview != null && (
                      <p className="mt-1 text-xs text-muted-foreground">
                        Prévia: {formatGestaoMoney(valorPreview)}
                      </p>
                    )}
                  </div>
                  <div>
                    <Label>Data da compra</Label>
                    <Input
                      type="date"
                      value={compra.data}
                      onChange={(e) => setCompra({ ...compra, data: e.target.value })}
                    />
                  </div>
                  <div>
                    <Label>Origem</Label>
                    <Select value={compra.origem} onValueChange={(v) => setCompra({ ...compra, origem: v })}>
                      <SelectTrigger><SelectValue /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="compra">Compra</SelectItem>
                        <SelectItem value="troca">Troca</SelectItem>
                        <SelectItem value="consignacao">Consignação</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Fornecedor / observação</Label>
                    <Textarea
                      rows={2}
                      value={compra.fornecedor}
                      onChange={(e) => setCompra({ ...compra, fornecedor: e.target.value })}
                    />
                  </div>
                </div>

                <div className="space-y-3">
                  <p className="text-sm font-medium">Despesas deste carro</p>
                  <ul className="space-y-2 text-sm">
                    {despesas.map((d) => (
                      <li key={d.id} className="flex items-center justify-between gap-2 rounded border bg-background px-2 py-1.5">
                        <span>
                          {formatGestaoMoney(d.valor)} · {gestaoCategoriaLabel(d.categoria)} · {d.data}
                          {d.descricao ? ` — ${d.descricao}` : ""}
                        </span>
                        <Button type="button" size="icon" variant="ghost" onClick={() => void softDeleteDespesa(d.id)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                    {pending.map((p) => (
                      <li key={p.tempId} className="flex items-center justify-between gap-2 rounded border border-primary/30 bg-primary/5 px-2 py-1.5">
                        <span>
                          {formatGestaoMoney(Number(p.valor))} · {gestaoCategoriaLabel(p.categoria)} · {p.data}
                          {p.descricao ? ` — ${p.descricao}` : ""}
                          <span className="ml-1 text-xs text-muted-foreground">(nova)</span>
                        </span>
                        <Button type="button" size="icon" variant="ghost" onClick={() => removePending(p.tempId)}>
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </li>
                    ))}
                    {!despesas.length && !pending.length && (
                      <li className="text-muted-foreground">Nenhuma despesa lançada.</li>
                    )}
                  </ul>
                  <div className="grid gap-2 rounded-md border p-3 sm:grid-cols-2">
                    <div>
                      <Label>Valor</Label>
                      <GestaoMoneyInput value={draft.valor} onChange={(v) => setDraft({ ...draft, valor: v })} />
                    </div>
                    <div>
                      <Label>Data</Label>
                      <Input type="date" value={draft.data} onChange={(e) => setDraft({ ...draft, data: e.target.value })} />
                    </div>
                    <div>
                      <Label>Categoria</Label>
                      <Select value={draft.categoria} onValueChange={(v) => setDraft({ ...draft, categoria: v })}>
                        <SelectTrigger><SelectValue /></SelectTrigger>
                        <SelectContent>
                          {GESTAO_DESPESA_CATEGORIAS.map((c) => (
                            <SelectItem key={c} value={c}>{gestaoCategoriaLabel(c)}</SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    </div>
                    <div>
                      <Label>Descrição</Label>
                      <Input value={draft.descricao} onChange={(e) => setDraft({ ...draft, descricao: e.target.value })} />
                    </div>
                    <div className="sm:col-span-2">
                      <Button type="button" variant="secondary" size="sm" onClick={addPendingDespesa}>
                        + Adicionar despesa
                      </Button>
                    </div>
                  </div>
                </div>
              </>
            )}
          </div>
        )}
      </div>
    );
  },
);
