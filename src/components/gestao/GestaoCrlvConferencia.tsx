import { useMemo, useState } from "react";
import { AlertTriangle, Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { supabase } from "@/integrations/supabase/client";

type Confidence = "alta" | "media" | "baixa";
type Field<T = string | number | boolean | string[]> = {
  valor: T | null;
  confianca: Confidence;
};

export type CrlvLeituraView = {
  veiculo: Record<string, Field>;
  documento: Record<string, Field>;
  observacoes: {
    texto: Field<string>;
    alienacao_fiduciaria: Field<boolean>;
    financeira: Field<string>;
    restricoes: Field<string[]>;
  };
  proprietario: {
    primeiro_nome: string | null;
    cpf_cnpj_mascarado: string | null;
  };
  fonte: "pdf_texto" | "ocr";
  leitura_fraca: boolean;
};

const LABELS: Record<string, string> = {
  placa: "Placa",
  renavam: "RENAVAM",
  chassi: "Chassi",
  numero_motor: "Número do motor",
  marca_modelo_versao: "Marca / modelo / versão",
  marca: "Marca",
  modelo: "Modelo",
  versao: "Versão",
  ano_fabricacao: "Ano de fabricação",
  ano_modelo: "Ano modelo",
  cor: "Cor",
  combustivel: "Combustível",
  especie_tipo: "Espécie / tipo",
  categoria: "Categoria",
  carroceria: "Carroceria",
  potencia_cv: "Potência (cv)",
  cilindrada_cc: "Cilindrada (cc)",
  capacidade: "Capacidade",
  lotacao: "Lotação",
  pbt: "PBT",
  cmt: "CMT",
  numero_crv: "Número do CRV",
  codigo_seguranca_cla: "Código de segurança (CLA)",
  exercicio: "Exercício",
  data_emissao: "Data de emissão",
  municipio: "Município",
  uf: "UF",
};

const STOCK_FIELDS = new Set([
  "placa",
  "renavam",
  "chassi",
  "marca",
  "modelo",
  "versao",
  "ano_fabricacao",
  "ano_modelo",
  "cor",
  "combustivel",
  "cilindrada_cc",
]);

function splitVehicleName(value: unknown) {
  const parts = String(value ?? "").split(/\s*\/\s*/).filter(Boolean);
  if (parts.length >= 2) {
    return {
      marca: parts[0],
      modelo: parts[1],
      versao: parts.slice(2).join(" / "),
    };
  }
  const words = String(value ?? "").trim().split(/\s+/);
  return {
    marca: words.shift() ?? "",
    modelo: words.join(" "),
    versao: "",
  };
}

export function crlvValuesForStock(reading: CrlvLeituraView) {
  const name = splitVehicleName(reading.veiculo.marca_modelo_versao?.valor);
  return {
    placa: reading.veiculo.placa?.valor ?? "",
    renavam: reading.veiculo.renavam?.valor ?? "",
    chassi: reading.veiculo.chassi?.valor ?? "",
    marca: name.marca,
    modelo: name.modelo,
    versao: name.versao,
    ano_fabricacao: reading.veiculo.ano_fabricacao?.valor ?? "",
    ano_modelo: reading.veiculo.ano_modelo?.valor ?? "",
    cor: reading.veiculo.cor?.valor ?? "",
    combustivel: reading.veiculo.combustivel?.valor ?? "",
    cilindrada_cc: reading.veiculo.cilindrada_cc?.valor ?? "",
  };
}

export function GestaoCrlvConferencia({
  open,
  onOpenChange,
  documentoId,
  leitura,
  veiculoId,
  onConfirmed,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  documentoId: string;
  leitura: CrlvLeituraView;
  veiculoId?: string | null;
  onConfirmed?: (values: Record<string, string | number>) => void;
}) {
  const initial = useMemo(() => crlvValuesForStock(leitura), [leitura]);
  const [values, setValues] = useState<Record<string, string | number>>(
    initial,
  );
  const [replace, setReplace] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);
  const restrictions = leitura.observacoes.restricoes.valor ?? [];

  const confirm = async () => {
    setSaving(true);
    try {
      const { data, error } = await supabase.functions.invoke("gestao-cofre", {
        body: {
          action: "confirmar_crlv",
          documento_id: documentoId,
          veiculo_id: veiculoId,
          valores: values,
          substituir: [...replace],
        },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      onConfirmed?.(values);
      toast.success("Dados do CRLV confirmados.");
      onOpenChange(false);
    } catch {
      toast.error("Não foi possível confirmar os dados.");
    } finally {
      setSaving(false);
    }
  };

  const editableField = (key: string, label: string) => {
    const sourceField = leitura
      .veiculo[
        key === "marca" || key === "modelo" || key === "versao"
          ? "marca_modelo_versao"
          : key
      ];
    const low = sourceField?.confianca === "baixa";
    return (
      <div
        key={key}
        className={low ? "rounded-md bg-amber-50 p-2 dark:bg-amber-950/30" : ""}
      >
        <Label>{label}{low ? " · baixa confiança" : ""}</Label>
        <Input
          value={values[key] ?? ""}
          onChange={(event) =>
            setValues({ ...values, [key]: event.target.value })}
        />
        {veiculoId && (
          <label className="mt-1 flex items-center gap-2 text-xs text-muted-foreground">
            <input
              type="checkbox"
              checked={replace.has(key)}
              onChange={(event) => {
                const next = new Set(replace);
                if (event.target.checked) next.add(key);
                else next.delete(key);
                setReplace(next);
              }}
            />
            Substituir se já houver valor
          </label>
        )}
      </div>
    );
  };

  const readOnlyField = (key: string, field: Field) => (
    <div
      key={key}
      className={field.confianca === "baixa"
        ? "rounded-md bg-amber-50 p-2 dark:bg-amber-950/30"
        : ""}
    >
      <Label>
        {LABELS[key] ?? key}
        {field.confianca === "baixa" ? " · baixa confiança" : ""}
      </Label>
      <Input
        readOnly
        value={Array.isArray(field.valor)
          ? field.valor.join(", ")
          : String(field.valor ?? "")}
      />
    </div>
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Confira os dados</DialogTitle>
        </DialogHeader>

        {leitura.leitura_fraca && (
          <Alert className="border-amber-500 bg-amber-50 dark:bg-amber-950/30">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Leitura com baixa confiança</AlertTitle>
            <AlertDescription>
              Não consegui ler bem. Tire outra foto de cima, documento aberto,
              com boa luz. Você pode conferir e aproveitar os campos já
              encontrados.
            </AlertDescription>
          </Alert>
        )}

        {(leitura.observacoes.alienacao_fiduciaria.valor ||
          restrictions.length > 0) && (
          <Alert variant="destructive">
            <AlertTriangle className="h-4 w-4" />
            <AlertTitle>Atenção ao documento</AlertTitle>
            <AlertDescription>
              {leitura.observacoes.alienacao_fiduciaria.valor && (
                <p>
                  Alienação fiduciária
                  {leitura.observacoes.financeira.valor
                    ? `: ${leitura.observacoes.financeira.valor}`
                    : "."}
                </p>
              )}
              {restrictions.map((item) => <p key={item}>Restrição: {item}</p>)}
            </AlertDescription>
          </Alert>
        )}

        <div className="rounded-md border p-3 text-sm">
          Proprietário:{" "}
          {leitura.proprietario.primeiro_nome ?? "não identificado"}{" "}
          {leitura.proprietario.cpf_cnpj_mascarado
            ? `(${leitura.proprietario.cpf_cnpj_mascarado})`
            : ""}
        </div>

        <section className="space-y-3">
          <h3 className="font-semibold">Veículo</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {[...STOCK_FIELDS].map((key) =>
              editableField(key, LABELS[key] ?? key)
            )}
            {Object.entries(leitura.veiculo)
              .filter(([key]) =>
                !STOCK_FIELDS.has(key) && key !== "marca_modelo_versao"
              )
              .map(([key, field]) => readOnlyField(key, field))}
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="font-semibold">Documento</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            {Object.entries(leitura.documento).map(([key, field]) =>
              readOnlyField(key, field)
            )}
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="font-semibold">Observações</h3>
          <p className="rounded-md border p-3 text-sm">
            {leitura.observacoes.texto.valor || "Nenhuma observação legível."}
          </p>
        </section>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancelar
          </Button>
          <Button disabled={saving} onClick={() => void confirm()}>
            {saving && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            Confirmar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
