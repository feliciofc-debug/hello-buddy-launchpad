import { useCallback, useEffect, useMemo, useState } from "react";
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
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import type { GestaoContaLancamento } from "@/lib/gestao-financeiro-load.ts";
import {
  aplicarMarcadoresConfirmar,
  aplicarMatchAutomatico,
  conciliarExtrato,
  importExtratoLinhas,
  loadContasBancarias,
  loadExtratoTransacoes,
  marcarExtratoConfirmar,
  saveContaBancaria,
  type GestaoContaBancaria,
} from "@/lib/gestao-conciliacao-load.ts";
import { parseGestaoOfx } from "../../../../supabase/functions/_shared/gestao-ofx-parse.ts";
import { parseGestaoExtratoCsv } from "../../../../supabase/functions/_shared/gestao-extrato-csv-parse.ts";
import {
  candidatosFromComissaoExtrato,
  candidatosFromContas,
  candidatosFromDespesas,
  candidatosFromVendas,
} from "../../../../supabase/functions/_shared/gestao-conciliacao-candidates.ts";
import { classificarExtrato, saldoExtrato } from "@/lib/gestao-conciliacao-run.ts";
import {
  GESTAO_CATEGORIAS_PAGAR,
  GESTAO_CATEGORIAS_RECEBER,
  gestaoOperacionalCategoriaLabel,
} from "../../../../supabase/functions/_shared/gestao-operacional-categorias.ts";
import { supabase } from "@/integrations/supabase/client";

type Props = {
  userId: string;
  contas: GestaoContaLancamento[];
  veiculos: GestaoVeiculoEnriched[];
};

function monthBounds(competencia: string) {
  const [y, m] = competencia.split("-").map(Number);
  return {
    start: `${competencia}-01`,
    end: new Date(y, m, 0).toISOString().slice(0, 10),
  };
}

