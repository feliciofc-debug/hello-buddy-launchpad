import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, CheckCircle2, Loader2, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
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
  type MolicarProcedenciaController,
  type MolicarProcedenciaServico,
  useMolicarProcedencia,
} from "@/components/gestao/useMolicarProcedencia";
import { molicarProcedenciaResult } from "@/lib/molicar-procedencia";

const labels: Record<MolicarProcedenciaServico, string> = {
  debts: "Débitos e restrições",
  gravame: "Gravame",
  renajud: "Renajud",
};
const money = (n: number) =>
  n.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const record = (value: unknown): Record<string, unknown> =>
  value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown>
    : {};
const resultBody = (value: Record<string, unknown> | null) => {
  return molicarProcedenciaResult(value);
};
const list = (value: unknown): Record<string, unknown>[] =>
  Array.isArray(value) ? value.map(record) : [];
const warning = (value: unknown): boolean => {
  if (Array.isArray(value)) return value.some(warning);
  if (!value || typeof value !== "object") {
    if (typeof value !== "string") return false;
    if (/(sem|não (?:há|consta)|not found|no record)/i.test(value)) return false;
    return /(gravame|roubo|furto|robbery|theft|sinistro|insurance.?claim|leil[aã]o|auction|renajud)/i
      .test(value);
  }
  return Object.entries(value as Record<string, unknown>).some(
    ([key, child]) => {
      const flagged =
        /(hasgravame|robberyorftheft|insuranceclaim|auction|leilao|renajud)/i
          .test(key.replace(/[_\s-]/g, ""));
      if (
        flagged &&
        (child === true || (typeof child === "number" && child > 0) ||
          (typeof child === "string" &&
            !/^(false|0|não|nao|sem|null)?$/i.test(child.trim())))
      ) return true;
      return warning(child);
    },
  );
};

function ProcedenciaResult({
  servico,
  resultado,
}: {
  servico: MolicarProcedenciaServico;
  resultado: Record<string, unknown>;
}) {
  const result = resultBody(resultado);
  if (servico === "debts") {
    const debts = record(result.Debts ?? result.debts);
    const summary = record(debts.Summary ?? debts.summary);
    const restrictions = record(result.Restrictions ?? result.restrictions);
    const amounts = [
      ["Licenciamento", Number(summary.Licensing ?? summary.licensing ?? 0)],
      ["IPVA", Number(summary.Ipva ?? summary.ipva ?? 0)],
      ["Multas", Number(summary.Fines ?? summary.fines ?? 0)],
    ] as const;
    const flags = Object.entries(restrictions)
      .filter(([, value]) =>
        value === true ||
        (typeof value === "string" && value.trim() &&
          !/^(?:false|não|nao|sem|0)$/i.test(value))
      )
      .map(([key]) => key.replace(/([a-z])([A-Z])/g, "$1 $2"));
    return (
      <div className="mt-2 space-y-1 text-xs">
        {amounts.map(([label, value]) => (
          <p key={label}>
            {label}: {money(Number.isFinite(value) ? value : 0)}
          </p>
        ))}
        {flags.length > 0 && (
          <p className="font-semibold">Restrições: {flags.join(" · ")}</p>
        )}
      </div>
    );
  }
  if (servico === "gravame") {
    const items = list(result.Gravame ?? result.gravame);
    return (
      <div className="mt-2 space-y-1 text-xs">
        <p>
          {items.length
            ? `⚠️ ${items.length} gravame(s) encontrado(s)`
            : "✅ Sem gravame retornado"}
        </p>
        {items.slice(0, 3).map((item, index) => (
          <p key={index}>
            {[item.AgentName, item.Status, item.ContractDate].filter(Boolean)
              .join(" · ")}
          </p>
        ))}
      </div>
    );
  }
  const items = list(result.Renajud ?? result.renajud);
  return (
    <div className="mt-2 space-y-1 text-xs">
      <p>
        {items.length
          ? `⚠️ ${items.length} restrição(ões) Renajud`
          : "✅ Sem Renajud retornado"}
      </p>
      {items.slice(0, 3).map((item, index) => (
        <p key={index}>
          {[item.Restriction, item.Court, item.ProcessDate].filter(Boolean)
            .join(" · ")}
        </p>
      ))}
    </div>
  );
}

type Props = {
  placa?: string | null;
  vin?: string | null;
  veiculoId?: string | null;
  trocaId?: string | null;
  c2b?: number | null;
  enabled?: boolean;
  automatic?: boolean;
  controller?: MolicarProcedenciaController;
};

