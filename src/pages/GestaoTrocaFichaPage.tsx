import { useCallback, useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import type { GestaoTrocaEvento, GestaoTrocaRow } from "@/lib/gestao-troca-types.ts";
import { downloadGestaoTrocaRelatorioPdf } from "@/lib/gestao-troca-relatorio-pdf.ts";
import { GestaoMoneyInput } from "@/components/gestao/lucro/GestaoMoneyInput.tsx";

export default function GestaoTrocaFichaPage() {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [troca, setTroca] = useState<GestaoTrocaRow | null>(null);
  const [eventos, setEventos] = useState<GestaoTrocaEvento[]>([]);
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    if (!id) return;
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
    await savePatch({ fipe_valor: data.fipe_valor, fipe_mes_ref: data.fipe_mes_ref });
    toast.success("FIPE atualizada.");
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
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Falha na procedência.");
      return;
    }
    await savePatch({ procedencia_consulta_id: data.consulta_id });
    await recalcular();
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

  const uploadFoto = async (file: File) => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user || !id) return;
    const path = `${user.id}/${id}/${Date.now()}-${file.name}`;
    const { error } = await supabase.storage.from("trocas").upload(path, file);
    if (error) {
      toast.error("Falha no upload.");
      return;
    }
    const fotos = [...(troca?.fotos_json ?? []), path];
    await savePatch({ fotos_json: fotos });
  };

  if (!troca) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-6 w-6 animate-spin" />
      </div>
    );
  }

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
          <Button variant="outline" size="sm" onClick={() => downloadGestaoTrocaRelatorioPdf(troca, eventos)}>
            Relatório PDF
          </Button>
        </div>

        <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">Veículo e cliente</h2>
          <div className="grid gap-2 sm:grid-cols-2">
            <div><Label>Placa</Label><Input value={troca.placa ?? ""} onChange={(e) => setTroca({ ...troca, placa: e.target.value })} onBlur={() => void savePatch({ placa: troca.placa })} /></div>
            <div><Label>Marca</Label><Input value={troca.marca} onChange={(e) => setTroca({ ...troca, marca: e.target.value })} onBlur={() => void savePatch({ marca: troca.marca })} /></div>
            <div><Label>Modelo</Label><Input value={troca.modelo} onChange={(e) => setTroca({ ...troca, modelo: e.target.value })} onBlur={() => void savePatch({ modelo: troca.modelo })} /></div>
            <div><Label>Ano modelo</Label><Input type="number" value={troca.ano_modelo ?? ""} onChange={(e) => setTroca({ ...troca, ano_modelo: Number(e.target.value) || null })} onBlur={() => void savePatch({ ano_modelo: troca.ano_modelo })} /></div>
            <div><Label>KM</Label><Input type="number" value={troca.km ?? ""} onChange={(e) => setTroca({ ...troca, km: Number(e.target.value) || null })} onBlur={() => void savePatch({ km: troca.km })} /></div>
            <div><Label>Cliente</Label><Input value={troca.cliente_nome ?? ""} onChange={(e) => setTroca({ ...troca, cliente_nome: e.target.value })} onBlur={() => void savePatch({ cliente_nome: troca.cliente_nome })} /></div>
          </div>
          <Textarea placeholder="Observações" value={troca.observacoes ?? ""} onChange={(e) => setTroca({ ...troca, observacoes: e.target.value })} onBlur={() => void savePatch({ observacoes: troca.observacoes })} />
        </section>

        <section className="space-y-3 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">KBB (informado pelo avaliador)</h2>
          <p className="text-xs text-muted-foreground">
            <a href="https://www.kbb.com.br" target="_blank" rel="noopener noreferrer" className="underline">
              Consultar no kbb.com.br
            </a>
          </p>
          <div className="grid gap-2 sm:grid-cols-3">
            <GestaoMoneyInput label="KBB troca" value={String(troca.kbb_troca ?? "")} onChange={(v) => setTroca({ ...troca, kbb_troca: v ? Number(v.replace(/\D/g, "")) : null })} />
            <GestaoMoneyInput label="KBB loja" value={String(troca.kbb_loja ?? "")} onChange={(v) => setTroca({ ...troca, kbb_loja: v ? Number(v) : null })} />
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
          <GestaoMoneyInput label="Preparação estimada" value={String(troca.preparacao_estimada ?? 0)} onChange={(v) => setTroca({ ...troca, preparacao_estimada: Number(v) || 0 })} />
          <GestaoMoneyInput label="Valor proposto (cliente)" value={String(troca.valor_proposto ?? "")} onChange={(v) => setTroca({ ...troca, valor_proposto: Number(v) || null })} />
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
          <Input type="file" accept="image/*" onChange={(e) => { const f = e.target.files?.[0]; if (f) void uploadFoto(f); }} />
          <p className="text-xs text-muted-foreground">{troca.fotos_json?.length ?? 0} foto(s)</p>
        </section>

        <section className="space-y-2 rounded-lg border bg-white p-4 dark:bg-gray-950">
          <h2 className="font-semibold">Ações · {troca.status}</h2>
          <div className="flex flex-wrap gap-2">
            {troca.status === "em_avaliacao" && (
              <Button size="sm" onClick={() => void transicao("solicitar_aprovacao")}>Solicitar aprovação</Button>
            )}
            {troca.status === "aguardando_aprovacao" && (
              <>
                <Button size="sm" onClick={() => void transicao("aprovar", { valor_aprovado: troca.valor_proposto ?? troca.valor_sugerido })}>Aprovar</Button>
                <Button size="sm" variant="secondary" onClick={() => void transicao("recusar_aprovacao")}>Recusar</Button>
              </>
            )}
            {troca.status === "aprovada" && (
              <Button size="sm" onClick={() => void transicao("fechar", { valor_fechado: troca.valor_aprovado })}>Fechar troca</Button>
            )}
            {troca.status === "fechada" && !troca.veiculo_id && (
              <>
                <Button size="sm" onClick={async () => {
                  setBusy(true);
                  const { data, error } = await supabase.functions.invoke("gestao-troca", { body: { action: "liberar_estoque", troca_id: id } });
                  setBusy(false);
                  if (error || !data?.success) toast.error(data?.error ?? "Falha.");
                  else toast.success("Liberado para estoque.");
                  void load();
                }}>Liberar para venda</Button>
                <Button size="sm" variant="secondary" onClick={async () => {
                  const comprador = prompt("Comprador repasse");
                  const valor = prompt("Valor repasse");
                  if (!comprador || !valor) return;
                  setBusy(true);
                  const { data, error } = await supabase.functions.invoke("gestao-troca", {
                    body: { action: "repasse", troca_id: id, comprador, valor: Number(valor), data: new Date().toISOString().slice(0, 10) },
                  });
                  setBusy(false);
                  if (error || !data?.success) toast.error(data?.error ?? "Falha.");
                  else toast.success("Repasse registrado.");
                  void load();
                }}>Registrar repasse</Button>
              </>
            )}
            {!["fechada", "cancelada", "perdida", "recusada_cliente"].includes(troca.status) && (
              <>
                <Button size="sm" variant="ghost" onClick={() => void transicao("cliente_recusou")}>Cliente recusou</Button>
                <Button size="sm" variant="ghost" onClick={() => void transicao("perdida")}>Perdida</Button>
                <Button size="sm" variant="ghost" onClick={() => void transicao("cancelar")}>Cancelar</Button>
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
    </div>
  );
}
