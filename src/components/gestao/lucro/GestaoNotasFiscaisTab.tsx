import { useCallback, useEffect, useMemo, useState } from "react";
import { ExternalLink, Loader2, RefreshCw } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Textarea } from "@/components/ui/textarea";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import { loadGestaoNfeList, type GestaoNfeRow } from "@/lib/gestao-nfe-load.ts";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { supabase } from "@/integrations/supabase/client";
import { Link } from "react-router-dom";

const TIPO_LABEL: Record<string, string> = {
  entrada_compra_pf: "Entrada (compra PF)",
  saida_venda: "Saída (venda)",
  consignacao: "Consignação",
};

type Props = {
  userId: string;
  veiculos: GestaoVeiculoEnriched[];
};

export function GestaoNotasFiscaisTab({ userId, veiculos }: Props) {
  const [rows, setRows] = useState<GestaoNfeRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [statusFilter, setStatusFilter] = useState("all");
  const [tipoFilter, setTipoFilter] = useState("all");
  const [q, setQ] = useState("");
  const [cancelId, setCancelId] = useState<string | null>(null);
  const [cceId, setCceId] = useState<string | null>(null);
  const [texto, setTexto] = useState("");

  const veiculoLabel = useMemo(() => {
    const m = new Map<string, string>();
    for (const v of veiculos) {
      m.set(v.id, [v.marca, v.modelo, v.placa].filter(Boolean).join(" "));
    }
    return m;
  }, [veiculos]);

  const refresh = useCallback(async () => {
    setLoading(true);
    setRows(await loadGestaoNfeList(userId));
    setLoading(false);
  }, [userId]);

  useEffect(() => {
    void refresh();
  }, [refresh]);

  const filtered = useMemo(() => {
    return rows.filter((r) => {
      if (statusFilter !== "all" && r.status !== statusFilter) return false;
      if (tipoFilter !== "all" && r.tipo_operacao !== tipoFilter) return false;
      if (q.trim()) {
        const label = (veiculoLabel.get(r.veiculo_id ?? "") ?? "").toLowerCase();
        if (!label.includes(q.toLowerCase()) && !String(r.numero ?? "").includes(q)) return false;
      }
      return true;
    });
  }, [rows, statusFilter, tipoFilter, q, veiculoLabel]);

  const consultar = async (id: string) => {
    setBusyId(id);
    const { data, error } = await supabase.functions.invoke("gestao-nfe-consult", {
      body: { nfe_id: id },
    });
    setBusyId(null);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Consulta falhou.");
      return;
    }
    toast.success("Status atualizado.");
    void refresh();
  };

  const submitCancel = async () => {
    if (!cancelId || texto.trim().length < 15) {
      toast.error("Justificativa com pelo menos 15 caracteres.");
      return;
    }
    setBusyId(cancelId);
    const { data, error } = await supabase.functions.invoke("gestao-nfe-cancel", {
      body: { nfe_id: cancelId, justificativa: texto.trim() },
    });
    setBusyId(null);
    setCancelId(null);
    setTexto("");
    if (error || !data?.success) {
      toast.error(data?.error ?? "Cancelamento falhou.");
      return;
    }
    toast.success("Cancelamento solicitado.");
    void refresh();
  };

  const submitCce = async () => {
    if (!cceId || texto.trim().length < 15) {
      toast.error("Texto da correção com pelo menos 15 caracteres.");
      return;
    }
    setBusyId(cceId);
    const { data, error } = await supabase.functions.invoke("gestao-nfe-cce", {
      body: { nfe_id: cceId, correcao: texto.trim() },
    });
    setBusyId(null);
    setCceId(null);
    setTexto("");
    if (error || !data?.success) {
      toast.error(data?.error ?? "Carta de correção falhou.");
      return;
    }
    toast.success("CC-e enviada.");
    void refresh();
  };

  if (loading) {
    return (
      <div className="flex justify-center py-8">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <p className="text-sm text-muted-foreground">
          Links DANFE/XML vêm da Focus — não armazenamos PDF/XML aqui.
        </p>
        <Button asChild variant="outline" size="sm">
          <Link to="/gestao/configuracao-fiscal">Configuração fiscal</Link>
        </Button>
      </div>

      <div className="flex flex-wrap gap-2">
        <Input placeholder="Buscar veículo ou número…" value={q} onChange={(e) => setQ(e.target.value)} className="max-w-xs" />
        <Select value={tipoFilter} onValueChange={setTipoFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Tipo" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos os tipos</SelectItem>
            <SelectItem value="entrada_compra_pf">Entrada</SelectItem>
            <SelectItem value="saida_venda">Saída</SelectItem>
            <SelectItem value="consignacao">Consignação</SelectItem>
          </SelectContent>
        </Select>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-[160px]"><SelectValue placeholder="Status" /></SelectTrigger>
          <SelectContent>
            <SelectItem value="all">Todos status</SelectItem>
            <SelectItem value="processando">Processando</SelectItem>
            <SelectItem value="autorizada">Autorizada</SelectItem>
            <SelectItem value="rejeitada">Rejeitada</SelectItem>
            <SelectItem value="cancelada">Cancelada</SelectItem>
            <SelectItem value="erro">Erro</SelectItem>
          </SelectContent>
        </Select>
        <Button variant="outline" size="icon" onClick={() => void refresh()}>
          <RefreshCw className="h-4 w-4" />
        </Button>
      </div>

      {!filtered.length ? (
        <p className="text-sm text-muted-foreground">Nenhuma nota registrada.</p>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left">
              <tr>
                <th className="p-2">Tipo</th>
                <th className="p-2">Veículo</th>
                <th className="p-2">Nº / Série</th>
                <th className="p-2">Valor</th>
                <th className="p-2">Status</th>
                <th className="p-2">Data</th>
                <th className="p-2">Ações</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((r) => (
                <tr key={r.id} className="border-t">
                  <td className="p-2">{TIPO_LABEL[r.tipo_operacao] ?? r.tipo_operacao}</td>
                  <td className="p-2">{veiculoLabel.get(r.veiculo_id ?? "") ?? "—"}</td>
                  <td className="p-2">
                    {r.numero != null ? r.numero : "—"}
                    {r.serie != null ? ` / ${r.serie}` : ""}
                  </td>
                  <td className="p-2">{r.valor_total != null ? formatGestaoMoney(r.valor_total) : "—"}</td>
                  <td className="p-2"><Badge variant="outline">{r.status}</Badge></td>
                  <td className="p-2">{(r.authorized_at ?? r.created_at).slice(0, 10)}</td>
                  <td className="p-2">
                    <div className="flex flex-wrap gap-1">
                      <Button size="sm" variant="ghost" disabled={busyId === r.id} onClick={() => void consultar(r.id)}>
                        Atualizar
                      </Button>
                      {r.danfe_url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={r.danfe_url} target="_blank" rel="noopener noreferrer">
                            DANFE <ExternalLink className="ml-1 h-3 w-3" />
                          </a>
                        </Button>
                      )}
                      {r.xml_url && (
                        <Button size="sm" variant="outline" asChild>
                          <a href={r.xml_url} target="_blank" rel="noopener noreferrer">
                            XML
                          </a>
                        </Button>
                      )}
                      {r.status === "autorizada" && (
                        <>
                          <Button size="sm" variant="outline" onClick={() => { setCancelId(r.id); setTexto(""); }}>
                            Cancelar
                          </Button>
                          <Button size="sm" variant="outline" onClick={() => { setCceId(r.id); setTexto(""); }}>
                            CC-e
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={!!cancelId} onOpenChange={() => setCancelId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Cancelar NF-e</DialogTitle></DialogHeader>
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Justificativa (mín. 15 caracteres)" />
          <DialogFooter>
            <Button onClick={() => void submitCancel()}>Confirmar cancelamento</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={!!cceId} onOpenChange={() => setCceId(null)}>
        <DialogContent>
          <DialogHeader><DialogTitle>Carta de correção</DialogTitle></DialogHeader>
          <Textarea value={texto} onChange={(e) => setTexto(e.target.value)} placeholder="Correção (mín. 15 caracteres)" />
          <DialogFooter>
            <Button onClick={() => void submitCce()}>Enviar CC-e</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
