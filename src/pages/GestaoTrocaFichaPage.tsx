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
import { GestaoTrocaProcedenciaCard } from "@/components/gestao/trocas/GestaoTrocaProcedenciaCard.tsx";
import type { GestaoTrocaChecklistJson } from "@/lib/gestao-troca-checklist.ts";
import { parseGestaoMoneyBr } from "@/lib/gestao-money.ts";
import {
  formatGestaoTrocaMoneyBlurText,
  gestaoTrocaMergeFipePreservandoKbb,
  gestaoTrocaMoneyTextFromStored,
  gestaoTrocaPatchSomenteFipe,
  gestaoTrocaSnapshotPreservedPricing,
} from "@/lib/gestao-troca-ficha-money.ts";
import {
  gestaoTrocaFotoPaths,
  normalizeGestaoTrocaFotos,
  type GestaoTrocaFotoEntry,
} from "@/lib/gestao-troca-fotos.ts";
import {
  fetchLatestGestaoTrocaLaudo,
  invokeGestaoTrocaAprovarComParecer,
  invokeGestaoTrocaFinalizarLaudo,
  invokeGestaoTrocaParecerPreview,
  invokeGestaoTrocaReabrirLaudo,
} from "@/lib/gestao-troca-ia-api.ts";
import type { GestaoTrocaLaudoDescricaoPdf } from "@/lib/gestao-troca-ia-descricao-display.ts";
import type { GestaoTrocaIaQualidadeFoto } from "@/lib/gestao-troca-ia-types.ts";
import {
  buildGestaoTrocaLaudoDescricaoFromAnalise,
  buildGestaoTrocaLaudoPdfFromAnalise,
} from "@/lib/gestao-troca-laudo-build.ts";
import {
  mapGestaoTrocaParecerPreviewFromApi,
  parseGestaoTrocaParecerJson,
  type GestaoTrocaParecerPreviewView,
} from "@/lib/gestao-troca-parecer-display.ts";
import type { GestaoTrocaLaudoPdfSection } from "@/lib/gestao-troca-laudo-pdf-section.ts";
import type { GestaoTrocaProcedenciaLaudo } from "@/lib/gestao-troca-procedencia-display.ts";
import { fetchGestaoTrocaProcedenciaLaudo } from "@/lib/gestao-troca-procedencia-fetch.ts";
import { GestaoTrocaLaudoPreviewContent } from "@/components/gestao/trocas/GestaoTrocaLaudoPreviewContent.tsx";
import {
  GestaoTrocaParecerDialog,
  type GestaoTrocaParecerPreview,
} from "@/components/gestao/trocas/GestaoTrocaParecerDialog.tsx";
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
  const [kbbTrocaText, setKbbTrocaText] = useState("");
  const [kbbLojaText, setKbbLojaText] = useState("");
  const [preparacaoText, setPreparacaoText] = useState("");
  const [valorPropostoText, setValorPropostoText] = useState("");
  const [previewOpen, setPreviewOpen] = useState(false);
  const [previewLaudo, setPreviewLaudo] = useState<GestaoTrocaLaudoPdfSection | null>(null);
  const [previewProcedencia, setPreviewProcedencia] = useState<GestaoTrocaProcedenciaLaudo | null>(
    null,
  );
  const [previewDescricao, setPreviewDescricao] = useState<GestaoTrocaLaudoDescricaoPdf | null>(
    null,
  );
  const [previewQualidade, setPreviewQualidade] = useState<GestaoTrocaIaQualidadeFoto[]>([]);
  const [previewDescricaoThumbs, setPreviewDescricaoThumbs] = useState<Record<string, string>>({});
  const [previewParecer, setPreviewParecer] = useState<GestaoTrocaParecerPreviewView | null>(null);
  const [parecerOpen, setParecerOpen] = useState(false);
  const [parecerLoading, setParecerLoading] = useState(false);
  const [parecerPreview, setParecerPreview] = useState<GestaoTrocaParecerPreview | null>(null);
  const [parecerProcedencia, setParecerProcedencia] = useState<GestaoTrocaProcedenciaLaudo | null>(
    null,
  );
  const [parecerQualidade, setParecerQualidade] = useState<GestaoTrocaIaQualidadeFoto[]>([]);
  const [parecerThumbUrls, setParecerThumbUrls] = useState<Record<string, string>>({});
  const [finalizeOpen, setFinalizeOpen] = useState(false);
  const [reabrirOpen, setReabrirOpen] = useState(false);
  const [reabrirMotivo, setReabrirMotivo] = useState("");
  const [finalizadoPorLabel, setFinalizadoPorLabel] = useState<string | null>(null);

  const applyTrocaRow = (row: GestaoTrocaRow) => {
    setTroca(row);
    setKbbTrocaText(gestaoTrocaMoneyTextFromStored(row.kbb_troca));
    setKbbLojaText(gestaoTrocaMoneyTextFromStored(row.kbb_loja));
    setPreparacaoText(gestaoTrocaMoneyTextFromStored(row.preparacao_estimada));
    setValorPropostoText(gestaoTrocaMoneyTextFromStored(row.valor_proposto));
  };

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
    applyTrocaRow(t as unknown as GestaoTrocaRow);
    const { data: ev } = await supabase.from("gestao_troca_evento" as "veiculos_estoque")
      .select("*").eq("troca_id", id).order("created_at", { ascending: true });
    setEventos((ev ?? []) as unknown as GestaoTrocaEvento[]);
  }, [id, navigate]);

  useEffect(() => {
    void load();
  }, [load]);

  const laudoLocked = troca?.laudo_status === "finalizado";

  const savePatch = async (patch: Record<string, unknown>) => {
    if (!id) return;
    if (laudoLocked) {
      toast.error("Laudo finalizado — reabra o laudo para editar.");
      return;
    }
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
    const preserved = gestaoTrocaSnapshotPreservedPricing({
      kbb_troca: troca.kbb_troca,
      kbb_loja: troca.kbb_loja,
      kbb_km_caracteristico: troca.kbb_km_caracteristico,
      preparacao_estimada: troca.preparacao_estimada,
      valor_proposto: troca.valor_proposto,
      texts: {
        kbbTroca: kbbTrocaText,
        kbbLoja: kbbLojaText,
        preparacao: preparacaoText,
        valorProposto: valorPropostoText,
      },
    });
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
    await savePatch(
      gestaoTrocaPatchSomenteFipe(Number(data.fipe_valor), String(data.fipe_mes_ref)),
    );
    setTroca((t) => (t
      ? gestaoTrocaMergeFipePreservandoKbb(
        t,
        Number(data.fipe_valor),
        String(data.fipe_mes_ref),
        preserved,
      )
      : t));
    toast.success("FIPE atualizada.");
  };

  const blurKbbTroca = () => {
    if (!troca) return;
    const n = parseGestaoMoneyBr(kbbTrocaText);
    const text = formatGestaoTrocaMoneyBlurText(kbbTrocaText);
    setKbbTrocaText(text);
    setTroca({ ...troca, kbb_troca: n });
    void savePatch({ kbb_troca: n });
  };

  const blurKbbLoja = () => {
    if (!troca) return;
    const n = parseGestaoMoneyBr(kbbLojaText);
    const text = formatGestaoTrocaMoneyBlurText(kbbLojaText);
    setKbbLojaText(text);
    setTroca({ ...troca, kbb_loja: n });
    void savePatch({ kbb_loja: n });
  };

  const blurPreparacao = () => {
    if (!troca) return;
    const n = parseGestaoMoneyBr(preparacaoText) ?? 0;
    const text = formatGestaoTrocaMoneyBlurText(preparacaoText);
    setPreparacaoText(text);
    setTroca({ ...troca, preparacao_estimada: n });
    void savePatch({ preparacao_estimada: n });
  };

  const blurValorProposto = () => {
    if (!troca) return;
    const n = parseGestaoMoneyBr(valorPropostoText);
    const text = formatGestaoTrocaMoneyBlurText(valorPropostoText);
    setValorPropostoText(text);
    setTroca({ ...troca, valor_proposto: n });
    void savePatch({ valor_proposto: n });
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

  const signGestaoTrocaFotoPaths = async (paths: string[]) => {
    const next: Record<string, string> = {};
    for (const path of paths) {
      const { data } = await supabase.storage.from("trocas").createSignedUrl(path, 3600);
      if (data?.signedUrl) next[path] = data.signedUrl;
    }
    return next;
  };

  const thumbPathsFromQualidade = (qualidade: GestaoTrocaIaQualidadeFoto[]) =>
    qualidade.filter((q) => q.path && q.etiqueta !== "Documento (CRLV)").map((q) => q.path);

  const loadLaudoBundle = async () => {
    if (!troca) {
      return {
        laudo: null as GestaoTrocaLaudoPdfSection | null,
        descricao: null as GestaoTrocaLaudoDescricaoPdf | null,
        qualidade: [] as GestaoTrocaIaQualidadeFoto[],
      };
    }
    const { analise, itens } = await fetchLatestGestaoTrocaLaudo(troca.id);
    return {
      laudo: buildGestaoTrocaLaudoPdfFromAnalise(troca, analise, itens),
      descricao: buildGestaoTrocaLaudoDescricaoFromAnalise(analise),
      qualidade: analise?.qualidade_json ?? [],
    };
  };

  const loadLaudoPdfSection = async () => {
    const bundle = await loadLaudoBundle();
    return bundle.laudo;
  };

  const loadProcedenciaLaudo = async () => {
    if (!troca) return null;
    return fetchGestaoTrocaProcedenciaLaudo(troca.procedencia_consulta_id, {
      marca: troca.marca,
      modelo: troca.modelo,
    });
  };

  const loadPdfThumbUrls = async () => {
    if (!troca) return [] as string[];
    const fotos = normalizeGestaoTrocaFotos(troca.fotos_json).filter(
      (f) => f.etiqueta !== "Documento (CRLV)",
    );
    const paths = gestaoTrocaFotoPaths(fotos);
    const urls: string[] = [];
    for (const path of paths.slice(0, 6)) {
      const { data } = await supabase.storage.from("trocas").createSignedUrl(path, 3600);
      if (data?.signedUrl) urls.push(data.signedUrl);
    }
    return urls;
  };

  const exportPdf = async () => {
    if (!troca) return;
    setBusy(true);
    const [urls, bundle, procedenciaPdf] = await Promise.all([
      loadPdfThumbUrls(),
      loadLaudoBundle(),
      loadProcedenciaLaudo(),
    ]);
    const parecerPdf = troca.parecer_json ?? null;
    const finalizacao = troca.laudo_status === "finalizado" && troca.laudo_numero
      ? {
        numero: troca.laudo_numero,
        versao: troca.laudo_versao ?? 1,
        finalizadoPor: finalizadoPorLabel ?? userId.slice(0, 8),
        finalizadoEm: troca.laudo_finalizado_em ?? new Date().toISOString(),
      }
      : null;
    setBusy(false);
    await downloadGestaoTrocaRelatorioPdf(
      troca,
      eventos,
      urls,
      bundle.laudo,
      finalizacao,
      procedenciaPdf,
      bundle.descricao,
      parecerPdf,
    );
  };

  const openPreview = async () => {
    if (!troca) return;
    setBusy(true);
    const [bundle, procedencia] = await Promise.all([
      loadLaudoBundle(),
      loadProcedenciaLaudo(),
    ]);
    const thumbs = await signGestaoTrocaFotoPaths(thumbPathsFromQualidade(bundle.qualidade));
    setPreviewLaudo(bundle.laudo);
    setPreviewDescricao(bundle.descricao);
    setPreviewQualidade(bundle.qualidade);
    setPreviewDescricaoThumbs(thumbs);
    setPreviewParecer(parseGestaoTrocaParecerJson(troca.parecer_json));
    setPreviewProcedencia(procedencia);
    setBusy(false);
    setPreviewOpen(true);
  };

  const openAnalisarAvaliacao = async () => {
    if (!troca) return;
    setParecerOpen(true);
    setParecerLoading(true);
    setParecerPreview(null);
    const [r, procedencia, bundle] = await Promise.all([
      invokeGestaoTrocaParecerPreview(troca.id),
      loadProcedenciaLaudo(),
      loadLaudoBundle(),
    ]);
    if (!r.success) {
      setParecerLoading(false);
      toast.error(r.error ?? "Falha ao gerar parecer.");
      setParecerOpen(false);
      return;
    }
    setParecerPreview(mapGestaoTrocaParecerPreviewFromApi(r));
    setParecerProcedencia(procedencia);
    setParecerQualidade(bundle.qualidade);
    const thumbs = await signGestaoTrocaFotoPaths(thumbPathsFromQualidade(bundle.qualidade));
    setParecerThumbUrls(thumbs);
    setParecerLoading(false);
  };

  const confirmAprovarComParecer = async () => {
    if (!troca) return;
    setBusy(true);
    const r = await invokeGestaoTrocaAprovarComParecer(troca.id);
    setBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "Falha ao aprovar.");
      return;
    }
    toast.success("Troca aprovada com parecer registrado.");
    setParecerOpen(false);
    void load();
  };

  const confirmFinalizarLaudo = async () => {
    if (!id) return;
    setBusy(true);
    const r = await invokeGestaoTrocaFinalizarLaudo(id);
    setBusy(false);
    setFinalizeOpen(false);
    if (!r.success) {
      toast.error(r.error ?? "Falha ao finalizar.");
      return;
    }
    toast.success(`Laudo nº ${r.numero ?? ""} finalizado (v${r.versao ?? 1}).`);
    const { data: { user } } = await supabase.auth.getUser();
    setFinalizadoPorLabel(user?.email ?? user?.id ?? null);
    void load();
  };

  const confirmReabrirLaudo = async () => {
    if (!id) return;
    if (reabrirMotivo.trim().length < 10) {
      toast.error("Informe o motivo (mínimo 10 caracteres).");
      return;
    }
    setBusy(true);
    const r = await invokeGestaoTrocaReabrirLaudo(id, reabrirMotivo.trim());
    setBusy(false);
    if (!r.success) {
      toast.error(r.error ?? "Falha ao reabrir.");
      return;
    }
    toast.success("Laudo reaberto para edição.");
    setReabrirOpen(false);
    setReabrirMotivo("");
    void load();
  };

  useEffect(() => {
    if (!troca?.laudo_finalizado_por) {
      setFinalizadoPorLabel(null);
      return;
    }
    void (async () => {
      const { data } = await supabase.from("profiles").select("email, full_name")
        .eq("id", troca.laudo_finalizado_por!)
        .maybeSingle();
      setFinalizadoPorLabel(data?.email ?? data?.full_name ?? troca.laudo_finalizado_por!.slice(0, 8));
    })();
  }, [troca?.laudo_finalizado_por]);

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
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" size="sm" onClick={() => void openPreview()} disabled={busy}>
              Pré-visualizar laudo
            </Button>
            {troca.laudo_status !== "finalizado" ? (
              <Button size="sm" onClick={() => setFinalizeOpen(true)} disabled={busy}>
                Finalizar laudo
              </Button>
            ) : (
              <Button size="sm" variant="secondary" onClick={() => setReabrirOpen(true)} disabled={busy}>
                Reabrir laudo
              </Button>
            )}
            <Button variant="outline" size="sm" onClick={() => void exportPdf()} disabled={busy}>
              Relatório PDF
            </Button>
          </div>
        </div>
        {troca.laudo_status === "finalizado" && troca.laudo_numero && (
          <p className="text-sm text-muted-foreground">
            Laudo nº {troca.laudo_numero} · versão {troca.laudo_versao ?? 1}
            {troca.laudo_finalizado_em
              ? ` · finalizado em ${new Date(troca.laudo_finalizado_em).toLocaleString("pt-BR")}`
              : ""}
          </p>
        )}

        <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">Veículo e cliente</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label>Placa</Label><Input readOnly={laudoLocked} value={troca.placa ?? ""} onChange={(e) => setTroca({ ...troca, placa: e.target.value })} onBlur={() => void savePatch({ placa: troca.placa })} /></div>
            <div><Label>Marca</Label><Input readOnly={laudoLocked} value={troca.marca} onChange={(e) => setTroca({ ...troca, marca: e.target.value })} onBlur={() => void savePatch({ marca: troca.marca })} /></div>
            <div><Label>Modelo</Label><Input readOnly={laudoLocked} value={troca.modelo} onChange={(e) => setTroca({ ...troca, modelo: e.target.value })} onBlur={() => void savePatch({ modelo: troca.modelo })} /></div>
            <div>
              <Label>Categoria (KBB)</Label>
              <Select
                value={troca.categoria ?? ""}
                disabled={laudoLocked}
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
            <div><Label>Ano modelo</Label><Input readOnly={laudoLocked} type="number" value={troca.ano_modelo ?? ""} onChange={(e) => setTroca({ ...troca, ano_modelo: Number(e.target.value) || null })} onBlur={() => void savePatch({ ano_modelo: troca.ano_modelo })} /></div>
            <div><Label>KM</Label><Input readOnly={laudoLocked} type="number" value={troca.km ?? ""} onChange={(e) => setTroca({ ...troca, km: Number(e.target.value) || null })} onBlur={() => void savePatch({ km: troca.km })} /></div>
            <div><Label>Cliente</Label><Input readOnly={laudoLocked} value={troca.cliente_nome ?? ""} onChange={(e) => setTroca({ ...troca, cliente_nome: e.target.value })} onBlur={() => void savePatch({ cliente_nome: troca.cliente_nome })} /></div>
          </div>
          <Textarea readOnly={laudoLocked} placeholder="Observações" value={troca.observacoes ?? ""} onChange={(e) => setTroca({ ...troca, observacoes: e.target.value })} onBlur={() => void savePatch({ observacoes: troca.observacoes })} />
        </section>

        <GestaoTrocaProcedenciaCard
          troca={troca}
          busy={busy}
          laudoLocked={laudoLocked}
          onConsultaCompleta={async (consultaId) => {
            setTroca((t) => (t ? { ...t, procedencia_consulta_id: consultaId } : t));
            await savePatch({ procedencia_consulta_id: consultaId });
          }}
          onConsultaConcluida={() => void recalcular()}
        />

        <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">Checklist de avaliação</h2>
          <GestaoTrocaChecklistPanel
            value={troca.checklist_json}
            preparacaoManual={troca.preparacao_estimada}
            disabled={busy || laudoLocked}
            onChecklistChange={(checklist, preparacaoSugerida) => {
              void saveChecklist(checklist, preparacaoSugerida);
            }}
            onPreparacaoChange={(preparacao) =>
              setTroca((t) => (t ? { ...t, preparacao_estimada: preparacao } : t))}
          />
          <Button
            size="sm"
            variant="secondary"
            disabled={busy || laudoLocked}
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
            <GestaoMoneyInput label="KBB troca" value={kbbTrocaText} onChange={setKbbTrocaText} onBlur={blurKbbTroca} disabled={laudoLocked} />
            <GestaoMoneyInput label="KBB loja" value={kbbLojaText} onChange={setKbbLojaText} onBlur={blurKbbLoja} disabled={laudoLocked} />
            <div><Label>KM característico KBB</Label><Input readOnly={laudoLocked} type="number" value={troca.kbb_km_caracteristico ?? ""} onChange={(e) => setTroca({ ...troca, kbb_km_caracteristico: Number(e.target.value) || null })} /></div>
          </div>
          <Button
            size="sm"
            variant="secondary"
            disabled={laudoLocked}
            onClick={() => void savePatch({ kbb_km_caracteristico: troca.kbb_km_caracteristico })}
          >
            Salvar KM KBB
          </Button>
        </section>

        <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">FIPE</h2>
          <p className="text-sm">Valor: {formatGestaoMoney(troca.fipe_valor ?? 0)} {troca.fipe_mes_ref ? `(${troca.fipe_mes_ref})` : ""}</p>
          <Button size="sm" onClick={() => void buscarFipe()} disabled={busy || laudoLocked}>Buscar FIPE</Button>
        </section>

        <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">Preço</h2>
          <GestaoMoneyInput label="Preparação estimada" value={preparacaoText} onChange={setPreparacaoText} onBlur={blurPreparacao} disabled={laudoLocked} />
          <GestaoMoneyInput label="Valor proposto (cliente)" value={valorPropostoText} onChange={setValorPropostoText} onBlur={blurValorProposto} disabled={laudoLocked} />
          <div className="grid gap-1 text-sm">
            <p>Faixa verde: {formatGestaoMoney(troca.faixa_verde_min ?? 0)} – {formatGestaoMoney(troca.faixa_verde_max ?? 0)}</p>
            <p>Sugerido: {formatGestaoMoney(troca.valor_sugerido ?? 0)} · Teto: {formatGestaoMoney(troca.teto ?? 0)}</p>
            <p>Semáforo: <strong>{troca.semaforo ?? "—"}</strong></p>
            <ul className="list-disc pl-5 text-muted-foreground">
              {(troca.justificativas_json ?? []).map((j, i) => <li key={i}>{j}</li>)}
            </ul>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button size="sm" onClick={() => {
              void (async () => {
                if (!troca) return;
                const preparacao = parseGestaoMoneyBr(preparacaoText) ?? troca.preparacao_estimada;
                const valor_proposto = parseGestaoMoneyBr(valorPropostoText) ?? troca.valor_proposto;
                setPreparacaoText(formatGestaoTrocaMoneyBlurText(preparacaoText));
                setValorPropostoText(formatGestaoTrocaMoneyBlurText(valorPropostoText));
                setTroca({ ...troca, preparacao_estimada: preparacao, valor_proposto });
                await savePatch({ preparacao_estimada: preparacao, valor_proposto });
                await recalcular();
              })();
            }} disabled={busy || laudoLocked}>
              Recalcular preço
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
              disabled={busy || laudoLocked}
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
              laudoFinalizado={laudoLocked}
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
          {troca.laudo_status !== "finalizado" && (
            <p className="text-xs text-amber-700 dark:text-amber-400">Laudo ainda não finalizado.</p>
          )}
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
                <Button size="sm" variant="outline" onClick={() => void openAnalisarAvaliacao()} disabled={busy}>
                  Analisar avaliação
                </Button>
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

      <Dialog open={previewOpen} onOpenChange={setPreviewOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Pré-visualização do laudo</DialogTitle>
            <DialogDescription>Conteúdo equivalente ao relatório PDF (sem amostra de fotos).</DialogDescription>
          </DialogHeader>
          <GestaoTrocaLaudoPreviewContent
            troca={troca}
            eventos={eventos}
            laudo={previewLaudo}
            procedencia={previewProcedencia}
            descricao={previewDescricao}
            parecer={previewParecer}
            qualidade={previewQualidade}
            thumbUrls={previewDescricaoThumbs}
            finalizadoPor={finalizadoPorLabel}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setPreviewOpen(false)}>Fechar</Button>
            <Button onClick={() => void exportPdf()} disabled={busy}>Baixar PDF</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <GestaoTrocaParecerDialog
        open={parecerOpen}
        onOpenChange={setParecerOpen}
        loading={parecerLoading}
        preview={parecerPreview}
        procedencia={parecerProcedencia}
        qualidade={parecerQualidade}
        thumbUrls={parecerThumbUrls}
        onAprovar={() => void confirmAprovarComParecer()}
        busy={busy}
      />

      <AlertDialog open={finalizeOpen} onOpenChange={setFinalizeOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Finalizar laudo</AlertDialogTitle>
            <AlertDialogDescription>
              Gera número do laudo, grava uma versão imutável e trava checklist, preços, fotos e itens IA.
              Você ainda pode solicitar aprovação comercial depois.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={busy}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={(e) => { e.preventDefault(); void confirmFinalizarLaudo(); }} disabled={busy}>
              Finalizar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <Dialog open={reabrirOpen} onOpenChange={setReabrirOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Reabrir laudo</DialogTitle>
            <DialogDescription>
              Motivo obrigatório (mín. 10 caracteres). Registrado na linha do tempo.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={reabrirMotivo}
            onChange={(e) => setReabrirMotivo(e.target.value)}
            placeholder="Descreva por que o laudo precisa ser alterado…"
            rows={4}
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setReabrirOpen(false)} disabled={busy}>Cancelar</Button>
            <Button onClick={() => void confirmReabrirLaudo()} disabled={busy}>Reabrir</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