export function MolicarProcedenciaCard(props: Props) {
  const own = useMolicarProcedencia({
    ...props,
    enabled: props.controller ? false : props.enabled,
  });
  const model = props.controller ?? own;
  const [selected, setSelected] = useState<MolicarProcedenciaServico[]>(
    props.placa ? ["debts", "gravame", "renajud"] : ["debts", "gravame"],
  );
  const [confirm, setConfirm] = useState(false);
  const automaticAttempt = useRef("");
  const identity = `${props.trocaId ?? ""}:${props.veiculoId ?? ""}:${
    props.placa ?? ""
  }`;
  useEffect(() => {
    if (
      !props.automatic || !model.initialized || model.loading ||
      model.consulting || model.rows.length ||
      automaticAttempt.current === identity
    ) return;
    automaticAttempt.current = identity;
    void model.consultar(
      props.placa ? ["debts", "gravame", "renajud"] : ["debts", "gravame"],
      true,
    );
  }, [identity, model, props.automatic, props.placa]);

  const latest = useMemo(() =>
    Object.values(model.rows.reduce(
      (acc, row) => {
        if (!acc[row.servico]) acc[row.servico] = row;
        return acc;
      },
      {} as Partial<
        Record<MolicarProcedenciaServico, typeof model.rows[number]>
      >,
    )), [model]);

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base">Procedência (Molicar)</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <div className="flex flex-wrap gap-4">
          {(Object.keys(labels) as MolicarProcedenciaServico[]).map((
            service,
          ) => (
            <label key={service} className="flex items-center gap-2 text-sm">
              <Checkbox
                checked={selected.includes(service)}
                disabled={service === "renajud" && !props.placa}
                onCheckedChange={(checked) =>
                  setSelected((current) =>
                    checked
                      ? [...new Set([...current, service])]
                      : current.filter((v) => v !== service)
                  )}
              />
              {labels[service]}
            </label>
          ))}
        </div>
        <Button
          type="button"
          size="sm"
          variant="outline"
          disabled={!selected.length || model.consulting ||
            (!props.placa && !props.vin)}
          onClick={() => setConfirm(true)}
        >
          {model.consulting
            ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            : <Search className="mr-2 h-4 w-4" />}
          Consultar procedência
        </Button>
        {(model.pending || model.consulting) && (
          <p className="flex items-center gap-2 text-sm text-muted-foreground">
            <Loader2 className="h-4 w-4 animate-spin" />{" "}
            Consultando… atualiza sozinho
          </p>
        )}
        {latest.map((row) => {
          const isError = [
            "error",
            "erro",
            "failed",
            "falha",
            "expired",
            "expirada",
          ].includes(row.status);
          const isPending = ["pending", "processing", "pendente", "processando"]
            .includes(row.status);
          const hasWarning = warning(row.resultado);
          return (
            <div
              key={row.servico}
              className={`rounded-md border p-3 text-sm ${
                hasWarning ? "border-amber-400 bg-amber-50 text-amber-950" : ""
              }`}
            >
              <p className="flex items-center gap-2 font-medium">
                {isPending
                  ? <Loader2 className="h-4 w-4 animate-spin" />
                  : isError || hasWarning
                  ? <AlertTriangle className="h-4 w-4" />
                  : <CheckCircle2 className="h-4 w-4 text-emerald-600" />}
                {labels[row.servico]}
              </p>
              {isError
                ? <p>{row.erro ?? "Não foi possível concluir a consulta."}</p>
                : isPending
                ? <p className="mt-1 text-xs">Consultando…</p>
                : row.resultado &&
                  (
                    <ProcedenciaResult
                      servico={row.servico}
                      resultado={row.resultado}
                    />
                  )}
            </div>
          );
        })}
        {model.debtTotal != null && (
          <p className="text-sm font-semibold">
            Total de débitos: {money(model.debtTotal)}
          </p>
        )}
        {props.c2b != null && model.debtTotal != null && (
          <p className="rounded-md bg-muted p-3 text-sm font-semibold">
            Valor de troca sugerido = C2B − débitos:{" "}
            {money(props.c2b - model.debtTotal)}
          </p>
        )}
        {model.error && (
          <p className="text-sm text-destructive">{model.error}</p>
        )}
      </CardContent>
      <AlertDialog open={confirm} onOpenChange={setConfirm}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Confirmar consulta Molicar?</AlertDialogTitle>
            <AlertDialogDescription>
              Esta ação consome {selected.length} consultas do seu plano.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={() => void model.consultar(selected)}>
              Confirmar
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
