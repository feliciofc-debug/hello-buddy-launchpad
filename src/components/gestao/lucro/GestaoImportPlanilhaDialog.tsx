import { useMemo, useState } from "react";
import * as XLSX from "xlsx";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { matchGestaoImportRow } from "../../../../supabase/functions/_shared/gestao-import-match.ts";
import { parseGestaoMoneyBr, parseGestaoMoneyField } from "@/lib/gestao-money.ts";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { supabase } from "@/integrations/supabase/client";

type ImportKind = "compra" | "despesa";

type PreviewRow = {
  line: number;
  placa?: string;
  codigo?: string;
  marca?: string;
  modelo?: string;
  ano?: number;
  valor?: number;
  data?: string;
  categoria?: string;
  error?: string;
  veiculoId?: string;
  replaceCompraWarn?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  userId: string;
  veiculos: GestaoVeiculoEnriched[];
  onSaved: () => void;
};

function downloadTemplate(kind: ImportKind) {
  const header = kind === "compra"
    ? "placa;codigo;marca;modelo;ano;valor_compra;data_compra\n"
    : "placa;codigo;marca;modelo;ano;valor;data;categoria;descricao\n";
  const example = kind === "compra"
    ? "ABC1D23;C001;Fiat;Argo;2022;65000;2026-01-15\n"
    : "ABC1D23;;Fiat;Argo;2022;850;mecanica;Revisão\n";
  const blob = new Blob([header + example], { type: "text/csv;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = kind === "compra" ? "modelo-custos-compra.csv" : "modelo-despesas.csv";
  a.click();
  URL.revokeObjectURL(url);
}

function parseRows(sheet: XLSX.WorkSheet): Record<string, unknown>[] {
  return XLSX.utils.sheet_to_json(sheet, { defval: "" }) as Record<string, unknown>[];
}

function pick(row: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = row[k] ?? row[k.toUpperCase()];
    if (v != null && String(v).trim()) return String(v).trim();
  }
  return "";
}

function pickRaw(row: Record<string, unknown>, keys: string[]): unknown {
  for (const k of keys) {
    const v = row[k] ?? row[k.toUpperCase()];
    if (v != null && v !== "") return v;
  }
  return "";
}

export function GestaoImportPlanilhaDialog({
  open,
  onOpenChange,
  userId,
  veiculos,
  onSaved,
}: Props) {
  const [kind, setKind] = useState<ImportKind>("compra");
  const [preview, setPreview] = useState<PreviewRow[]>([]);
  const [busy, setBusy] = useState(false);
  const [importReport, setImportReport] = useState<{
    ok: number;
    failed: Array<{ line: number; message: string }>;
  } | null>(null);

  const veiculoById = useMemo(() => new Map(veiculos.map((v) => [v.id, v])), [veiculos]);

  const refs = useMemo(
    () => veiculos.map((v) => ({
      id: v.id,
      placa: v.placa,
      codigo_origem: v.codigo_origem,
      marca: v.marca,
      modelo: v.modelo,
      ano_modelo: v.ano_modelo,
      ano_fabricacao: v.ano_fabricacao,
    })),
    [veiculos],
  );

  const onFile = async (file: File) => {
    setImportReport(null);
    const buf = await file.arrayBuffer();
    const wb = XLSX.read(buf, { type: "array" });
    const sheet = wb.Sheets[wb.SheetNames[0]];
    const rows = parseRows(sheet);
    const out: PreviewRow[] = [];

    rows.forEach((row, i) => {
      const line = i + 2;
      const placa = pick(row, ["placa", "Placa"]);
      const codigo = pick(row, ["codigo", "codigo_origem", "Código"]);
      const marca = pick(row, ["marca", "Marca"]);
      const modelo = pick(row, ["modelo", "Modelo"]);
      const anoRaw = pick(row, ["ano", "ano_modelo", "Ano"]);
      const ano = anoRaw ? Number(anoRaw) : undefined;

      const match = matchGestaoImportRow(
        { placa, codigo, marca, modelo, ano: Number.isFinite(ano) ? ano : null },
        refs,
      );

      const pr: PreviewRow = { line, placa, codigo, marca, modelo, ano, veiculoId: match?.id };

      if (!match) {
        pr.error = "Veículo não encontrado (placa > código > marca+modelo+ano)";
        out.push(pr);
        return;
      }

      if (kind === "compra") {
        const rawVal = pickRaw(row, ["valor_compra", "valor", "Valor"]);
        const valor = typeof rawVal === "number"
          ? parseGestaoMoneyBr(rawVal)
          : parseGestaoMoneyField(String(rawVal));
        const data = pick(row, ["data_compra", "data", "Data"]) || new Date().toISOString().slice(0, 10);
        if (valor == null) {
          pr.error = "valor_compra inválido";
        } else {
          pr.valor = valor;
          pr.data = data;
          const existing = veiculoById.get(match.id);
          if (existing?.valorCompra != null) {
            pr.replaceCompraWarn =
              `Já tem compra ${formatGestaoMoney(existing.valorCompra)} — será substituída`;
          }
        }
      } else {
        const rawVal = pickRaw(row, ["valor", "Valor"]);
        const valor = typeof rawVal === "number"
          ? parseGestaoMoneyBr(rawVal)
          : parseGestaoMoneyField(String(rawVal));
        const data = pick(row, ["data", "Data"]) || new Date().toISOString().slice(0, 10);
        const categoria = pick(row, ["categoria", "Categoria"]) || "outros";
        if (valor == null) {
          pr.error = "valor inválido";
        } else {
          pr.valor = valor;
          pr.data = data;
          pr.categoria = categoria;
        }
      }
      out.push(pr);
    });

    setPreview(out);
  };

  const okRows = preview.filter((r) => !r.error && r.veiculoId);

  const apply = async () => {
    if (!okRows.length) {
      toast.error("Nenhuma linha válida.");
      return;
    }
    setBusy(true);
    const failed: Array<{ line: number; message: string }> = [];
    let ok = 0;

    for (const r of okRows) {
      if (kind === "compra") {
        const { error } = await supabase.from("veiculo_compra" as "veiculos_estoque").upsert({
          user_id: userId,
          veiculo_id: r.veiculoId!,
          valor_compra: r.valor!,
          data_compra: r.data!,
          origem: "compra",
        }, { onConflict: "user_id,veiculo_id" });
        if (error) failed.push({ line: r.line, message: error.message });
        else ok += 1;
      } else {
        const { error } = await supabase.from("veiculo_despesas" as "veiculos_estoque").insert({
          user_id: userId,
          veiculo_id: r.veiculoId!,
          valor: r.valor!,
          data: r.data!,
          categoria: r.categoria ?? "outros",
          origem_lancamento: "painel",
          lancado_por: "importacao",
        });
        if (error) failed.push({ line: r.line, message: error.message });
        else ok += 1;
      }
    }

    setBusy(false);
    setImportReport({ ok, failed });

    if (ok > 0) {
      onSaved();
    }

    if (failed.length === 0 && ok > 0) {
      toast.success(`${ok} linha(s) importada(s).`);
      setPreview([]);
      onOpenChange(false);
    } else if (ok === 0) {
      toast.error(`Nenhuma linha importada. ${failed.length} erro(s).`);
    } else {
      toast.warning(`${ok} importada(s), ${failed.length} com erro.`);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle>Importar planilha</DialogTitle>
        </DialogHeader>
        <div className="grid gap-3">
          <div>
            <Label>Tipo</Label>
            <Select value={kind} onValueChange={(v) => { setKind(v as ImportKind); setPreview([]); setImportReport(null); }}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                <SelectItem value="compra">Custos de compra</SelectItem>
                <SelectItem value="despesa">Despesas</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => downloadTemplate("compra")}>
              Baixar modelo compra
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => downloadTemplate("despesa")}>
              Baixar modelo despesas
            </Button>
          </div>
          <input
            type="file"
            accept=".csv,.xlsx,.xls"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) void onFile(f);
            }}
          />
          {preview.length > 0 && (
            <>
              <p className="text-sm text-muted-foreground">
                {okRows.length} válida(s), {preview.length - okRows.length} com erro na pré-visualização
              </p>
              <div className="max-h-48 overflow-auto rounded border text-xs">
                <table className="w-full">
                  <thead>
                    <tr className="border-b bg-muted/50">
                      <th className="p-1 text-left">Linha</th>
                      <th className="p-1 text-left">Veículo</th>
                      <th className="p-1 text-left">Valor</th>
                      <th className="p-1 text-left">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {preview.map((r) => (
                      <tr key={r.line} className="border-b">
                        <td className="p-1">{r.line}</td>
                        <td className="p-1">{r.placa || r.marca || "—"}</td>
                        <td className="p-1">{r.valor != null ? formatGestaoMoney(r.valor) : "—"}</td>
                        <td className="p-1">
                          {r.error ? (
                            <span className="text-red-600">{r.error}</span>
                          ) : r.replaceCompraWarn ? (
                            <span className="text-amber-700">{r.replaceCompraWarn}</span>
                          ) : (
                            <span className="text-muted-foreground">OK</span>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
              <Button disabled={busy || !okRows.length} onClick={() => void apply()}>
                Importar {okRows.length} linha(s)
              </Button>
            </>
          )}
          {importReport && importReport.failed.length > 0 && (
            <div className="rounded-md border border-red-500/40 bg-red-500/5 p-3 text-sm">
              <p className="font-medium">
                {importReport.ok} importada(s), {importReport.failed.length} com erro
              </p>
              <ul className="mt-2 list-inside list-disc text-red-700">
                {importReport.failed.map((f) => (
                  <li key={f.line}>Linha {f.line}: {f.message}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
