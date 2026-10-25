import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { ArrowLeft, FileUp, Plus } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { GestaoOsCotacaoPanel } from "@/components/gestao/operacoes/GestaoOsCotacaoPanel.tsx";
import { GestaoOsFotosPanel } from "@/components/gestao/operacoes/GestaoOsFotosPanel.tsx";
import { useSmartBack } from "@/lib/app-back-nav.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import { GESTAO_DESPESA_CATEGORIAS, gestaoCategoriaLabel } from "@/lib/gestao-lucro-categories.ts";
import {
  GESTAO_OS_DOCUMENTO_MIME_TYPES,
  proximosStatusOs,
  validarArquivoDocumentoOs,
  type GestaoOsStatus,
} from "../../supabase/functions/_shared/gestao-os-domain.ts";
import type { GestaoOsFotoRefRow } from "../../supabase/functions/_shared/gestao-os-fotos.ts";
import {
  GESTAO_OS_STATUS_LABEL,
  GESTAO_OS_TIPO_LABEL,
  type GestaoOsCotacaoRow,
  type GestaoOsItemRow,
  type GestaoOsRow,
  type GestaoParceiroRow,
} from "@/lib/gestao-os-types.ts";

type Evento = {
  id: string;
  tipo: string;
  mensagem: string;
  status_anterior: string | null;
  status_novo: string | null;
  created_at: string;
};
type Documento = { id: string; tipo: string; storage_path: string; created_at: string };
type Veiculo = {
  marca: string;
  modelo: string;
  placa: string | null;
  status: string;
  ano_modelo: number | null;
  cor: string | null;
  km: number | null;
};