export function GestaoConciliacaoTab({ userId, contas, veiculos }: Props) {
  const [competencia, setCompetencia] = useState(() => {
    const d = new Date();
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
  });
  const [bancos, setBancos] = useState<GestaoContaBancaria[]>([]);
  const [contaId, setContaId] = useState("");
  const [extratos, setExtratos] = useState<Awaited<ReturnType<typeof loadExtratoTransacoes>>>([]);
  const [bankForm, setBankForm] = useState({ banco_nome: "", apelido: "", ultimos_4: "" });
  const [csvMap, setCsvMap] = useState({ data: 0, descricao: 1, valor: 2, debitoCredito: 3 });
  const [comissaoRows, setComissaoRows] = useState<Array<{ id: string; competencia: string; valor_comissao: number; pago_em: string | null }>>([]);
  const [criarCategoria, setCriarCategoria] = useState<Record<string, string>>({});

  const { start, end } = monthBounds(competencia);

  const reload = useCallback(async () => {
    const b = await loadContasBancarias(userId);
    setBancos(b);
    if (!contaId && b[0]) setContaId(b[0].id);
    const cid = contaId || b[0]?.id;
    if (!cid) {
      setExtratos([]);
      return;
    }
    const rows = await loadExtratoTransacoes(userId, cid, start, end);
    setExtratos(rows);
  }, [userId, contaId, start, end]);

  useEffect(() => {
    void reload();
  }, [reload]);

  useEffect(() => {
    void (async () => {
      const { data } = await supabase.from("gestao_comissao_extrato" as "veiculos_estoque")
        .select("id, competencia, valor_comissao, pago_em")
        .eq("user_id", userId);
      setComissaoRows((data ?? []) as typeof comissaoRows);
    })();
  }, [userId]);

  const candidatos = useMemo(() => {
    const vendas = veiculos
      .filter((v) => v.dataVenda && v.valorVenda)
      .map((v) => ({
        veiculo_id: v.id,
        data_venda: v.dataVenda!,
        valor_venda: v.valorVenda!,
      }));
    const despesas = veiculos.flatMap((v) =>
      v.despesas.map((d) => ({
        id: d.id,
        data: d.data,
        valor: Number(d.valor),
        descricao: d.descricao,
        categoria: d.categoria,
      })),
    );
    return [
      ...candidatosFromContas(contas),
      ...candidatosFromDespesas(despesas),
      ...candidatosFromVendas(vendas),
      ...candidatosFromComissaoExtrato(comissaoRows),
    ];
  }, [contas, veiculos, comissaoRows]);

  const classificados = useMemo(() => classificarExtrato(extratos, candidatos), [extratos, candidatos]);

  const conciliadas = classificados.filter((e) => e.status === "conciliado");
  const confirmar = classificados.filter((e) =>
    e.status === "confirmar" || (e.status === "pendente" && e.sugestoes.length > 0 && !e.sugestoes[0].auto),
  );
  const semMatch = classificados.filter((e) =>
    e.status === "pendente" && e.sugestoes.length === 0,
  );

  const saldoExt = saldoExtrato(extratos);
  const saldoSistema = useMemo(() => {
    let s = 0;
    for (const c of contas) {
      if (c.tipo === "receber" && c.recebido_em && c.recebido_em >= start && c.recebido_em <= end) s += Number(c.valor);
      if (c.tipo === "pagar" && c.pago_em && c.pago_em >= start && c.pago_em <= end) s -= Number(c.valor);
    }
    return s;
  }, [contas, start, end]);

  const addBanco = async () => {
    try {
      await saveContaBancaria(userId, bankForm);
      setBankForm({ banco_nome: "", apelido: "", ultimos_4: "" });
      toast.success("Conta bancária cadastrada.");
      void reload();
    } catch {
      toast.error("Informe apelido e 4 últimos dígitos.");
    }
  };

  const onFile = async (file: File) => {
    if (!contaId) {
      toast.error("Selecione a conta bancária.");
      return;
    }
    const text = await file.text();
    const linhas = file.name.toLowerCase().endsWith(".ofx")
      ? parseGestaoOfx(text)
      : parseGestaoExtratoCsv(text, csvMap, text.includes(";") ? ";" : ",").map((l) => ({
        ...l,
        fitid: null as string | null,
      }));
    if (!linhas.length) {
      toast.error("Nenhuma transação encontrada no arquivo.");
      return;
    }
    const { inseridas, ignoradas } = await importExtratoLinhas(userId, contaId, linhas);
    await reload();
    const classificadosFresh = classificarExtrato(await loadExtratoTransacoes(userId, contaId, start, end), candidatos);
    const payload = classificadosFresh.map((e) => ({
      id: e.id,
      status: e.status,
      data: e.data,
      valor: Number(e.valor),
      sugestoes: e.sugestoes,
    }));
    await aplicarMatchAutomatico(userId, payload);
    await aplicarMarcadoresConfirmar(userId, payload);
    await reload();
    toast.success(`Importadas ${inseridas} transações (${ignoradas} duplicadas ignoradas).`);
  };

  const confirmarMatch = async (extratoId: string, sug: (typeof classificados)[0]["sugestoes"][0]) => {
    await conciliarExtrato(userId, extratoId, {
      tipo: sug.candidato.tipo,
      refId: sug.candidato.refId,
      score: sug.score,
      valor: sug.candidato.valor,
    }, classificados.find((e) => e.id === extratoId)?.data ?? new Date().toISOString().slice(0, 10));
    toast.success("Conciliado.");
    void reload();
  };

  const criarLancamento = async (e: (typeof semMatch)[0]) => {
    const tipo = e.sentido === "debito" ? "pagar" : "receber";
    const cats = tipo === "pagar" ? GESTAO_CATEGORIAS_PAGAR : GESTAO_CATEGORIAS_RECEBER;
    const categoria = criarCategoria[e.id] ?? cats[0];
    const { data: row, error } = await supabase.from("gestao_conta_lancamento" as "veiculos_estoque").insert({
      user_id: userId,
      tipo,
      categoria_operacional: categoria,
      valor: e.valor,
      vencimento: e.data,
      observacao: `Extrato: ${e.descricao}`.slice(0, 200),
      origem: "manual",
    }).select("id").single();
    if (error || !row?.id) {
      toast.error("Não foi possível criar o lançamento.");
      return;
    }
    await conciliarExtrato(userId, e.id, {
      tipo: tipo === "pagar" ? "conta_pagar" : "conta_receber",
      refId: String(row.id),
      score: 1,
      valor: Number(e.valor),
    }, e.data);
    toast.success("Lançamento criado e conciliado.");
    void reload();
  };

  return (
    <div className="space-y-4">
      <div className="grid gap-3 rounded-lg border p-4 md:grid-cols-3">
        <div>
          <Label>Banco (apelido)</Label>
          <Input placeholder="Nubank PJ" value={bankForm.apelido} onChange={(ev) => setBankForm({ ...bankForm, apelido: ev.target.value })} />
        </div>
        <div>
          <Label>Instituição</Label>
          <Input placeholder="Nubank" value={bankForm.banco_nome} onChange={(ev) => setBankForm({ ...bankForm, banco_nome: ev.target.value })} />
        </div>
        <div>
          <Label>Últimos 4 dígitos</Label>
          <Input maxLength={4} placeholder="1234" value={bankForm.ultimos_4} onChange={(ev) => setBankForm({ ...bankForm, ultimos_4: ev.target.value.replace(/\D/g, "").slice(0, 4) })} />
        </div>
        <Button type="button" className="md:col-span-3 md:w-fit" onClick={() => void addBanco()}>Cadastrar conta</Button>
      </div>

      <div className="flex flex-wrap items-end gap-3">
        <div>
          <Label>Conta</Label>
          <Select value={contaId} onValueChange={setContaId}>
            <SelectTrigger className="w-[220px]"><SelectValue placeholder="Conta" /></SelectTrigger>
            <SelectContent>
              {bancos.map((b) => (
                <SelectItem key={b.id} value={b.id}>{b.apelido} ···{b.ultimos_4}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div>
          <Label>Período</Label>
          <Input type="month" value={competencia} onChange={(ev) => setCompetencia(ev.target.value)} />
        </div>
        <div>
          <Label>Importar OFX/CSV</Label>
          <Input type="file" accept=".ofx,.csv" onChange={(ev) => {
            const f = ev.target.files?.[0];
            if (f) void onFile(f);
          }} />
        </div>
      </div>

      <p className="text-xs text-muted-foreground">
        CSV: colunas 0=data, 1=descrição, 2=valor (ajuste índices abaixo se necessário). Arquivo lido só no navegador.
      </p>
      <div className="flex flex-wrap gap-2 text-xs">
        {(["data", "descricao", "valor", "debitoCredito"] as const).map((k) => (
          <label key={k} className="flex items-center gap-1">
            {k}
            <Input className="h-7 w-12" type="number" value={csvMap[k]} onChange={(ev) => setCsvMap({ ...csvMap, [k]: Number(ev.target.value) })} />
          </label>
        ))}
      </div>

      <div className="grid gap-3 sm:grid-cols-3 rounded-lg border p-3 text-sm">
        <div>Saldo extrato (período): <strong>{formatGestaoMoney(saldoExt)}</strong></div>
        <div>Saldo sistema (liquidado): <strong>{formatGestaoMoney(saldoSistema)}</strong></div>
        <div>Diferença: <strong>{formatGestaoMoney(saldoExt - saldoSistema)}</strong></div>
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        <section className="space-y-2 rounded-lg border p-3">
          <h3 className="font-semibold">Conciliadas ({conciliadas.length})</h3>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
            {conciliadas.map((e) => (
              <li key={e.id} className="rounded border p-2">
                {e.data} · {formatGestaoMoney(Number(e.valor))} · {e.descricao.slice(0, 40)}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2 rounded-lg border p-3">
          <h3 className="font-semibold">Para confirmar ({confirmar.length})</h3>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
            {confirmar.map((e) => (
              <li key={e.id} className="rounded border p-2 space-y-1">
                <p>{e.data} · {formatGestaoMoney(Number(e.valor))} · {e.descricao.slice(0, 36)}</p>
                {e.sugestoes.slice(0, 2).map((s) => (
                  <Button key={s.candidato.refId} size="sm" variant="outline" className="mr-1 h-7 text-xs"
                    onClick={() => void confirmarMatch(e.id, s)}>
                    É esta: {s.candidato.tipo} {formatGestaoMoney(s.candidato.valor)}
                  </Button>
                ))}
              </li>
            ))}
          </ul>
        </section>

        <section className="space-y-2 rounded-lg border p-3">
          <h3 className="font-semibold">Sem correspondência ({semMatch.length})</h3>
          <ul className="max-h-64 space-y-2 overflow-y-auto text-xs">
            {semMatch.map((e) => (
              <li key={e.id} className="rounded border p-2">
                <p>{e.data} · {formatGestaoMoney(Number(e.valor))}</p>
                <p className="text-muted-foreground">{e.descricao.slice(0, 48)}</p>
                <Select
                  value={criarCategoria[e.id] ?? (e.sentido === "debito" ? GESTAO_CATEGORIAS_PAGAR[0] : GESTAO_CATEGORIAS_RECEBER[0])}
                  onValueChange={(v) => setCriarCategoria({ ...criarCategoria, [e.id]: v })}
                >
                  <SelectTrigger className="mt-1 h-7 text-xs"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {(e.sentido === "debito" ? GESTAO_CATEGORIAS_PAGAR : GESTAO_CATEGORIAS_RECEBER).map((c) => (
                      <SelectItem key={c} value={c}>{gestaoOperacionalCategoriaLabel(c)}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Button size="sm" className="mt-1 h-7" onClick={() => void criarLancamento(e)}>Criar lançamento</Button>
              </li>
            ))}
          </ul>
        </section>
      </div>
    </div>
  );
}
