import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";
import { maskCnpjForDisplay, maskCpfForDisplay } from "@/lib/brazil-doc-mask";
import {
  FINANCIAMENTO_FICHA_STATUS_OPTIONS,
  notifyFinanciamentoFichasChanged,
  type FinanciamentoFichaStatus,
} from "@/lib/financiamento-fichas-menu";
import { useFinanciamentoPendingCount } from "@/hooks/useFinanciamentoPendingCount";

type FinanciamentoFicha = {
  id: string;
  created_at: string;
  status: FinanciamentoFichaStatus;
  nome_completo: string | null;
  tipo_pessoa: string | null;
  cpf_cnpj: string | null;
  whatsapp_from: string;
  veiculo_id: string | null;
  lgpd_aceite_em: string;
  data_nascimento: string | null;
  email: string | null;
  tempo_residencia: string | null;
  perfil: string | null;
  empresa: string | null;
  tempo_trabalho: string | null;
  cnpj: string | null;
  tempo_empresa: string | null;
  possui_cnh: boolean | null;
  cep: string | null;
  logradouro: string | null;
  numero: string | null;
  complemento: string | null;
  bairro: string | null;
  cidade: string | null;
  uf: string | null;
  renda_mensal: number | null;
  referencia_nome: string | null;
  telefone_referencia: string | null;
  entrada: number | null;
  prazo_meses: number | null;
  campos_pendentes: string[] | null;
  veiculos_estoque?: {
    marca: string;
    modelo: string;
    versao: string | null;
    ano_modelo: number | null;
    preco: number | null;
  } | null;
};

function maskDoc(tipo: string | null, doc: string | null): string {
  if (!doc) return "—";
  return tipo === "pj" ? maskCnpjForDisplay(doc) : maskCpfForDisplay(doc);
}

