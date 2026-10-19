import { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { ArrowLeft, Plus } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import type { GestaoTrocaRow, GestaoTrocaStatus } from "@/lib/gestao-troca-types.ts";
import { useSmartBack } from "@/lib/app-back-nav.ts";

const STATUS_LABEL: Record<GestaoTrocaStatus, string> = {
  em_avaliacao: "Em avaliação",
  aguardando_aprovacao: "Aguardando aprovação",
  aprovada: "Aprovada",
  fechada: "Fechada",
  recusada_cliente: "Recusada (cliente)",
  perdida: "Perdida",
  cancelada: "Cancelada",
};

function semaforoBadge(s: GestaoTrocaRow["semaforo"]) {
  if (s === "verde") return <Badge className="bg-green-600">Verde</Badge>;
  if (s === "amarelo") return <Badge className="bg-amber-500">Amarelo</Badge>;
  if (s === "vermelho") return <Badge variant="destructive">Vermelho</Badge>;
  return <Badge variant="outline">—</Badge>;
}

export default function GestaoTrocasPage() {
  const goBack = useSmartBack("/gestao/lucro");
  const navigate = useNavigate();
  const [rows, setRows] = useState<GestaoTrocaRow[]>([]);
  const [filtro, setFiltro] = useState<GestaoTrocaStatus | "">("");
  const [loading, setLoading] = useState(true);

  const load = async () => {
    setLoading(true);
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    let q = supabase.from("gestao_troca" as "veiculos_estoque").select("*")
      .eq("user_id", user.id)
      .order("created_at", { ascending: false })
      .limit(100);
    if (filtro) q = q.eq("status", filtro);
    const { data } = await q;
    setRows((data ?? []) as unknown as GestaoTrocaRow[]);
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, [filtro]);

  const nova = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    const { data, error } = await supabase.from("gestao_troca" as "veiculos_estoque").insert({
      user_id: user.id,
      marca: "—",
      modelo: "—",
      status: "em_avaliacao",
    }).select("id").single();
    if (error || !data?.id) return;
    await supabase.from("gestao_troca_evento" as "veiculos_estoque").insert({
      troca_id: data.id,
      user_id: user.id,
      tipo: "criada",
      descricao: "Ficha de troca criada",
      autor: "painel",
    });
    navigate(`/gestao/trocas/${data.id}`);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-6 dark:bg-gray-900">
      <div className="mx-auto max-w-5xl space-y-4">
        <button type="button" onClick={goBack} className="flex items-center gap-2 text-muted-foreground">
          <ArrowLeft className="h-4 w-4" /> Voltar
        </button>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h1 className="text-2xl font-bold">Trocas</h1>
          <div className="flex gap-2">
            <Button variant="outline" asChild>
              <Link to="/gestao/trocas/config">Configuração</Link>
            </Button>
            <Button onClick={() => void nova()}>
              <Plus className="mr-1 h-4 w-4" /> Nova avaliação
            </Button>
          </div>
        </div>
        <select
          className="rounded border px-2 py-1 text-sm"
          value={filtro}
          onChange={(e) => setFiltro(e.target.value as GestaoTrocaStatus | "")}
        >
          <option value="">Todos os status</option>
          {(Object.keys(STATUS_LABEL) as GestaoTrocaStatus[]).map((s) => (
            <option key={s} value={s}>{STATUS_LABEL[s]}</option>
          ))}
        </select>
        {loading ? (
          <p className="text-sm text-muted-foreground">Carregando…</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-white dark:bg-gray-950">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="p-2">Placa</th>
                  <th className="p-2">Veículo</th>
                  <th className="p-2">Data</th>
                  <th className="p-2">Proposto</th>
                  <th className="p-2">Semáforo</th>
                  <th className="p-2">Status</th>
                  <th className="p-2">Destino</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.id} className="border-b hover:bg-muted/40">
                    <td className="p-2">
                      <Link className="font-medium text-primary underline" to={`/gestao/trocas/${r.id}`}>
                        {r.placa ?? "—"}
                      </Link>
                    </td>
                    <td className="p-2">{r.marca} {r.modelo}</td>
                    <td className="p-2">{r.created_at.slice(0, 10)}</td>
                    <td className="p-2">{formatGestaoMoney(r.valor_proposto ?? 0)}</td>
                    <td className="p-2">{semaforoBadge(r.semaforo)}</td>
                    <td className="p-2">{STATUS_LABEL[r.status]}</td>
                    <td className="p-2 capitalize">{r.destino ?? "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