export default function GestaoOsFichaPage() {
  const { id = "" } = useParams();
  const goBack = useSmartBack("/gestao/operacoes");
  const [userId, setUserId] = useState("");
  const [os, setOs] = useState<GestaoOsRow | null>(null);
  const [veiculo, setVeiculo] = useState<Veiculo | null>(null);
  const [itens, setItens] = useState<GestaoOsItemRow[]>([]);
  const [cotacoes, setCotacoes] = useState<GestaoOsCotacaoRow[]>([]);
  const [fotoRefs, setFotoRefs] = useState<GestaoOsFotoRefRow[]>([]);
  const [trocaFotosRaw, setTrocaFotosRaw] = useState<unknown>([]);
  const [lojaPdf, setLojaPdf] = useState({ nome: "Minha loja", contato: "", site: "", logoDataUrl: null as string | null });
  const [eventos, setEventos] = useState<Evento[]>([]);
  const [documentos, setDocumentos] = useState<Documento[]>([]);
  const [parceiros, setParceiros] = useState<GestaoParceiroRow[]>([]);
  const [consignado, setConsignado] = useState(false);
  const [item, setItem] = useState({ descricao: "", categoria: "mecanica" });
  const [transicao, setTransicao] = useState({ aprovado: "", real: "", vencimento: "", descontar: "" });
  const [vistoria, setVistoria] = useState({ tipo: "checkin", km: "", checklist: "" });
  const [documentoTipo, setDocumentoTipo] = useState("foto_checkin");
  const [busy, setBusy] = useState(false);
  const [fotoSignedUrls, setFotoSignedUrls] = useState<Record<string, string>>({});

  const load = useCallback(async () => {
    if (!id) return;
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setUserId(user.id);
    const [osRes, itensRes, eventosRes, docsRes, parceirosRes, cotRes, fotosRes] = await Promise.all([
      supabase.from("gestao_os" as "veiculos_estoque").select("*").eq("user_id", user.id).eq("id", id).single(),
      supabase.from("gestao_os_item" as "veiculos_estoque").select("*").eq("user_id", user.id).eq("os_id", id).order("created_at"),
      supabase.from("gestao_os_evento" as "veiculos_estoque").select("*").eq("user_id", user.id).eq("os_id", id).order("created_at", { ascending: false }),
      supabase.from("gestao_os_documento" as "veiculos_estoque").select("id,tipo,storage_path,created_at").eq("user_id", user.id).eq("os_id", id).is("deleted_at", null).order("created_at", { ascending: false }),
      supabase.from("gestao_parceiro" as "veiculos_estoque").select("*").eq("user_id", user.id).eq("ativo", true).order("nome"),
      supabase.from("gestao_os_cotacao" as "veiculos_estoque").select("*").eq("user_id", user.id).eq("os_id", id).order("solicitada_em", { ascending: false }),
      supabase.from("gestao_os_foto_ref" as "veiculos_estoque").select("id,storage_path,selecionada,ordem,troca_ia_item_id").eq("user_id", user.id).eq("os_id", id).order("ordem"),
    ]);
    if (osRes.error) return toast.error(osRes.error.message);
    const ordem = osRes.data as unknown as GestaoOsRow;
    setOs(ordem);
    setItens((itensRes.data ?? []) as unknown as GestaoOsItemRow[]);
    setEventos((eventosRes.data ?? []) as unknown as Evento[]);
    setDocumentos((docsRes.data ?? []) as unknown as Documento[]);
    setParceiros((parceirosRes.data ?? []) as unknown as GestaoParceiroRow[]);
    setCotacoes((cotRes.data ?? []) as unknown as GestaoOsCotacaoRow[]);
    setFotoRefs((fotosRes.data ?? []) as unknown as GestaoOsFotoRefRow[]);

    const [veiculoRes, consigRes, empresaRes, profileRes, brandRes] = await Promise.all([
      supabase.from("veiculos_estoque").select("marca,modelo,status,ano_modelo,cor,km").eq("user_id", user.id).eq("id", ordem.veiculo_id).single(),
      supabase.from("veiculo_consignacao" as "veiculos_estoque").select("status").eq("user_id", user.id).eq("veiculo_id", ordem.veiculo_id).eq("status", "ativo").maybeSingle(),
      supabase.from("empresa_config").select("nome_empresa,site").eq("user_id", user.id).maybeSingle(),
      supabase.from("profiles").select("full_name,email").eq("id", user.id).maybeSingle(),
      supabase.functions.invoke("analisar-produto", { body: { action: "brand_assets" } }),
    ]);
    setVeiculo(veiculoRes.data as unknown as Veiculo);
    setConsignado(Boolean(consigRes.data));
    const emp = empresaRes.data as { nome_empresa?: string; site?: string } | null;
    const prof = profileRes.data as { full_name?: string; email?: string } | null;
    setLojaPdf({
      nome: emp?.nome_empresa || prof?.full_name || "Minha loja",
      contato: prof?.email ?? "",
      site: emp?.site ?? "",
      logoDataUrl: (brandRes.data as { logo_preview?: string } | null)?.logo_preview ?? null,
    });

    if (ordem.troca_id) {
      const { data: troca } = await supabase.from("gestao_troca" as "veiculos_estoque")
        .select("fotos_json").eq("user_id", user.id).eq("id", ordem.troca_id).maybeSingle();
      setTrocaFotosRaw((troca as { fotos_json?: unknown } | null)?.fotos_json ?? []);
    } else {
      setTrocaFotosRaw([]);
    }
  }, [id]);
  useEffect(() => void load(), [load]);

  const fotosSelecionadas = useMemo(
    () => fotoRefs.filter((f) => f.selecionada),
    [fotoRefs],
  );

  useEffect(() => {
    void (async () => {
      const next: Record<string, string> = {};
      await Promise.all(
        fotosSelecionadas.map(async ({ storage_path }) => {
          const { data } = await supabase.storage.from("trocas").createSignedUrl(storage_path, 600);
          if (data?.signedUrl) next[storage_path] = data.signedUrl;
        }),
      );
      setFotoSignedUrls(next);
    })();
  }, [fotosSelecionadas]);

  const encerrada = os ? ["concluida", "cancelada"].includes(os.status) : false;

  const adicionarItem = async () => {
    if (!item.descricao.trim()) return toast.error("Informe o serviço.");
    const { error } = await supabase.from("gestao_os_item" as "veiculos_estoque").insert({
      user_id: userId,
      os_id: id,
      descricao: item.descricao.trim(),
      categoria_despesa: item.categoria,
      valor_estimado: 0,
      origem: "manual",
    } as never);
    if (error) return toast.error(error.message);
    setItem({ descricao: "", categoria: "mecanica" });
    await load();
  };

  const salvarFornecedor = async (parceiroId: string) => {
    const { error } = await supabase.from("gestao_os" as "veiculos_estoque")
      .update({ parceiro_id: parceiroId } as never)
      .eq("user_id", userId).eq("id", id);
    if (error) toast.error(error.message);
    else await load();
  };

  const registrarVistoria = async () => {
    if (!vistoria.km) return toast.error("Informe a quilometragem.");
    let checklist: Record<string, unknown> = {};
    if (vistoria.checklist.trim()) {
      try { checklist = JSON.parse(vistoria.checklist); } catch { return toast.error("Checklist deve ser JSON válido."); }
    }
    const { error } = await supabase.from("gestao_os_vistoria" as "veiculos_estoque").upsert({
      user_id: userId,
      os_id: id,
      tipo: vistoria.tipo,
      km: Number(vistoria.km),
      checklist_json: checklist,
      registrado_por: userId,
    } as never, { onConflict: "os_id,tipo" });
    if (error) return toast.error(error.message);
    toast.success(`${vistoria.tipo === "checkin" ? "Check-in" : "Check-out"} registrado.`);
  };

  const avancar = async (destino: GestaoOsStatus) => {
    if (!os) return;
    if (destino === "aprovada" && consignado && transicao.descontar === "") {
      return toast.error('Escolha explicitamente "Descontar do dono?".');
    }
    const valorAprovado = os.valor_aprovado ?? (transicao.aprovado ? Number(transicao.aprovado) : null);
    if (destino === "aprovada" && (valorAprovado == null || valorAprovado < 0)) {
      return toast.error("Escolha uma cotação ou informe o valor aprovado.");
    }
    setBusy(true);
    const { error } = await (supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{ error: { message: string } | null }>;
    }).rpc("gestao_os_transicionar", {
      p_os_id: os.id,
      p_status: destino,
      p_valor_aprovado: destino === "aprovada" ? valorAprovado : null,
      p_valor_real: destino === "concluida" ? Number(transicao.real || os.valor_real || 0) : null,
      p_descontar_do_consignante: destino === "aprovada"
        ? (consignado ? transicao.descontar === "sim" : false)
        : null,
      p_conta_vencimento: transicao.vencimento || null,
    });
    setBusy(false);
    if (error) return toast.error(error.message);
    toast.success(`OS agora está ${GESTAO_OS_STATUS_LABEL[destino]}.`);
    await load();
  };

  const upload = async (file: File | null) => {
    if (!file || !os) return;
    const validacao = validarArquivoDocumentoOs(file);
    if (!validacao.ok) {
      toast.error(validacao.mensagem);
      return;
    }
    const tipo = documentoTipo;
    const path = `${userId}/os/${os.id}/${crypto.randomUUID()}-${file.name.replace(/[^a-zA-Z0-9._-]/g, "_")}`;
    const { error } = await supabase.storage.from("gestao-os-documentos").upload(path, file);
    if (error) return toast.error(error.message);
    const { error: dbError } = await supabase.from("gestao_os_documento" as "veiculos_estoque").insert({
      user_id: userId, os_id: os.id, tipo, storage_path: path,
      mime_type: file.type || "application/octet-stream", tamanho_bytes: file.size,
    } as never);
    if (dbError) return toast.error(dbError.message);
    toast.success("Documento salvo no cofre privado.");
    await load();
  };

  const abrirDocumento = async (path: string) => {
    const { data, error } = await supabase.storage.from("gestao-os-documentos").createSignedUrl(path, 600);
    if (error || !data?.signedUrl) return toast.error(error?.message ?? "Não foi possível gerar o link.");
    window.open(data.signedUrl, "_blank", "noopener,noreferrer");
  };

  if (!os) return <div className="p-6">Carregando OS…</div>;
  const proximos = proximosStatusOs(os.status);
  return <div className="min-h-screen bg-muted/30 p-4 md:p-6">
    <div className="mx-auto max-w-6xl space-y-5">
      <button type="button" onClick={goBack} className="flex items-center gap-2 text-sm text-muted-foreground"><ArrowLeft className="h-4 w-4" /> Voltar</button>
      <header className="flex flex-wrap justify-between gap-3">
        <div><h1 className="text-2xl font-bold">OS #{os.numero} · {veiculo?.marca} {veiculo?.modelo}</h1><p className="text-sm text-muted-foreground">{veiculo?.placa ?? "Sem placa"} · {GESTAO_OS_TIPO_LABEL[os.tipo]}</p></div>
        <Badge className="h-fit" variant="outline">{GESTAO_OS_STATUS_LABEL[os.status]}</Badge>
      </header>
      {os.tipo === "preparacao" && ["concluida", "cancelada"].includes(os.status) && veiculo?.status === "em_preparacao" && (
        <div className="rounded-lg border border-green-300 bg-green-50 p-3 text-sm text-green-900">Preparação encerrada. <Link to="/veiculos" className="font-semibold underline">Complete o anúncio</Link>; a OS não libera o carro automaticamente.</div>
      )}
      {os.sync_aviso && <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">{os.sync_aviso}</div>}

      <section className="grid gap-4 rounded-lg border bg-background p-4 md:grid-cols-3">
        <div>
          <Label>Fornecedor (cotação escolhida)</Label>
          <Select value={os.parceiro_id ?? ""} onValueChange={(v) => void salvarFornecedor(v)} disabled={encerrada}>
            <SelectTrigger><SelectValue placeholder="Após escolher cotação" /></SelectTrigger>
            <SelectContent>{parceiros.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
          </Select>
        </div>
        <div><Label>Valor aprovado (cotação)</Label><div className="pt-2 font-semibold">{os.valor_aprovado == null ? "—" : formatGestaoMoney(os.valor_aprovado)}</div></div>
        <div><Label>Valor real (pago)</Label><div className="pt-2 font-semibold">{os.valor_real == null ? "—" : formatGestaoMoney(os.valor_real)}</div></div>
      </section>

      <section className="rounded-lg border bg-background p-4">
        <h2 className="mb-3 font-semibold">Itens solicitados (sem valor estimado)</h2>
        {!encerrada && (
          <div className="mb-3 grid gap-2 md:grid-cols-3">
            <Input placeholder="Serviço/peça — ex.: amassado porta traseira" value={item.descricao} onChange={(e) => setItem((x) => ({ ...x, descricao: e.target.value }))} />
            <select className="rounded-md border bg-background px-2" value={item.categoria} onChange={(e) => setItem((x) => ({ ...x, categoria: e.target.value }))}>{GESTAO_DESPESA_CATEGORIAS.map((c) => <option key={c.value} value={c.value}>{c.label}</option>)}</select>
            <Button onClick={() => void adicionarItem()}><Plus className="mr-2 h-4 w-4" />Adicionar</Button>
          </div>
        )}
        <div className="divide-y rounded border">{itens.map((x) => <div key={x.id} className="flex flex-wrap items-center justify-between gap-2 p-3 text-sm"><span>{x.descricao} · {gestaoCategoriaLabel(x.categoria_despesa)} {x.origem === "laudo" && <Badge variant="secondary">Laudo</Badge>}</span><span className="text-muted-foreground">{x.status}</span></div>)}</div>
      </section>

      <section className="rounded-lg border bg-background p-4">
        <h2 className="mb-3 font-semibold">Cotação com parceiros</h2>
        {parceiros.length === 0 ? (
          <p className="text-sm text-amber-800">Cadastre um parceiro em <Link className="underline" to="/gestao/parceiros">Parceiros</Link> para solicitar cotação.</p>
        ) : (
          <GestaoOsCotacaoPanel
            userId={userId}
            os={os}
            itens={itens}
            cotacoes={cotacoes}
            parceiros={parceiros}
            veiculo={veiculo}
            loja={lojaPdf}
            fotosSelecionadas={fotosSelecionadas}
            fotoSignedUrls={fotoSignedUrls}
            onReload={load}
            disabled={encerrada}
          />
        )}
      </section>

      <section className="rounded-lg border bg-background p-4">
        <h2 className="mb-3 font-semibold">Fotos da avaliação (troca)</h2>
        <GestaoOsFotosPanel
          userId={userId}
          osId={os.id}
          trocaId={os.troca_id}
          trocaFotosRaw={trocaFotosRaw}
          fotosRef={fotoRefs}
          onReload={load}
          disabled={encerrada}
        />
      </section>

      <section className="grid gap-4 md:grid-cols-2">
        <div className="rounded-lg border bg-background p-4">
          <h2 className="mb-3 font-semibold">Check-in / check-out</h2>
          <div className="grid gap-2">
            <Select value={vistoria.tipo} onValueChange={(tipo) => setVistoria((v) => ({ ...v, tipo }))}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="checkin">Check-in</SelectItem><SelectItem value="checkout">Check-out</SelectItem></SelectContent></Select>
            <Input type="number" placeholder="Quilometragem" value={vistoria.km} onChange={(e) => setVistoria((v) => ({ ...v, km: e.target.value }))} />
            <Input placeholder='Checklist JSON (ex.: {"combustivel":"1/2"})' value={vistoria.checklist} onChange={(e) => setVistoria((v) => ({ ...v, checklist: e.target.value }))} />
            <Button variant="outline" onClick={() => void registrarVistoria()}>Registrar vistoria</Button>
            <Select value={documentoTipo} onValueChange={setDocumentoTipo}><SelectTrigger><SelectValue /></SelectTrigger><SelectContent><SelectItem value="foto_checkin">Foto de check-in</SelectItem><SelectItem value="foto_checkout">Foto de check-out</SelectItem><SelectItem value="orcamento">Orçamento</SelectItem><SelectItem value="nota">Nota fiscal</SelectItem><SelectItem value="comprovante">Comprovante</SelectItem><SelectItem value="outro">Outro</SelectItem></SelectContent></Select>
            <Label className="mt-2 cursor-pointer rounded border border-dashed p-3 text-center"><FileUp className="mr-2 inline h-4 w-4" />Enviar arquivo privado (até 15 MB)<input className="hidden" type="file" accept={GESTAO_OS_DOCUMENTO_MIME_TYPES.join(",")} onChange={(e) => void upload(e.target.files?.[0] ?? null)} /></Label>
          </div>
          <div className="mt-3 space-y-1">{documentos.map((d) => <button type="button" className="block text-sm text-primary underline" key={d.id} onClick={() => void abrirDocumento(d.storage_path)}>{d.tipo} · {new Date(d.created_at).toLocaleString("pt-BR")}</button>)}</div>
        </div>
        <div className="rounded-lg border bg-background p-4">
          <h2 className="mb-3 font-semibold">Ações do dono</h2>
          {proximos.includes("aprovada") && <>
            <Label>Valor aprovado (se ainda não veio da cotação)</Label><Input type="number" value={transicao.aprovado} onChange={(e) => setTransicao((t) => ({ ...t, aprovado: e.target.value }))} placeholder={os.valor_aprovado != null ? String(os.valor_aprovado) : ""} />
            {consignado && <div className="mt-2"><Label>Descontar do dono?</Label><Select value={transicao.descontar} onValueChange={(descontar) => setTransicao((t) => ({ ...t, descontar }))}><SelectTrigger><SelectValue placeholder="Escolha obrigatória" /></SelectTrigger><SelectContent><SelectItem value="sim">Sim</SelectItem><SelectItem value="nao">Não</SelectItem></SelectContent></Select></div>}
          </>}
          {proximos.includes("concluida") && <><Label className="mt-2">Valor real</Label><Input type="number" value={transicao.real} onChange={(e) => setTransicao((t) => ({ ...t, real: e.target.value }))} /><Label className="mt-2">Vencimento fornecedor</Label><Input type="date" value={transicao.vencimento} onChange={(e) => setTransicao((t) => ({ ...t, vencimento: e.target.value }))} /></>}
          <div className="mt-4 flex flex-wrap gap-2">{proximos.map((s) => <Button disabled={busy} key={s} variant={s === "cancelada" ? "destructive" : "default"} onClick={() => void avancar(s)}>{GESTAO_OS_STATUS_LABEL[s]}</Button>)}</div>
          {os.status === "em_execucao" && <p className="mt-2 text-xs text-muted-foreground">Orçamento complementar pode voltar para aprovação sem apagar o histórico.</p>}
        </div>
      </section>

      <section className="rounded-lg border bg-background p-4"><h2 className="mb-3 font-semibold">Timeline</h2><div className="space-y-3">{eventos.map((e) => <div key={e.id} className="border-l-2 pl-3 text-sm"><strong>{e.mensagem}</strong><div className="text-xs text-muted-foreground">{new Date(e.created_at).toLocaleString("pt-BR")}</div></div>)}</div></section>
    </div>
  </div>;
}
