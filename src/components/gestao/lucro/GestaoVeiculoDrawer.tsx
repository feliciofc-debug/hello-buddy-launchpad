import { useCallback, useEffect, useRef, useState } from "react";
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
import { calcularConsignacao } from "../../../../supabase/functions/_shared/consignacao-calc.ts";
import { comissaoLucroBase } from "@/lib/gestao-comissao-lucro.ts";
import { GestaoVendaRaioXPanel } from "@/components/gestao/lucro/GestaoVendaRaioXPanel.tsx";
import { estornarComissaoVeiculo, syncComissaoAfterVenda } from "@/lib/gestao-comissao-client.ts";
import { useGestaoFocusnfeConnection } from "@/components/integracoes/useGestaoFocusnfeConnection";
import { GestaoEmitirNfeDialog } from "@/components/gestao/lucro/GestaoEmitirNfeDialog.tsx";
import { GestaoVeiculoProcedenciaPanel } from "@/components/procedencia/GestaoVeiculoProcedenciaPanel.tsx";

type Props = {
  open: boolean;
  veiculo: GestaoVeiculoEnriched | null;
  userId: string;
  focusVenda?: boolean;
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

export function GestaoVeiculoDrawer({ open, veiculo, userId, focusVenda, onClose, onSaved }: Props) {
  const vendaSectionRef = useRef<HTMLElement | null>(null);
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
    descontarDoConsignante: false,
  });
  const [consignacao, setConsignacao] = useState({
    consignanteNome: "",
    valorGarantido: "",
    pctLoja: "100",
    pisoLoja: "",
    precoMinimo: "",
    dataInicio: hojeSaoPaulo(),
    prazoDias: "90",
    observacao: "",
  });
  const [vendedores, setVendedores] = useState<GestaoVendedor[]>([]);
  const [vendedorId, setVendedorId] = useState<string>("");
  const [comissaoConfirmOpen, setComissaoConfirmOpen] = useState(false);
  const [comissaoPreview, setComissaoPreview] = useState(0);
  const [comissaoOverride, setComissaoOverride] = useState("");
  const [comissaoConfirmAlto, setComissaoConfirmAlto] = useState(false);
  const [undoVendaOpen, setUndoVendaOpen] = useState(false);

  const hasVendaRegistrada = veiculo?.valorVenda != null;

  useEffect(() => {
    if (!userId) return;
    void loadGestaoVendedores(userId).then(setVendedores);
  }, [userId]);

  useEffect(() => {
    if (!open || !focusVenda) return;
    const t = window.setTimeout(() => {
      vendaSectionRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 150);
    return () => window.clearTimeout(t);
  }, [open, focusVenda, veiculo?.id]);

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
    const c = veiculo.consignacao;
    setConsignacao({
      consignanteNome: c?.consignante_nome ?? "",
      valorGarantido: c ? String(c.valor_garantido_dono) : "",
      pctLoja: c ? String(c.pct_loja_excedente) : "100",
      pisoLoja: c?.piso_loja == null ? "" : String(c.piso_loja),
      precoMinimo: c?.preco_minimo_autorizado == null ? "" : String(c.preco_minimo_autorizado),
      dataInicio: c?.data_inicio ?? hojeSaoPaulo(),
      prazoDias: c ? String(c.prazo_dias) : "90",
      observacao: c?.observacao ?? "",
    });
  }, [veiculo]);

  const saveConsignacao = async () => {
    if (!veiculo) return;
    const valorGarantido = parseGestaoMoneyField(consignacao.valorGarantido) ?? 0;
    const pctLoja = Number(consignacao.pctLoja.replace(",", "."));
    const prazoDias = Number(consignacao.prazoDias);
    if (!Number.isFinite(pctLoja) || pctLoja < 0 || pctLoja > 100 || !Number.isInteger(prazoDias) || prazoDias <= 0) {
      toast.error("Confira o percentual da loja e o prazo.");
      return;
    }
    setBusy(true);
    const { error } = await supabase.from("veiculo_consignacao" as "veiculos_estoque").upsert({
      user_id: userId,
      veiculo_id: veiculo.id,
      consignante_nome: consignacao.consignanteNome.trim() || null,
      valor_garantido_dono: valorGarantido,
      pct_loja_excedente: pctLoja,
      piso_loja: parseGestaoMoneyField(consignacao.pisoLoja),
      preco_minimo_autorizado: parseGestaoMoneyField(consignacao.precoMinimo),
      data_inicio: consignacao.dataInicio,
      prazo_dias: prazoDias,
      status: "ativo",
      observacao: consignacao.observacao.trim() || null,
    }, { onConflict: "user_id,veiculo_id" });
    if (!error) {
      await supabase.from("veiculo_compra" as "veiculos_estoque").upsert({
        user_id: userId,
        veiculo_id: veiculo.id,
        valor_compra: valorGarantido,
        data_compra: consignacao.dataInicio,
        origem: "consignacao",
        fornecedor_obs: consignacao.consignanteNome.trim() || null,
      }, { onConflict: "user_id,veiculo_id" });
    }
    setBusy(false);
    if (error) toast.error("Não foi possível salvar a consignação.");
    else {
      toast.success("Consignação salva.");
      onSaved();
    }
  };

  const setConsignacaoStatus = async (status: "ativo" | "devolvido", renovar = false) => {
    if (!veiculo?.consignacao) return;
    setBusy(true);
    const update = renovar
      ? { data_inicio: hojeSaoPaulo(), prazo_dias: 90, status: "ativo" }
      : { status };
    const { error } = await supabase.from("veiculo_consignacao" as "veiculos_estoque")
      .update(update)
      .eq("user_id", userId)
      .eq("veiculo_id", veiculo.id);
    setBusy(false);
    if (error) toast.error("Não foi possível atualizar a consignação.");
    else {
      toast.success(renovar ? "Contrato renovado por 90 dias." : "Veículo devolvido ao consignante.");
      onSaved();
    }
  };

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
      descontar_do_consignante: despesaForm.descontarDoConsignante,
      origem_lancamento: "painel",
      lancado_por: "painel",
    });
    setBusy(false);
    if (error) {
      toast.error("Erro ao lançar despesa.");
      return;
    }
    toast.success("Despesa lançada.");
    setDespesaForm({ ...despesaForm, valor: "", descricao: "", descontarDoConsignante: false });
    onSaved();
  };

  const despesaCategoriaEditavel = (d: GestaoVeiculoEnriched["despesas"][number]) =>
    !(d.categoria === "comissao" && d.origem_lancamento === "automatica");

  const saveDespesaCategoria = async (despesaId: string, categoria: string) => {
    setBusy(true);
    const { error } = await supabase.from("veiculo_despesas" as "veiculos_estoque").update({
      categoria,
    }).eq("id", despesaId);
    setBusy(false);
    if (error) {
      toast.error("Não foi possível alterar a categoria.");
      return;
    }
    toast.success("Categoria atualizada.");
    onSaved();
  };

  const saveDespesaDescontoConsignante = async (
    despesaId: string,
    descontar: boolean,
  ) => {
    setBusy(true);
    const { error } = await supabase.from("veiculo_despesas" as "veiculos_estoque")
      .update({ descontar_do_consignante: descontar })
      .eq("id", despesaId);
    setBusy(false);
    if (error) toast.error("Não foi possível alterar o desconto do dono.");
    else onSaved();
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
      const baseComissao = veiculo.consignacao?.status === "ativo"
        ? calcularConsignacao({
          preco: valor,
          valorGarantidoDono: veiculo.consignacao.valor_garantido_dono,
          pctLojaExcedente: veiculo.consignacao.pct_loja_excedente,
          pisoLoja: veiculo.consignacao.piso_loja,
          despesas: veiculo.despesas
            .filter((d) => d.categoria !== "comissao")
            .map((d) => ({
              valor: Number(d.valor),
              descontarDoConsignante: Boolean(d.descontar_do_consignante),
            })),
          comissaoVendedor: 0,
        })
        : null;
      const proprio = baseComissao
        ? null
        : comissaoLucroBase({
          valorCompra: veiculo.valorCompra,
          valorVenda: valor,
          despesas: veiculo.despesas.map((d) => ({
            valor: Number(d.valor),
            categoria: d.categoria,
            origem_lancamento: d.origem_lancamento,
          })),
        });
      const lucroLiquido = baseComissao?.lucroLoja ?? proprio?.lucroLiquido ?? null;
      const margemPct = baseComissao
        ? (valor > 0 ? baseComissao.lucroLoja / valor * 100 : null)
        : proprio?.margemPct ?? null;
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
    const wasEdit = veiculo.valorVenda != null;
    toast.success(
      comTotal > 0
        ? wasEdit
          ? `Venda atualizada. Comissão ${formatGestaoMoney(comTotal)} relançada.`
          : `Venda registrada. Comissão ${formatGestaoMoney(comTotal)} lançada no carro.`
        : wasEdit ? "Venda atualizada." : "Venda registrada.",
    );
    onSaved();
  };

  const confirmUndoVenda = async () => {
    if (!veiculo) return;
    setBusy(true);
    await estornarComissaoVeiculo(userId, veiculo.id);
    const { error: delErr } = await supabase.from("veiculo_venda" as "veiculos_estoque").delete()
      .eq("user_id", userId)
      .eq("veiculo_id", veiculo.id);
    if (delErr) {
      setBusy(false);
      setUndoVendaOpen(false);
      toast.error("Não foi possível desfazer a venda.");
      return;
    }
    await supabase.from("veiculos_estoque").update({
      status: "disponivel",
      vendido_at: null,
    }).eq("id", veiculo.id);
    setBusy(false);
    setUndoVendaOpen(false);
    toast.success("Venda desfeita. O carro voltou para o estoque.");
    onSaved();
    onClose();
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
  const vendedorDialog = vendedores.find((x) => x.id === vendedorId);
  const vendedorDialogNome = vendedorDialog?.nome ?? "Vendedor";

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
            <p className="text-sm text-muted-foreground capitalize">
              {veiculo.status}
              {veiculo.consignacao?.status === "ativo" ? " · Consignado" : ""}
            </p>
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
            {veiculo.consignacaoResultado && (
              <p className="rounded-md bg-blue-50 p-2 text-sm text-blue-800">
                Dono recebe {formatGestaoMoney(veiculo.consignacaoResultado.repasseDonoLiquido)}
              </p>
            )}
            {veiculo.consignacao?.repasse_aviso && (
              <p className="rounded-md border border-red-300 bg-red-50 p-2 text-sm font-medium text-red-700">
                {veiculo.consignacao.repasse_aviso}
              </p>
            )}

            <GestaoVeiculoProcedenciaPanel
              userId={userId}
              veiculoId={veiculo.id}
              placa={veiculo.placa}
            />

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

            <section className="space-y-3 rounded-lg border border-blue-200 p-3">
              <div>
                <h3 className="text-sm font-semibold">Consignação</h3>
                <p className="text-xs text-muted-foreground">
                  O valor garantido não entra como capital, juros ou IPVA da loja.
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button type="button" size="sm" variant="outline" onClick={() => setConsignacao((c) => ({ ...c, pctLoja: "100", pisoLoja: "" }))}>Valor fixo</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setConsignacao((c) => ({ ...c, valorGarantido: "0", pctLoja: "8", pisoLoja: "5000" }))}>Comissão</Button>
                <Button type="button" size="sm" variant="outline" onClick={() => setConsignacao((c) => ({ ...c, pctLoja: "50", pisoLoja: "" }))}>Híbrido</Button>
              </div>
              <div className="grid gap-2 sm:grid-cols-2">
                <div><Label>Nome do consignante</Label><Input value={consignacao.consignanteNome} onChange={(e) => setConsignacao({ ...consignacao, consignanteNome: e.target.value })} /></div>
                <GestaoMoneyInput label="Valor garantido ao dono" value={consignacao.valorGarantido} onChange={(v) => setConsignacao({ ...consignacao, valorGarantido: v })} />
                <div><Label>Percentual da loja no excedente (%)</Label><Input type="number" min="0" max="100" step="0.01" value={consignacao.pctLoja} onChange={(e) => setConsignacao({ ...consignacao, pctLoja: e.target.value })} /></div>
                <GestaoMoneyInput label="Piso da loja" value={consignacao.pisoLoja} onChange={(v) => setConsignacao({ ...consignacao, pisoLoja: v })} />
                <GestaoMoneyInput label="Preço mínimo autorizado" value={consignacao.precoMinimo} onChange={(v) => setConsignacao({ ...consignacao, precoMinimo: v })} />
                <div><Label>Início</Label><Input type="date" value={consignacao.dataInicio} onChange={(e) => setConsignacao({ ...consignacao, dataInicio: e.target.value })} /></div>
                <div><Label>Prazo (dias)</Label><Input type="number" min="1" value={consignacao.prazoDias} onChange={(e) => setConsignacao({ ...consignacao, prazoDias: e.target.value })} /></div>
                <div><Label>Observação</Label><Input value={consignacao.observacao} onChange={(e) => setConsignacao({ ...consignacao, observacao: e.target.value })} /></div>
              </div>
              <div className="flex flex-wrap gap-2">
                <Button size="sm" disabled={busy} onClick={() => void saveConsignacao()}>Salvar consignação</Button>
                {veiculo.consignacao && (
                  <>
                    <Button size="sm" variant="outline" disabled={busy} onClick={() => void setConsignacaoStatus("ativo", true)}>Renovar +90 dias</Button>
                    <Button size="sm" variant="destructive" disabled={busy} onClick={() => void setConsignacaoStatus("devolvido")}>Devolver</Button>
                  </>
                )}
              </div>
            </section>

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
                    {veiculo.consignacao && d.categoria !== "comissao" && (
                      <label className="mt-1 flex items-center gap-2 text-xs text-blue-700">
                        <input
                          type="checkbox"
                          checked={Boolean(d.descontar_do_consignante)}
                          disabled={busy}
                          onChange={(e) => void saveDespesaDescontoConsignante(d.id, e.target.checked)}
                        />
                        Descontar do dono
                      </label>
                    )}
                    {despesaCategoriaEditavel(d) ? (
                      <div className="mt-2 flex flex-wrap items-center gap-2">
                        <Label className="text-xs text-muted-foreground">Categoria</Label>
                        <Select
                          value={d.categoria}
                          disabled={busy}
                          onValueChange={(v) => void saveDespesaCategoria(d.id, v)}
                        >
                          <SelectTrigger className="h-8 w-[200px] text-xs"><SelectValue /></SelectTrigger>
                          <SelectContent>
                            {GESTAO_DESPESA_CATEGORIAS.filter((c) => c.value !== "comissao").map((c) => (
                              <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">Comissão automática — categoria fixa</p>
                    )}
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
                {veiculo.consignacao?.status === "ativo" && (
                  <label className="flex items-center gap-2 text-sm">
                    <input
                      type="checkbox"
                      checked={despesaForm.descontarDoConsignante}
                      onChange={(e) => setDespesaForm({
                        ...despesaForm,
                        descontarDoConsignante: e.target.checked,
                      })}
                    />
                    Descontar do dono
                  </label>
                )}
                <Button size="sm" variant="outline" disabled={busy} onClick={() => void addDespesa()}>
                  + Despesa
                </Button>
              </div>
            </section>

            <section ref={vendaSectionRef} id="gestao-drawer-venda" className="space-y-2 scroll-mt-4">
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
                {hasVendaRegistrada ? "Salvar venda" : "Registrar venda"}
              </Button>
              {hasVendaRegistrada && (
                <Button size="sm" variant="destructive" disabled={busy} onClick={() => setUndoVendaOpen(true)}>
                  Desfazer venda
                </Button>
              )}
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
            <AlertDialogTitle>Comissão do vendedor — {vendedorDialogNome}</AlertDialogTitle>
            <AlertDialogDescription asChild>
              <div className="space-y-4 text-sm text-foreground">
                <div className="rounded-lg border bg-muted/40 px-3 py-2">
                  <p className="font-medium">
                    Venda: {formatGestaoMoney(valorVendaDialog)} ✓
                  </p>
                  <p className="mt-1 text-xs text-muted-foreground">
                    Valor da venda já confirmado neste passo — não é a comissão.
                  </p>
                </div>

                <div className="space-y-2 border-t pt-4">
                  <p className="font-medium">
                    Quanto o {vendedorDialogNome} vai ganhar nesta venda?
                  </p>
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
                  <p className="text-xs text-muted-foreground">
                    Lançamento automático como despesa do carro (categoria comissão).
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
              </div>
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Voltar e corrigir a venda</AlertDialogCancel>
            <AlertDialogAction
              disabled={!comissaoGuard.ok}
              onClick={() => void commitVenda(parseGestaoMoneyField(comissaoOverride) ?? comissaoPreview)}
            >
              Confirmar comissão
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

      <AlertDialog open={undoVendaOpen} onOpenChange={setUndoVendaOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Desfazer venda?</AlertDialogTitle>
            <AlertDialogDescription>
              O carro volta para o estoque. A venda e a comissão automática serão removidas.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmUndoVenda()}>Desfazer venda</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

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
