import { useEffect, useState } from "react";
import { useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import type { GestaoContadorPacote } from "../../supabase/functions/_shared/gestao-contador-pacote-build.ts";
import { GESTAO_CONTADOR_AVISO } from "../../supabase/functions/_shared/gestao-contador-token.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import { downloadContadorPdf, downloadContadorXlsx } from "@/lib/gestao-contador-export.ts";

export default function GestaoContadorPublicPage() {
  const { token } = useParams<{ token: string }>();
  const [pacote, setPacote] = useState<GestaoContadorPacote | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!token) return;
    void (async () => {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/gestao-contador-pacote?token=${encodeURIComponent(token)}`;
      const res = await fetch(url);
      if (!res.ok) {
        setError("Link inválido ou expirado.");
        return;
      }
      setPacote(await res.json() as GestaoContadorPacote);
    })();
  }, [token]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6 text-center text-muted-foreground">
        {error}
      </div>
    );
  }

  if (!pacote) {
    return <div className="flex min-h-screen items-center justify-center"><div className="animate-pulse">Carregando…</div></div>;
  }

  return (
    <div className="mx-auto max-w-2xl space-y-6 p-6">
      <header>
        <h1 className="text-2xl font-bold">{pacote.nomeEmpresa}</h1>
        <p className="text-muted-foreground">Pacote contador — {pacote.competencia}</p>
      </header>
      <div className="rounded-lg border p-4 text-sm space-y-1">
        <p>Lucro líquido da loja: <strong>{formatGestaoMoney(pacote.dre.lucroLiquidoLoja)}</strong></p>
        <p>Faturamento: {formatGestaoMoney(pacote.dre.faturamento)}</p>
        <p>Lucro dos carros: {formatGestaoMoney(pacote.dre.lucroCarros)}</p>
        <p>Despesas operacionais: {formatGestaoMoney(pacote.dre.despesasOperacionais)}</p>
      </div>
      {(pacote.notasFiscais?.length ?? 0) > 0 && (
        <div className="rounded-lg border p-4 text-sm space-y-2">
          <p className="font-medium">Notas fiscais do mês (links XML na Focus)</p>
          <ul className="list-disc space-y-1 pl-5">
            {pacote.notasFiscais.map((n) => (
              <li key={n.id}>
                {n.tipo_operacao} — {n.status}
                {n.numero != null ? ` nº ${n.numero}` : ""}
                {n.xml_url ? (
                  <> · <a className="text-primary underline" href={n.xml_url} target="_blank" rel="noopener noreferrer">XML</a></>
                ) : null}
              </li>
            ))}
          </ul>
        </div>
      )}
      <p className="text-xs text-muted-foreground">{GESTAO_CONTADOR_AVISO}</p>
      <div className="flex flex-wrap gap-2">
        <Button onClick={() => downloadContadorXlsx(pacote, `contador-${pacote.competencia}.xlsx`)}>Baixar XLSX</Button>
        <Button variant="outline" onClick={() => downloadContadorPdf(pacote, `contador-${pacote.competencia}.pdf`)}>Baixar PDF</Button>
      </div>
    </div>
  );
}
