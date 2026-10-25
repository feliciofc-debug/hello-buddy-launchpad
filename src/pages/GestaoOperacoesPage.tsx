import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useSearchParams } from "react-router-dom";
import { AlertTriangle, ArrowLeft, Plus, Settings2, UsersRound } from "lucide-react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useSmartBack } from "@/lib/app-back-nav.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import {
  alertasGestaoOs,
  GESTAO_OS_STATUS,
  type GestaoOsStatus,
} from "../../supabase/functions/_shared/gestao-os-domain.ts";
import {
  GESTAO_OS_STATUS_LABEL,
  GESTAO_OS_TIPO_LABEL,
  type GestaoOsRow,
  type GestaoOsTipo,
  type GestaoParceiroRow,
} from "@/lib/gestao-os-types.ts";

type Veiculo = {
  id: string;
  marca: string;
  modelo: string;
  placa: string | null;
  status: string;
  created_at: string;
};

const TIPOS: GestaoOsTipo[] = ["preparacao", "garantia", "revisao", "avulsa"];

export default function GestaoOperacoesPage() {
  const goBack = useSmartBack("/gestao/lucro");
  const [searchParams] = useSearchParams();
  const [rows, setRows] = useState<GestaoOsRow[]>([]);
  const [veiculos, setVeiculos] = useState<Veiculo[]>([]);
  const [parceiros, setParceiros] = useState<GestaoParceiroRow[]>([]);
  const [config, setConfig] = useState({ osParadaDias: 7, preparacaoParadaDias: 15 });
  const [filtro, setFiltro] = useState<GestaoOsStatus | "todas">("todas");
  const [modo, setModo] = useState<"lista" | "kanban">("lista");
  const [loading, setLoading] = useState(true);
  const [criando, setCriando] = useState(false);
  const [form, setForm] = useState({
    veiculoId: "",
    parceiroId: "",
    tipo: "preparacao" as GestaoOsTipo,
    dataPrevista: "",
  });

  const load = useCallback(async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const [osRes, veiculosRes, parceirosRes, configRes] = await Promise.all([
      supabase.from("gestao_os" as "veiculos_estoque").select("*")
        .eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("veiculos_estoque").select("id,marca,modelo,placa,status,created_at")
        .eq("user_id", user.id).order("created_at", { ascending: false }),
      supabase.from("gestao_parceiro" as "veiculos_estoque").select("*")
        .eq("user_id", user.id).eq("ativo", true).order("nome"),
      supabase.from("gestao_os_config" as "veiculos_estoque")
        .select("alerta_os_parada_dias,alerta_preparacao_parada_dias")
        .eq("user_id", user.id).maybeSingle(),
    ]);
    setRows((osRes.data ?? []) as unknown as GestaoOsRow[]);
    setVeiculos((veiculosRes.data ?? []) as unknown as Veiculo[]);
    setParceiros((parceirosRes.data ?? []) as unknown as GestaoParceiroRow[]);
    const c = configRes.data as unknown as {
      alerta_os_parada_dias?: number;
      alerta_preparacao_parada_dias?: number;
    } | null;
    setConfig({
      osParadaDias: c?.alerta_os_parada_dias ?? 7,
      preparacaoParadaDias: c?.alerta_preparacao_parada_dias ?? 15,
    });
    setLoading(false);
  }, []);

  useEffect(() => void load(), [load]);
  useEffect(() => {
    const veiculoId = searchParams.get("veiculo");
    if (veiculoId) setForm((f) => ({ ...f, veiculoId }));
  }, [searchParams]);

  const veiculoMap = useMemo(
    () => new Map(veiculos.map((v) => [v.id, v])),
    [veiculos],
  );
  const parceiroMap = useMemo(
    () => new Map(parceiros.map((p) => [p.id, p])),
    [parceiros],
  );
  const alertas = useMemo(() => alertasGestaoOs(rows.map((os) => {
    const v = veiculoMap.get(os.veiculo_id);
    return {
      status: os.status,
      tipo: os.tipo,
      ultimaMovimentacaoEm: os.ultima_movimentacao_em,
      veiculoStatus: v?.status,
      entradaVeiculoEm: v?.created_at,
    };
  }), config), [rows, veiculoMap, config]);
  const visiveis = filtro === "todas" ? rows : rows.filter((r) => r.status === filtro);

  const criar = async () => {
    if (!form.veiculoId || !form.parceiroId) {
      toast.error("Escolha o veículo e o fornecedor.");
      return;
    }
    setCriando(true);
    const { data, error } = await (supabase as unknown as {
      rpc: (name: string, args: Record<string, unknown>) => Promise<{
        data: { id?: string } | null;
        error: { message: string } | null;
      }>;
    }).rpc("gestao_os_criar", {
      p_veiculo_id: form.veiculoId,
      p_tipo: form.tipo,
      p_parceiro_id: form.parceiroId,
      p_origem: "manual",
      p_data_prevista: form.dataPrevista || null,
    });
    setCriando(false);
    if (error) return toast.error(error.message);
    toast.success(`OS criada${data?.id ? "" : "."}`);
    setForm({ veiculoId: "", parceiroId: "", tipo: "preparacao", dataPrevista: "" });
    await load();
  };

  return (
    <div className="min-h-screen bg-muted/30 p-4 md:p-6">
      <div className="mx-auto max-w-7xl space-y-5">
        <button type="button" onClick={goBack} className="flex items-center gap-2 text-sm text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <header className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Operações</h1>
            <p className="text-sm text-muted-foreground">Ordens de serviço, preparação e garantia.</p>
          </div>
          <div className="flex gap-2">
            <Button variant="outline" asChild><Link to="/gestao/parceiros"><UsersRound className="mr-2 h-4 w-4" />Parceiros</Link></Button>
            <Button variant="outline" asChild><Link to="/gestao/operacoes/config"><Settings2 className="mr-2 h-4 w-4" />Configurar</Link></Button>
          </div>
        </header>

        {(alertas.osParadas > 0 || alertas.preparacoesParadas > 0) && (
          <div className="flex flex-wrap gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900">
            <AlertTriangle className="h-5 w-5" />
            {alertas.osParadas > 0 && <span>{alertas.osParadas} OS sem movimento há {config.osParadaDias}+ dias.</span>}
            {alertas.preparacoesParadas > 0 && <span>{alertas.preparacoesParadas} carro(s) em preparação há {config.preparacaoParadaDias}+ dias.</span>}
          </div>
        )}

        <section className="rounded-lg border bg-background p-4">
          <h2 className="mb-3 font-semibold">Abrir ordem de serviço</h2>
          <div className="grid gap-3 md:grid-cols-5">
            <Select value={form.veiculoId} onValueChange={(veiculoId) => setForm((f) => ({ ...f, veiculoId }))}>
              <SelectTrigger><SelectValue placeholder="Veículo" /></SelectTrigger>
              <SelectContent>{veiculos.map((v) => <SelectItem key={v.id} value={v.id}>{v.marca} {v.modelo} · {v.placa ?? "sem placa"}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.parceiroId} onValueChange={(parceiroId) => setForm((f) => ({ ...f, parceiroId }))}>
              <SelectTrigger><SelectValue placeholder="Fornecedor" /></SelectTrigger>
              <SelectContent>{parceiros.map((p) => <SelectItem key={p.id} value={p.id}>{p.nome}</SelectItem>)}</SelectContent>
            </Select>
            <Select value={form.tipo} onValueChange={(tipo) => setForm((f) => ({ ...f, tipo: tipo as GestaoOsTipo }))}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>{TIPOS.map((tipo) => <SelectItem key={tipo} value={tipo}>{GESTAO_OS_TIPO_LABEL[tipo]}</SelectItem>)}</SelectContent>
            </Select>
            <Input type="date" value={form.dataPrevista} onChange={(e) => setForm((f) => ({ ...f, dataPrevista: e.target.value }))} />
            <Button disabled={criando} onClick={() => void criar()}><Plus className="mr-2 h-4 w-4" />Abrir OS</Button>
          </div>
        </section>

        <div className="flex flex-wrap gap-3">
          <Select value={filtro} onValueChange={(v) => setFiltro(v as GestaoOsStatus | "todas")}>
            <SelectTrigger className="w-64"><SelectValue /></SelectTrigger>
            <SelectContent>
              <SelectItem value="todas">Todos os status</SelectItem>
              {GESTAO_OS_STATUS.map((s) => <SelectItem key={s} value={s}>{GESTAO_OS_STATUS_LABEL[s]}</SelectItem>)}
            </SelectContent>
          </Select>
          <Button variant={modo === "lista" ? "default" : "outline"} onClick={() => setModo("lista")}>Lista</Button>
          <Button variant={modo === "kanban" ? "default" : "outline"} onClick={() => setModo("kanban")}>Kanban</Button>
        </div>

        {loading ? <p>Carregando…</p> : modo === "kanban" ? (
          <div className="flex gap-3 overflow-x-auto pb-3">
            {GESTAO_OS_STATUS.filter((s) => visiveis.some((os) => os.status === s)).map((status) => (
              <section key={status} className="w-72 shrink-0 rounded-lg border bg-muted/30 p-3">
                <h2 className="mb-3 text-sm font-semibold">{GESTAO_OS_STATUS_LABEL[status]} · {visiveis.filter((os) => os.status === status).length}</h2>
                <div className="space-y-2">{visiveis.filter((os) => os.status === status).map((os) => {
                  const v = veiculoMap.get(os.veiculo_id);
                  return <Link key={os.id} to={`/gestao/operacoes/${os.id}`} className="block rounded border bg-background p-3 text-sm shadow-sm hover:border-primary">
                    <strong>OS #{os.numero}</strong>
                    <p>{v ? `${v.marca} ${v.modelo}` : "Veículo"}</p>
                    <p className="text-xs text-muted-foreground">{GESTAO_OS_TIPO_LABEL[os.tipo]} · {os.data_prevista ?? "sem prazo"}</p>
                  </Link>;
                })}</div>
              </section>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-background">
            <table className="w-full text-sm">
              <thead><tr className="border-b text-left text-muted-foreground">
                <th className="p-3">OS</th><th className="p-3">Veículo</th>
                <th className="p-3">Tipo</th><th className="p-3">Fornecedor</th>
                <th className="p-3">Prazo</th><th className="p-3">Valores</th><th className="p-3">Status</th>
              </tr></thead>
              <tbody>{visiveis.map((os) => {
                const v = veiculoMap.get(os.veiculo_id);
                return <tr key={os.id} className="border-b hover:bg-muted/40">
                  <td className="p-3"><Link className="font-semibold text-primary underline" to={`/gestao/operacoes/${os.id}`}>#{os.numero}</Link></td>
                  <td className="p-3">{v ? `${v.marca} ${v.modelo} · ${v.placa ?? "sem placa"}` : "—"}</td>
                  <td className="p-3">{GESTAO_OS_TIPO_LABEL[os.tipo]}</td>
                  <td className="p-3">{parceiroMap.get(os.parceiro_id ?? "")?.nome ?? "—"}</td>
                  <td className="p-3">{os.data_prevista ?? "—"}</td>
                  <td className="p-3">{formatGestaoMoney(os.valor_estimado)} / {os.valor_real == null ? "—" : formatGestaoMoney(os.valor_real)}</td>
                  <td className="p-3"><Badge variant={os.status === "cancelada" ? "destructive" : "outline"}>{GESTAO_OS_STATUS_LABEL[os.status]}</Badge></td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
