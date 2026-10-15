import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, Loader2, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/integrations/supabase/client";
import { maskCnpjForDisplay, maskCpfForDisplay } from "@/lib/brazil-doc-mask";

type FinanciamentoFicha = {
  id: string;
  created_at: string;
  status: string;
  nome_completo: string;
  tipo_pessoa: string;
  cpf_cnpj: string;
  whatsapp_from: string;
  veiculo_id: string | null;
  lgpd_aceite_em: string;
  data_nascimento: string | null;
  email: string;
  cep: string;
  logradouro: string;
  numero: string;
  complemento: string | null;
  bairro: string;
  cidade: string;
  uf: string;
  renda_mensal: number;
  telefone_referencia: string;
  entrada: number | null;
  prazo_meses: number;
  veiculos_estoque?: {
    marca: string;
    modelo: string;
    versao: string | null;
    ano_modelo: number | null;
    preco: number | null;
  } | null;
};

function maskDoc(tipo: string, doc: string): string {
  return tipo === "pj" ? maskCnpjForDisplay(doc) : maskCpfForDisplay(doc);
}

function formatMoney(value: number | null | undefined): string {
  if (value == null) return "—";
  return value.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

function FichaDetail({ ficha }: { ficha: FinanciamentoFicha }) {
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
          <CardTitle>{ficha.nome_completo}</CardTitle>
          <p className="text-sm text-muted-foreground">
            Status: {ficha.status} · LGPD:{" "}
            {new Date(ficha.lgpd_aceite_em).toLocaleString("pt-BR")}
          </p>
        </CardHeader>
        <CardContent className="grid gap-3 text-sm md:grid-cols-2">
          <p><span className="font-medium">Veículo:</span> {vehicleLabel}</p>
          <p><span className="font-medium">WhatsApp:</span> {ficha.whatsapp_from}</p>
          <p><span className="font-medium">Tipo:</span> {ficha.tipo_pessoa === "pj" ? "PJ" : "PF"}</p>
          <p><span className="font-medium">Documento:</span> {maskDoc(ficha.tipo_pessoa, ficha.cpf_cnpj)}</p>
          <p><span className="font-medium">Nascimento:</span> {ficha.data_nascimento ?? "—"}</p>
          <p><span className="font-medium">E-mail:</span> {ficha.email}</p>
          <p className="md:col-span-2">
            <span className="font-medium">Endereço:</span>{" "}
            {ficha.logradouro}, {ficha.numero}
            {ficha.complemento ? ` — ${ficha.complemento}` : ""} · {ficha.bairro} ·{" "}
            {ficha.cidade}/{ficha.uf} · CEP {ficha.cep}
          </p>
          <p><span className="font-medium">Renda:</span> {formatMoney(ficha.renda_mensal)}</p>
          <p><span className="font-medium">Referência:</span> {ficha.telefone_referencia}</p>
          <p><span className="font-medium">Entrada:</span> {formatMoney(ficha.entrada)}</p>
          <p><span className="font-medium">Prazo:</span> {ficha.prazo_meses} meses</p>
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

  const loadList = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from("financiamento_fichas" as "veiculos_estoque")
      .select(`
        id, created_at, status, nome_completo, tipo_pessoa, cpf_cnpj,
        whatsapp_from, veiculo_id, lgpd_aceite_em, prazo_meses,
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

  useEffect(() => {
    if (id) {
      loadOne(id);
    } else {
      setSelected(null);
      loadList();
    }
  }, [id, loadList, loadOne]);

  const listBody = useMemo(() => {
    if (loading && !id) {
      return (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      );
    }
    if (!fichas.length) {
      return (
        <p className="text-muted-foreground py-8 text-center">
          Nenhuma ficha de financiamento ainda.
        </p>
      );
    }
    return (
      <ul className="divide-y rounded-md border">
        {fichas.map((f) => (
          <li key={f.id}>
            <button
              type="button"
              className="flex w-full items-center justify-between gap-4 px-4 py-3 text-left hover:bg-muted/50"
              onClick={() => navigate(`/veiculos/financiamento/${f.id}`)}
            >
              <div>
                <p className="font-medium">{f.nome_completo}</p>
                <p className="text-sm text-muted-foreground">
                  {new Date(f.created_at).toLocaleString("pt-BR")} · {f.whatsapp_from}
                </p>
              </div>
              <span className="text-xs uppercase text-muted-foreground">{f.status}</span>
            </button>
          </li>
        ))}
      </ul>
    );
  }, [fichas, id, loading, navigate]);

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
          <h1 className="text-2xl font-bold mb-2">Financiamento</h1>
          <p className="text-muted-foreground mb-6 text-sm">
            Fichas enviadas pelos clientes na vitrine WhatsApp.
          </p>
          {listBody}
        </>
      ) : loading ? (
        <div className="flex justify-center py-12">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : selected ? (
        <FichaDetail ficha={selected} />
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
