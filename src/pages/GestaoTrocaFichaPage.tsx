import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
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
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import type { GestaoTrocaEvento, GestaoTrocaRow } from "@/lib/gestao-troca-types.ts";
import { downloadGestaoTrocaRelatorioPdf } from "@/lib/gestao-troca-relatorio-pdf.ts";
import { GestaoMoneyInput } from "@/components/gestao/lucro/GestaoMoneyInput.tsx";
import { GestaoTrocaChecklistPanel } from "@/components/gestao/trocas/GestaoTrocaChecklistPanel.tsx";
import { GestaoTrocaFotoGaleria } from "@/components/gestao/trocas/GestaoTrocaFotoGaleria.tsx";
import { GestaoTrocaLaudoIaPanel } from "@/components/gestao/trocas/GestaoTrocaLaudoIaPanel.tsx";
import { pollProcedenciaConsulta } from "@/components/procedencia/useProcedenciaConnection.ts";
import type { GestaoTrocaChecklistJson } from "@/lib/gestao-troca-checklist.ts";
import { parseGestaoMoneyBr } from "@/lib/gestao-money.ts";
import {
  gestaoTrocaFotoPaths,
  normalizeGestaoTrocaFotos,
  type GestaoTrocaFotoEntry,
} from "@/lib/gestao-troca-fotos.ts";
import { fetchLatestGestaoTrocaLaudo } from "@/lib/gestao-troca-ia-api.ts";
import type { GestaoTrocaLaudoPdfSection } from "@/lib/gestao-troca-relatorio-pdf.ts";
import {
  buildGestaoTrocaKbbUrl,
  GESTAO_TROCA_KBB_CATEGORIAS,
  labelGestaoTrocaKbbLink,
  lojaUfParaKbb,
} from "@/lib/gestao-troca-kbb-url.ts";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export default function GestaoTrocaFichaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [troca, setTroca] = useState<GestaoTrocaRow | null>(null);
  const [eventos, setEventos] = useState<GestaoTrocaEvento[]>([]);
  const [busy, setBusy] = useState(false);
  const [userId, setUserId] = useState("");
  const [liberarOpen, setLiberarOpen] = useState(false);
  const [precoVendaInput, setPrecoVendaInput] = useState("");
  const [repasseOpen, setRepasseOpen] = useState(false);
  const [repasseComprador, setRepasseComprador] = useState("");
  const [repasseValor, setRepasseValor] = useState("");
  const [repasseData, setRepasseData] = useState(() => new Date().toISOString().slice(0, 10));
  const [lojaUf, setLojaUf] = useState("sp");
  const [laudoKmBloqueio, setLaudoKmBloqueio] = useState({ alertaKm: false, kmConferido: false });

  const load = useCallback(async () => {
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (user) {
      setUserId(user.id);
      const { data: profile } = await supabase.from("profiles").select("endereco").eq("id", user.id)
        .maybeSingle();
      let cidadeUf: string | null = null;
      if (user.email) {
        const { data: cad } = await supabase.from("amz_auto_cadastros").select("cidade_uf")
          .eq("email", user.email).order("created_at", { ascending: false }).limit(1).maybeSingle();
        cidadeUf = cad?.cidade_uf ?? null;
      }
      setLojaUf(lojaUfParaKbb({ endereco: profile?.endereco, cidade_uf: cidadeUf }));
    }
    const { data: t } = await supabase.from("gestao_troca" as "veiculos_estoque").select("*")
      .eq("id", id).maybeSingle();
    if (!t) {
      navigate("/gestao/trocas");
      return;
    }
    setTroca(t as unknown as GestaoTrocaRow);
    const { data: ev } = await supabase.from("gestao_troca_evento" as "veiculos_estoque")
      .select("*").eq("troca_id", id).order("created_at", { ascending: true });
    setEventos((ev ?? []) as unknown as GestaoTrocaEvento[]);
  }, [id, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const savePatch = async (patch: Record<string, unknown>) => {
    if (!id) return;
    setBusy(true);
    const { error } = await supabase.from("gestao_troca" as "veiculos_estoque").update(patch).eq("id", id);
    setBusy(false);
    if (error) toast.error("Falha ao salvar.");
    else void load();
  };

  const recalcular = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-troca", {
      body: { action: "recalcular", troca_id: id },
    });
    setBusy(false);
    if (error || !data?.success) toast.error(data?.error ?? "Falha ao recalcular.");
    else void load();
  };

  const buscarFipe = async () => {
    if (!troca) return;
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-troca", {
      body: {
        action: "fipe_buscar",
        marca: troca.marca,
        modelo: troca.modelo,
        ano_modelo: troca.ano_modelo,
      },
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "FIPE não encontrada.");
      return;
    }
    await savePatch({
      fipe_valor: data.fipe_valor,
      fipe_mes_ref: data.fipe_mes_ref,
      kbb_troca: null,
      kbb_loja: null,
      kbb_km_caracteristico: null,
    });
    setTroca((t) => t ? {
      ...t,
      fipe_valor: data.fipe_valor,
      fipe_mes_ref: data.fipe_mes_ref,
      kbb_troca: null,
      kbb_loja: null,
      kbb_km_caracteristico: null,
    } : t);
    toast.success("FIPE atualizada — valores KBB limpos (use a FIPE como referência).");
  };

  const consultarProcedencia = async () => {
    if (!troca?.placa) {
      toast.error("Informe a placa.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("veiculo-procedencia", {
      body: { action: "consultar", placa: troca.placa, confirmado: true },
    });
    if (error || !data?.success) {
      setBusy(false);
      toast.error(data?.error ?? "Falha na procedência.");
      return;
    }
    const consultaId = String(data.consulta_id ?? "");
    await savePatch({ procedencia_consulta_id: consultaId });
    const polled = await pollProcedenciaConsulta(consultaId);
    setBusy(false);
    if (polled?.status === "concluida") {
      toast.success("Procedência concluída.");
      await recalcular();
    }
  };

  const transicao = async (acao: string, extra?: Record<string, unknown>) => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-troca", {
      body: { action: "transicao", troca_id: id, acao, ...extra },
    });
    setBusy(false);
    if (error || !data?.success) toast.error(data?.error ?? "Ação não permitida.");
    else void load();
  };

  const saveChecklist = async (checklist: GestaoTrocaChecklistJson, preparacao: number) => {
    setTroca((t) => (t ? { ...t, checklist_json: checklist, preparacao_estimada: preparacao } : t));
    await savePatch({ checklist_json: checklist, preparacao_estimada: preparacao });
    await recalcular();
  };

  const openLiberar = () => {
    const preco = troca?.kbb_loja ?? troca?.valor_sugerido ?? 0;
    setPrecoVendaInput(String(preco ?? ""));
    setLiberarOpen(true);
  };

  const confirmLiberar = async () => {
    const precoFinal = parseGestaoMoneyBr(precoVendaInput);
    if (precoFinal == null || precoFinal <= 0) {
      toast.error("Informe o preço de venda.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-troca", {
      body: { action: "liberar_estoque", troca_id: id, preco_venda: precoFinal },
    });
    setBusy(false);
    setLiberarOpen(false);
    if (error || !data?.success) toast.error(data?.error ?? "Falha.");
    else {
      toast.success("Liberado para estoque / vitrine.");
      void load();
    }
  };

  const confirmRepasse = async () => {
    if (!repasseComprador.trim()) {
      toast.error("Informe o comprador.");
      return;
    }
    const valor = parseGestaoMoneyBr(repasseValor);
    if (valor == null || valor <= 0) {
      toast.error("Informe o valor do repasse.");
      return;
    }
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-troca", {
      body: {
        action: "repasse",
        troca_id: id,
        comprador: repasseComprador.trim(),
        valor,
        data: repasseData,
      },
    });
    setBusy(false);
    setRepasseOpen(false);
    if (error || !data?.success) toast.error(data?.error ?? "Falha.");
    else {
      toast.success("Repasse registrado.");
      void load();
    }
  };

  const exportPdf = async () => {
    if (!troca) return;
    const fotos = normalizeGestaoTrocaFotos(troca.fotos_json).filter(
      (f) => f.etiqueta !== "Documento (CRLV)",
    );
    const paths = gestaoTrocaFotoPaths(fotos);
    const urls: string[] = [];
    for (const path of paths.slice(0, 6)) {
      const { data } = await supabase.storage.from("trocas").createSignedUrl(path, 3600);
      if (data?.signedUrl) urls.push(data.signedUrl);
    }
    let laudoPdf: GestaoTrocaLaudoPdfSection | null = null;
    const { analise, itens } = await fetchLatestGestaoTrocaLaudo(troca.id);
    if (analise) {
      const confirmados = itens.filter((i) => i.decisao === "confirmado");
      if (confirmados.length) {
        laudoPdf = {
          kmPainel: analise.km_painel_lido,
          luzesPainel: analise.luzes_painel,
          itensConfirmados: confirmados.map((i) => ({
            area: i.area,
            tipo: i.tipo,
            descricao: i.descricao,
            valor: i.valor_estimado,
          })),
        };
      }
    }
    await downloadGestaoTrocaRelatorioPdf(troca, eventos, urls, laudoPdf);
  };

  if (!troca) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

  const destinoLocked = !!troca.veiculo_id || !!troca.destino;
  const kbbUrl = buildGestaoTrocaKbbUrl({
    uf: lojaUf,
    marca: troca.marca,
    modelo: troca.modelo,
    ano_modelo: troca.ano_modelo,
    categoria: troca.categoria,
  });
  const kbbLinkLabel = labelGestaoTrocaKbbLink({
    marca: troca.marca,
    modelo: troca.modelo,
    ano_modelo: troca.ano_modelo,
    categoria: troca.categoria,
  });

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mx-auto max-w-3xl space-y-6">
        <Link to="/gestao/trocas" className="flex items-center gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Lista de trocas
        </Link>
        <div className="flex flex-wrap justify-between gap-2">
          <h1 className="text-2xl font-bold">
            {troca.marca} {troca.modelo} {troca.ano_modelo ?? ""}
          </h1>
          <Button variant="outline" size="sm" onClick={() => void exportPdf()} disabled={busy}>
            Relatório PDF
          </Button>
        </div>

        <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">Veículo e cliente</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label>Placa</Label><Input value={troca.placa ?? ""} onChange={(e) => setTroca({ ...troca, placa: e.target.value })} onBlur={() => void savePatch({ placa: troca.placa })} /></div>
            <div><Label>Marca</Label><Input value={troca.marca} onChange={(e) => setTroca({ ...troca, marca: e.target.value })} onBlur={() => void savePatch({ marca: troca.marca })} /></div>
            <div><Label>Modelo</Label><Input value={troca.modelo} onChange={(e) => setTroca({ ...troca, modelo: e.target.value })} onBlur={() => void savePatch({ modelo: troca.modelo })} /></div>
            <div>
              <Label>Categoria (KBB)</Label>
              <Select
                value={troca.categoria ?? ""}
                onValueChange={(v) => {
                  const cat = v || null;
                  setTroca({ ...troca, categoria: cat });
                  void savePatch({ categoria: cat });
                }}
              >
                <SelectTrigger><SelectValue placeholder="Selecione…" /></SelectTrigger>
                <SelectContent>
                  {GESTAO_TROCA_KBB_CATEGORIAS.map((c) => (
                    <SelectItem key={c.value} value={c.value}>{c.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div><Label>Ano modelo</Label><Input type="number" value={troca.ano_modelo ?? ""} onChange={(e) => setTroca({ ...troca, ano_modelo: Number(e.target.value) || null })} onBlur={() => void savePatch({ ano_modelo: troca.ano_modelo })} /></div>
            <div><Label>KM</Label><Input type="number" value={troca.km ?? ""} onChange={(e) => setTroca({ ...troca, km: Number(e.target.value) || null })} onBlur={() => void savePatch({ km: troca.km })} /></div>
            <div><Label>Cliente</Label><Input value={troca.cliente_nome ?? ""} onChange={(e) => setTroca({ ...troca, cliente_nome: e.target.value })} onBlur={() => void savePatch({ cliente_nome: troca.cliente_nome })} /></div>
          </div>
          <Textarea placeholder="Observações" value={troca.observacoes ?? ""} onChange={(e) => setTroca({ ...troca, observacoes: e.target.value })} onBlur={() => void savePatch({ observacoes: troca.observacoes })} />
        </section>

        <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">Checklist de avaliação</h2>
          <GestaoTrocaChecklistPanel
            value={troca.checklist_json}
            preparacaoManual={troca.preparacao_estimada}
            disabled={busy}
            onChecklistChange={(checklist, preparacaoSugerida) => {
              void saveChecklist(checklist, preparacaoSugerida);
            }}
            onPreparacaoChange={(preparacao) =>
              setTroca((t) => (t ? { ...t, preparacao_estimada: preparacao } : t))}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy}
            onClick={() =>
              void savePatch({ preparacao_estimada: troca.preparacao_estimada }).then(() => recalcular())}
          >
            Salvar preparação manual
          </Button>
        </section>

        <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">KBB (informado pelo avaliador)</h2>
          <p className="text-xs text-muted-foreground">
            <a href={kbbUrl} target="_blank" rel="noopener noreferrer" className="font-medium underline">
              {kbbLinkLabel}
            </a>
          </p>
          <p className="text-xs text-muted-foreground">
            Na KBB escolha a versão, ajuste km e condição, e copie Preço de Troca, Preço de Loja e o km
            característico.
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <GestaoMoneyInput label="KBB troca" value={String(troca.kbb_troca ?? "")} onChange={(v) => setTroca({ ...troca, kbb_troca: parseGestaoMoneyBr(v) })} />
            <GestaoMoneyInput label="KBB loja" value={String(troca.kbb_loja ?? "")} onChange={(v) => setTroca({ ...troca, kbb_loja: parseGestaoMoneyBr(v) })} />
            <div><Label>KM característico KBB</Label><Input type="number" value={troca.kbb_km_caracteristico ?? ""} onChange={(e) => setTroca({ ...troca, kbb_km_caracteristico: Number(e.target.value) || null })} /></div>
          </div>
          <Button size="sm" variant="secondary" onClick={() => void savePatch({ kbb_troca: troca.kbb_troca, kbb_loja: troca.kbb_loja, kbb_km_caracteristico: troca.kbb_km_caracteristico })}>
            Salvar KBB
          </Button>
        </section>

        <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">FIPE</h2>
          <p className="text-sm">Valor: {formatGestaoMoney(troca.fipe_valor ?? 0)} {troca.fipe_mes_ref ? `(${troca.fipe_mes_ref})` : ""}</p>
          <Button size="sm" onClick={() => void buscarFipe()} disabled={busy}>Buscar FIPE</Button>
        </section>

        <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">Preço</h2>
          <GestaoMoneyInput label="Preparação estimada" value={String(troca.preparacao_estimada ?? 0)} onChange={(v) => setTroca({ ...troca, preparacao_estimada: parseGestaoMoneyBr(v) ?? 0 })} />
          <GestaoMoneyInput label="Valor proposto (cliente)" value={String(troca.valor_proposto ?? "")} onChange={(v) => setTroca({ ...troca, valor_proposto: parseGestaoMoneyBr(v) })} />
          <div className="grid gap-1 text-sm">
            <p>Faixa verde: {formatGestaoMoney(troca.faixa_verde_min ?? 0)} – {formatGestaoMoney(troca.faixa_verde_max ?? 0)}</p>
            <p>Sugerido: {formatGestaoMoney(troca.valor_sugerido ?? 0)} · Teto: {formatGestaoMoney(troca.teto ?? 0)}</p>
            <p>Semáforo: <strong>{troca.semaforo ?? "—"}</strong></p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {(troca.justificativas_json ?? []).map((j, i) => <li key={i}>{j}</li>)}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => void savePatch({ preparacao_estimada: troca.preparacao_estimada, valor_proposto: troca.valor_proposto }).then(() => recalcular())} disabled={busy}>
              Recalcular preço
            </Button>
            <Button size="sm" variant="outline" onClick={() => void consultarProcedencia()} disabled={busy}>
              Consultar procedência
            </Button>
          </div>
        </section>

        {troca.status === "fechada" && !troca.veiculo_id && (
          <section className="space-y-2 rounded-lg border bg-white p-4 dark:bg-gray-950">
            <h2 className="font-semibold">Preparação (despesas na troca)</h2>
            <Button size="sm" variant="secondary" onClick={async () => {
              const { data: { user } } = await supabase.auth.getUser();
              if (!user) return;
              const valor = prompt("Valor da despesa (R$)");
              if (!valor) return;
              await supabase.from("gestao_troca_despesa" as "veiculos_estoque").insert({
                troca_id: id,
                user_id: user.id,
                categoria: "mecanica",
                valor: Number(valor),
                descricao: "Preparação troca",
              });
              toast.success("Despesa lançada.");
            }}>
              Lançar despesa
            </Button>
          </section>
        )}

        <section className="space-y-2 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">Fotos (privadas)</h2>
          {userId && id && (
            <GestaoTrocaFotoGaleria
              userId={userId}
              trocaId={id}
              fotosRaw={troca.fotos_json}
              disabled={busy}
              onFotosChange={(entries: GestaoTrocaFotoEntry[]) => void savePatch({ fotos_json: entries })}
            />
          )}
        </section>

        {id && (
          <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
            <h2 className="font-semibold">Laudo IA (pré-análise visual)</h2>
            <GestaoTrocaLaudoIaPanel
              trocaId={id}
              kmFicha={troca.km}
              kmPainelConferido={troca.km_painel_conferido === true}
              disabled={busy}
              onKmConferido={() => {
                setTroca((t) => (t ? { ...t, km_painel_conferido: true } : t));
                setLaudoKmBloqueio((s) => ({ ...s, kmConferido: true }));
                void load();
              }}
              onPreparacaoChange={(preparacao) => {
                setTroca((t) => (t ? { ...t, preparacao_estimada: preparacao } : t));
                void recalcular();
              }}
              onLaudoState={setLaudoKmBloqueio}
            />
          </section>
        )}

        <section className="space-y-2 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">Ações · {troca.status}</h2>
          <div className="flex flex-wrap gap-2">
            {troca.status === "em_avaliacao" && (
              <Button
                size="sm"
                onClick={() => void transicao("solicitar_aprovacao")}
                disabled={busy || (laudoKmBloqueio.alertaKm && !laudoKmBloqueio.kmConferido && !troca.km_painel_conferido)}
                title={
                  laudoKmBloqueio.alertaKm && !laudoKmBloqueio.kmConferido && !troca.km_painel_conferido
                    ? "Confirme o KM do painel (divergência no laudo IA)"
                    : undefined
                }
              >
                Solicitar aprovação
              </Button>
            )}
            {troca.status === "aguardando_aprovacao" && (
              <>
                <Button size="sm" onClick={() => void transicao("aprovar", { valor_aprovado: troca.valor_proposto ?? troca.valor_sugerido })} disabled={busy}>Aprovar</Button>
                <Button size="sm" variant="secondary" onClick={() => void transicao("recusar_aprovacao")} disabled={busy}>Recusar</Button>
              </>
            )}
            {troca.status === "aprovada" && (
              <Button size="sm" onClick={() => void transicao("fechar", { valor_fechado: troca.valor_aprovado })} disabled={busy}>Fechar troca</Button>
            )}
            {troca.status === "fechada" && !troca.veiculo_id && (
              <>
                <Button size="sm" onClick={openLiberar} disabled={busy || destinoLocked}>Liberar para venda</Button>
                <Button size="sm" variant="secondary" onClick={() => setRepasseOpen(true)} disabled={busy || destinoLocked}>Registrar repasse</Button>
              </>
            )}
            {!["fechada", "cancelada", "perdida", "recusada_cliente"].includes(troca.status) && (
              <>
                <Button size="sm" variant="ghost" onClick={() => void transicao("cliente_recusou")} disabled={busy}>Cliente recusou</Button>
                <Button size="sm" variant="ghost" onClick={() => void transicao("perdida")} disabled={busy}>Perdida</Button>
                <Button size="sm" variant="ghost" onClick={() => void transicao("cancelar")} disabled={busy}>Cancelar</Button>
              </>
            )}
          </div>
        </section>

        <section className="space-y-2 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">Linha do tempo</h2>
          <ul className="space-y-1 text-sm">
            {eventos.map((e) => (
              <li key={e.id}><span className="text-muted-foreground">{e.created_at.slice(0, 16).replace("T", " ")}</span> — {e.descricao}</li>
            ))}
          </ul>
        </section>
      </div>

      <AlertDialog open={liberarOpen} onOpenChange={setLiberarOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Liberar para venda</AlertDialogTitle>
            <AlertDialogDescription>
              O carro vai aparecer no estoque e na vitrine. As fotos da avaliação{" "}
              <strong>não</strong> são copiadas para o anúncio — cadastre fotos no veículo depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <GestaoMoneyInput
            label="Preço de venda"
            value={precoVendaInput}
            onChange={setPrecoVendaInput}
          />
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmLiberar(); }} disabled={busy}>
              Confirmar liberação
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={repasseOpen} onOpenChange={setRepasseOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Registrar repasse</DialogTitle>
            <DialogDescription>
              Cria veículo vendido e lança receita no DRE. Só uma ação de destino por troca.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <div><Label>Comprador</Label><Input value={repasseComprador} onChange={(e) => setRepasseComprador(e.target.value)} /></div>
            <GestaoMoneyInput label="Valor repasse" value={repasseValor} onChange={setRepasseValor} />
            <div><Label>Data</Label><Input type="date" value={repasseData} onChange={(e) => setRepasseData(e.target.value)} /></div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setRepasseOpen(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={() => void confirmRepasse()} disabled={busy}>Confirmar repasse</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
