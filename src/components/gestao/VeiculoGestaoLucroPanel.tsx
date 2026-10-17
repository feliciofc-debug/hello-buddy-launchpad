import { useCallback, useEffect, useState } from "react";
import { Loader2, Trash2 } from "lucide-react";
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
import { Checkbox } from "@/components/ui/checkbox";
import { calcGestaoLucro } from "../../../supabase/functions/_shared/gestao-lucro-calc.ts";
import { GESTAO_DESPESA_CATEGORIAS, gestaoCategoriaLabel } from "@/lib/gestao-lucro-categories.ts";
import { formatGestaoMoney, formatGestaoPct } from "@/lib/gestao-format.ts";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  veiculoId: string;
  userId: string;
  precoAnunciado: number | null;
  statusVeiculo: string;
  onVendaMarcouVendido?: () => void;
};

export function VeiculoGestaoLucroPanel(props: Props) {
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [compra, setCompra] = useState({
    valor: "",
    data: new Date().toISOString().slice(0, 10),
    origem: "compra",
    fornecedor: "",
  });
  const [despesaForm, setDespesaForm] = useState({
    valor: "",
    data: new Date().toISOString().slice(0, 10),
    categoria: "outros",
    descricao: "",
  });
  const [venda, setVenda] = useState({
    valor: "",
    data: new Date().toISOString().slice(0, 10),
    vendedor: "",
    forma: "",
    marcarVendido: false,
  });
  const [despesas, setDespesas] = useState<Array<{
    id: string;
    data: string;
    categoria: string;
    valor: number;
    descricao: string | null;
  }>>([]);
  const [hasCompra, setHasCompra] = useState(false);
  const [hasVenda, setHasVenda] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [{ data: c }, { data: d }, { data: v }] = await Promise.all([
      supabase.from("veiculo_compra" as "veiculos_estoque").select("*")
        .eq("veiculo_id", props.veiculoId).maybeSingle(),
      supabase.from("veiculo_despesas" as "veiculos_estoque").select("id, data, categoria, valor, descricao")
        .eq("veiculo_id", props.veiculoId).is("deleted_at", null).order("data", { ascending: false }),
      supabase.from("veiculo_venda" as "veiculos_estoque").select("*")
        .eq("veiculo_id", props.veiculoId).maybeSingle(),
    ]);
    if (c) {
      setHasCompra(true);
      setCompra({
        valor: String(c.valor_compra),
        data: c.data_compra,
        origem: c.origem,
        fornecedor: c.fornecedor_obs ?? "",
      });
    }
    setDespesas((d ?? []) as typeof despesas);
    if (v) {
      setHasVenda(true);
      setVenda({
        valor: String(v.valor_venda),
        data: v.data_venda,
        vendedor: v.vendedor ?? "",
        forma: v.forma_pagamento ?? "",
        marcarVendido: false,
      });
    }
    setLoading(false);
  }, [props.veiculoId]);

  useEffect(() => {
    void load();
  }, [load]);

  const lucro = calcGestaoLucro({
    valorCompra: hasCompra ? Number(compra.valor) : null,
    despesas: despesas.map((x) => ({ valor: Number(x.valor), categoria: x.categoria })),
    valorVenda: hasVenda ? Number(venda.valor) : null,
    precoAnunciado: props.precoAnunciado,
    dataCompra: hasCompra ? compra.data : null,
    dataVenda: hasVenda ? venda.data : null,
    statusVeiculo: props.statusVeiculo,
  });

  const saveCompra = async () => {
    setBusy(true);
    const valor = Number(String(compra.valor).replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Informe o valor de compra.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("veiculo_compra" as "veiculos_estoque").upsert({
      user_id: props.userId,
      veiculo_id: props.veiculoId,
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
    toast.success("Compra salva.");
    setHasCompra(true);
    void load();
  };

  const addDespesa = async () => {
    setBusy(true);
    const valor = Number(String(despesaForm.valor).replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Informe o valor da despesa.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("veiculo_despesas" as "veiculos_estoque").insert({
      user_id: props.userId,
      veiculo_id: props.veiculoId,
      valor,
      data: despesaForm.data,
      categoria: despesaForm.categoria,
      descricao: despesaForm.descricao.trim() || null,
      origem_lancamento: "painel",
      lancado_por: "painel",
    });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível salvar a despesa.");
      return;
    }
    toast.success("Despesa lançada.");
    setDespesaForm({ ...despesaForm, valor: "", descricao: "" });
    void load();
  };

  const removeDespesa = async (id: string) => {
    setBusy(true);
    const { error } = await supabase.from("veiculo_despesas" as "veiculos_estoque").update({
      deleted_at: new Date().toISOString(),
      deleted_by: "painel",
    }).eq("id", id);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível excluir.");
      return;
    }
    void load();
  };

  const saveVenda = async () => {
    setBusy(true);
    const valor = Number(String(venda.valor).replace(",", "."));
    if (!Number.isFinite(valor) || valor <= 0) {
      toast.error("Informe o valor de venda.");
      setBusy(false);
      return;
    }
    const { error } = await supabase.from("veiculo_venda" as "veiculos_estoque").upsert({
      user_id: props.userId,
      veiculo_id: props.veiculoId,
      valor_venda: valor,
      data_venda: venda.data,
      vendedor: venda.vendedor.trim() || null,
      forma_pagamento: venda.forma.trim() || null,
      marcou_vendido: venda.marcarVendido,
    }, { onConflict: "user_id,veiculo_id" });
    if (error) {
      setBusy(false);
      toast.error("Não foi possível salvar a venda.");
      return;
    }
    if (venda.marcarVendido) {
      await supabase.from("veiculos_estoque").update({
        status: "vendido",
        vendido_at: new Date().toISOString(),
      }).eq("id", props.veiculoId);
      props.onVendaMarcouVendido?.();
    }
    setBusy(false);
    toast.success("Venda registrada.");
    setHasVenda(true);
    void load();
  };

  if (loading) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="h-4 w-4 animate-spin" /> Custos e lucro…
      </p>
    );
  }

  return (
    <div className="space-y-6 border-t pt-4">
      <div>
        <h3 className="text-sm font-semibold">Custos e lucro</h3>
        <p className="text-xs text-muted-foreground">Uso interno — não aparece para clientes nem portais.</p>
      </div>

      <div className="grid gap-3 rounded-lg border p-3 sm:grid-cols-2">
        <div className="sm:col-span-2 text-xs font-medium text-muted-foreground">Resultado</div>
        <Metric label="Investido" value={formatGestaoMoney(lucro.investido)} />
        {lucro.vendido ? (
          <>
            <Metric label="Lucro líquido" value={formatGestaoMoney(lucro.lucroLiquido)} />
            <Metric label="Margem" value={formatGestaoPct(lucro.margemPct)} />
          </>
        ) : (
          <Metric label="Lucro projetado" value={formatGestaoMoney(lucro.lucroProjetado)} />
        )}
        <Metric label="Dias em estoque" value={lucro.diasEstoque?.toString() ?? "—"} />
      </div>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Compra</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Valor (R$)">
            <Input value={compra.valor} onChange={(e) => setCompra({ ...compra, valor: e.target.value })} />
          </Field>
          <Field label="Data">
            <Input type="date" value={compra.data} onChange={(e) => setCompra({ ...compra, data: e.target.value })} />
          </Field>
          <Field label="Origem">
            <Select value={compra.origem} onValueChange={(v) => setCompra({ ...compra, origem: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="compra">Compra</SelectItem>
                <SelectItem value="troca">Troca</SelectItem>
                <SelectItem value="consignacao">Consignação</SelectItem>
              </SelectContent>
            </Select>
          </Field>
          <Field label="Fornecedor / obs.">
            <Input value={compra.fornecedor} onChange={(e) => setCompra({ ...compra, fornecedor: e.target.value })} />
          </Field>
        </div>
        <Button size="sm" disabled={busy} onClick={() => void saveCompra()}>Salvar compra</Button>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Despesas</h4>
        <ul className="space-y-1 text-sm">
          {despesas.map((d) => (
            <li key={d.id} className="flex items-center justify-between gap-2 rounded border px-2 py-1">
              <span>
                {d.data} · {gestaoCategoriaLabel(d.categoria)} · {formatGestaoMoney(Number(d.valor))}
                {d.descricao ? ` — ${d.descricao}` : ""}
              </span>
              <Button size="icon" variant="ghost" className="h-8 w-8" disabled={busy} onClick={() => void removeDespesa(d.id)}>
                <Trash2 className="h-4 w-4" />
              </Button>
            </li>
          ))}
          {!despesas.length && <li className="text-muted-foreground">Nenhuma despesa.</li>}
        </ul>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Valor">
            <Input value={despesaForm.valor} onChange={(e) => setDespesaForm({ ...despesaForm, valor: e.target.value })} />
          </Field>
          <Field label="Data">
            <Input type="date" value={despesaForm.data} onChange={(e) => setDespesaForm({ ...despesaForm, data: e.target.value })} />
          </Field>
          <Field label="Categoria">
            <Select value={despesaForm.categoria} onValueChange={(v) => setDespesaForm({ ...despesaForm, categoria: v })}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {GESTAO_DESPESA_CATEGORIAS.map((c) => (
                  <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
          <Field label="Descrição">
            <Input value={despesaForm.descricao} onChange={(e) => setDespesaForm({ ...despesaForm, descricao: e.target.value })} />
          </Field>
        </div>
        <Button size="sm" variant="outline" disabled={busy} onClick={() => void addDespesa()}>Adicionar despesa</Button>
      </section>

      <section className="space-y-2">
        <h4 className="text-sm font-medium">Venda</h4>
        <div className="grid gap-2 sm:grid-cols-2">
          <Field label="Valor (R$)">
            <Input value={venda.valor} onChange={(e) => setVenda({ ...venda, valor: e.target.value })} />
          </Field>
          <Field label="Data">
            <Input type="date" value={venda.data} onChange={(e) => setVenda({ ...venda, data: e.target.value })} />
          </Field>
          <Field label="Vendedor">
            <Input value={venda.vendedor} onChange={(e) => setVenda({ ...venda, vendedor: e.target.value })} />
          </Field>
          <Field label="Forma pagamento">
            <Input value={venda.forma} onChange={(e) => setVenda({ ...venda, forma: e.target.value })} />
          </Field>
        </div>
        <label className="flex items-center gap-2 text-sm">
          <Checkbox
            checked={venda.marcarVendido}
            onCheckedChange={(c) => setVenda({ ...venda, marcarVendido: !!c })}
          />
          Marcar veículo como vendido no estoque
        </label>
        <Button size="sm" disabled={busy} onClick={() => void saveVenda()}>Salvar venda</Button>
      </section>
    </div>
  );
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className="font-semibold">{value}</p>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="grid gap-1">
      <Label className="text-xs">{label}</Label>
      {children}
    </div>
  );
}