function perfilLabel(perfil: string | null): string {
  switch (perfil) {
    case "assalariado": return "Assalariado";
    case "autonomo": return "Autônomo";
    case "empresario": return "Empresário";
    case "aposentado": return "Aposentado";
    default: return "—";
  }
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function statusLabel(status: FinanciamentoFichaStatus): string {
  switch (status) {
    case "pendente": return "Nova";
    case "em_analise": return "Em análise";
    case "concluida": return "Concluída";
    case "cancelada": return "Cancelada";
    default: return status;
  }
}

function FichaDetail({
  ficha,
  onStatusChange,
  statusSaving,
}: {
  ficha: FinanciamentoFicha;
  onStatusChange: (status: FinanciamentoFichaStatus) => void;
  statusSaving: boolean;
}) {
  const vehicleLabel = ficha.veiculos_estoque
    ? `${ficha.veiculos_estoque.marca} ${ficha.veiculos_estoque.modelo}${
      ficha.veiculos_estoque.versao ? ` ${ficha.veiculos_estoque.versao}` : ""
    }`
    : "—";

  return (
    <div className="space-y-6 print:space-y-4" id="ficha-print-root">
      <div className="hidden print:block mb-4">
        <h1 className="text-xl font-bold">Ficha de financiamento</h1>
        <p className="text-sm text-muted-foreground">
          {new Date(ficha.created_at).toLocaleString("pt-BR")}
        </p>
      </div>
      <Card className="print:shadow-none print:border">
        <CardHeader>
          <div className="flex flex-wrap items-start justify-between gap-3 print:block">
            <div>
              <CardTitle>{ficha.nome_completo ?? "Cliente (nome pendente)"}</CardTitle>
              <p className="text-sm text-muted-foreground">
                LGPD: {new Date(ficha.lgpd_aceite_em).toLocaleString("pt-BR")}
              </p>
            </div>
            <div className="flex items-center gap-2 print:hidden">
              <span className="text-sm text-muted-foreground">Status</span>
              <Select
                value={ficha.status}
                onValueChange={(v) => onStatusChange(v as FinanciamentoFichaStatus)}
                disabled={statusSaving}
              >
                <SelectTrigger className="w-[160px]">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {FINANCIAMENTO_FICHA_STATUS_OPTIONS.filter((o) => o.value !== "all").map((o) => (
                    <SelectItem key={o.value} value={o.value}>
                      {o.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>
          {(ficha.campos_pendentes?.length ?? 0) > 0 && (
            <div className="mt-2 flex flex-wrap gap-1">
              <span className="text-xs font-medium text-amber-700">Pendente consultor:</span>
              {ficha.campos_pendentes!.map((c) => (
                <Badge key={c} variant="outline" className="text-amber-800 border-amber-300">
                  {c}
                </Badge>
              ))}
            </div>
          )}
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <p><span className="font-medium">Veículo:</span> {vehicleLabel}</p>
          <p><span className="font-medium">WhatsApp:</span> {ficha.whatsapp_from}</p>
          <p><span className="font-medium">Perfil:</span> {perfilLabel(ficha.perfil)}</p>
          <p><span className="font-medium">CPF:</span> {maskDoc("pf", ficha.cpf_cnpj)}</p>
          <p><span className="font-medium">Nascimento:</span> {ficha.data_nascimento ?? "—"}</p>
          <p><span className="font-medium">E-mail:</span> {ficha.email ?? "—"}</p>
          <p><span className="font-medium">Tempo de residência:</span> {ficha.tempo_residencia ?? "—"}</p>
          <p><span className="font-medium">Empresa:</span> {ficha.empresa ?? "—"}</p>
          <p><span className="font-medium">Tempo de trabalho:</span> {ficha.tempo_trabalho ?? "—"}</p>
          <p><span className="font-medium">CNPJ atividade:</span> {ficha.cnpj ? maskCnpjForDisplay(ficha.cnpj) : "—"}</p>
          <p><span className="font-medium">Tempo de empresa:</span> {ficha.tempo_empresa ?? "—"}</p>
          <p><span className="font-medium">CNH:</span> {
            ficha.possui_cnh === true ? "Sim" : ficha.possui_cnh === false ? "Não" : "—"
          }</p>
          <p className="md:col-span-2">
            <span className="font-medium">Endereço:</span>{" "}
            {ficha.cep
              ? `${ficha.logradouro ?? ""}, ${ficha.numero ?? "s/n"}${ficha.complemento ? ` — ${ficha.complemento}` : ""} · ${ficha.bairro ?? ""} · ${ficha.cidade ?? ""}/${ficha.uf ?? ""} · CEP ${ficha.cep}`
              : "—"}
          </p>
          <p><span className="font-medium">Renda:</span> {formatMoney(ficha.renda_mensal)}</p>
          <p><span className="font-medium">Referência:</span> {ficha.referencia_nome ?? "—"} · {ficha.telefone_referencia ?? "—"}</p>
          <p><span className="font-medium">Entrada:</span> {formatMoney(ficha.entrada)}</p>
          <p><span className="font-medium">Prazo:</span> {ficha.prazo_meses != null ? `${ficha.prazo_meses} meses` : "—"}</p>
        </CardContent>
      </Card>
    </div>
  );
}

export default function VehicleFinancingFichasPage() {
  const { id } = useParams();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(true);
  const [fichas, setFichas] = useState<FinanciamentoFicha[]>([]);
  const [selected, setSelected] = useState<FinanciamentoFicha | null>(null);
  const [statusFilter, setStatusFilter] = useState<FinanciamentoFichaStatus | "all">("all");
  const [statusSaving, setStatusSaving] = useState(false);
  const autoOpenedRef = useRef<string | null>(null);

  useFinanciamentoPendingCount(true);

  const loadList = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("financiamento_fichas" as "veiculos_estoque")
      .select(`
        id, created_at, status, nome_completo, cpf_cnpj,
        whatsapp_from, veiculo_id, lgpd_aceite_em, prazo_meses, campos_pendentes,
        veiculos_estoque ( marca, modelo, versao, ano_modelo, preco )
      `)
      .order("created_at", { ascending: false })
      .limit(100);
    if (error) {
      console.error(error);
      setFichas([]);
    } else {
      setFichas((data ?? []) as unknown as FinanciamentoFicha[]);
    }
    setLoading(false);
  }, []);

  const loadOne = useCallback(async (fichaId: string) => {
    setLoading(true);
    const { data, error } = await supabase
      .from("financiamento_fichas" as "veiculos_estoque")
      .select(`
        *,
        veiculos_estoque ( marca, modelo, versao, ano_modelo, preco )
      `)
      .eq("id", fichaId)
      .maybeSingle();
    if (error || !data) {
      setSelected(null);
    } else {
      setSelected(data as unknown as FinanciamentoFicha);
    }
    setLoading(false);
  }, []);

  const updateFichaStatus = useCallback(async (
    fichaId: string,
    status: FinanciamentoFichaStatus,
  ) => {
    setStatusSaving(true);
    const { data, error } = await supabase
      .from("financiamento_fichas" as "veiculos_estoque")
      .update({ status })
      .eq("id", fichaId)
      .select(`
        *,
        veiculos_estoque ( marca, modelo, versao, ano_modelo, preco )
      `)
      .maybeSingle();
    setStatusSaving(false);
    if (error || !data) {
      console.error(error);
      return;
    }
    const next = data as unknown as FinanciamentoFicha;
    setSelected(next);
    setFichas((prev) => prev.map((f) => (f.id === fichaId ? { ...f, status: next.status } : f)));
    notifyFinanciamentoFichasChanged();
  }, []);

  useEffect(() => {
    if (id) {
      loadOne(id);
    } else {
      setSelected(null);
      autoOpenedRef.current = null;
      loadList();
    }
  }, [id, loadList, loadOne]);

  useEffect(() => {
    if (!selected || selected.status !== "pendente" || !id) return;
    if (autoOpenedRef.current === selected.id) return;
    autoOpenedRef.current = selected.id;
    void updateFichaStatus(selected.id, "em_analise");
  }, [selected, id, updateFichaStatus]);

  const filteredFichas = useMemo(() => {
    if (statusFilter === "all") return fichas;
    return fichas.filter((f) => f.status === statusFilter);
  }, [fichas, statusFilter]);

  const listBody = useMemo(() => {
    if (loading && !id) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (!filteredFichas.length) {
      return (
        <p className="text-muted-foreground py-8 text-center">
          Nenhuma ficha neste filtro.
        </p>
      );
    }
    return (
      <ul className="divide-y rounded-md border">
        {filteredFichas.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/50"
              onClick={() => navigate(`/veiculos/financiamento/${f.id}`)}
            >
              <div>
                <p className="font-medium flex items-center gap-2 flex-wrap">
                  {f.nome_completo ?? "Sem nome"}
                  {f.status === "pendente" && (
                    <Badge className="bg-red-600 hover:bg-red-600">Nova</Badge>
                  )}
                </p>
                <p className="text-sm text-muted-foreground">
                  {new Date(f.created_at).toLocaleString("pt-BR")} · {f.whatsapp_from}
                  {f.veiculos_estoque
                    ? ` · ${f.veiculos_estoque.marca} ${f.veiculos_estoque.modelo}`
                    : ""}
                </p>
              </div>
              <div className="flex flex-col items-end gap-1">
                <span className="text-xs text-muted-foreground">{statusLabel(f.status)}</span>
                {(f.campos_pendentes?.length ?? 0) > 0 && (
                  <Badge variant="outline" className="text-amber-800 border-amber-300">
                    {f.campos_pendentes!.length} pendente(s)
                  </Badge>
                )}
              </div>
            </button>
          </li>
        ))}
      </ul>
    );
  }, [filteredFichas, id, loading, navigate]);

  return (
    <div className="container max-w-4xl py-6 print:max-w-none print:py-0">
      <div className="mb-6 flex flex-wrap items-center gap-3 print:hidden">
        <Button variant="ghost" size="sm" asChild>
          <Link to="/veiculos">
            <ArrowLeft className="mr-2 h-4 w-4" />
            Estoque
          </Link>
        </Button>
        {id && (
          <Button variant="outline" size="sm" asChild>
            <Link to="/veiculos/financiamento">Ver lista</Link>
          </Button>
        )}
        {selected && (
          <Button
            variant="default"
            size="sm"
            className="ml-auto"
            onClick={() => window.print()}
          >
            <Printer className="mr-2 h-4 w-4" />
            Imprimir / PDF
          </Button>
        )}
      </div>

      {!id ? (
        <>
          <h1 className="text-2xl font-bold mb-2">Financiamentos</h1>
          <p className="text-muted-foreground mb-4 text-sm">
            Fichas enviadas pelos clientes na vitrine WhatsApp.
          </p>
          <div className="flex flex-wrap gap-2 mb-6">
            {FINANCIAMENTO_FICHA_STATUS_OPTIONS.map((opt) => (
              <Button
                key={opt.value}
                size="sm"
                variant={statusFilter === opt.value ? "default" : "outline"}
                onClick={() => setStatusFilter(opt.value)}
              >
                {opt.label}
              </Button>
            ))}
          </div>
          {listBody}
        </>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : selected ? (
        <FichaDetail
          ficha={selected}
          statusSaving={statusSaving}
          onStatusChange={(status) => void updateFichaStatus(selected.id, status)}
        />
      ) : (
        <p className="text-muted-foreground">Ficha não encontrada.</p>
      )}

      <style>{`
        @media print {
          body * { visibility: hidden; }
          #ficha-print-root, #ficha-print-root * { visibility: visible; }
          #ficha-print-root { position: absolute; left: 0; top: 0; width: 100%; }
        }
      `}</style>
    </div>
  );
}
