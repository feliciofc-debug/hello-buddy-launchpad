import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import type { GestaoNfeOperacaoKey } from "../../../../supabase/functions/_shared/gestao-nfe-config-default.ts";
import type { GestaoVeiculoEnriched } from "@/lib/gestao-lucro-types.ts";
import { supabase } from "@/integrations/supabase/client";

type Tomador = {
  nome: string;
  cpf_cnpj: string;
  logradouro: string;
  numero: string;
  bairro: string;
  municipio: string;
  uf: string;
  cep: string;
  email?: string;
};

type Props = {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  veiculo: GestaoVeiculoEnriched;
  onSuccess?: () => void;
};

export function GestaoEmitirNfeDialog({ open, onOpenChange, veiculo, onSuccess }: Props) {
  const [step, setStep] = useState<"form" | "preview">("form");
  const [busy, setBusy] = useState(false);
  const [tipo, setTipo] = useState<GestaoNfeOperacaoKey>("saida_venda");
  const [valor, setValor] = useState("");
  const [tomador, setTomador] = useState<Tomador>({
    nome: "",
    cpf_cnpj: "",
    logradouro: "",
    numero: "S/N",
    bairro: "",
    municipio: "",
    uf: "",
    cep: "",
  });
  const [resumo, setResumo] = useState("");

  useEffect(() => {
    if (!open) return;
    setStep("form");
    setTipo(veiculo.valorVenda != null ? "saida_venda" : "entrada_compra_pf");
    setValor(String(veiculo.valorVenda ?? veiculo.valorCompra ?? ""));
  }, [open, veiculo]);

  const loadPreview = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-nfe-preview", {
      body: {
        veiculo_id: veiculo.id,
        tipo_operacao: tipo,
        valor_total: valor ? Number(valor.replace(",", ".")) : undefined,
        tomador,
      },
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Pré-visualização falhou.");
      return;
    }
    if (data.missing_fields?.length) {
      toast.error(`Complete: ${data.missing_fields.join(", ")}`);
      return;
    }
    setResumo(String(data.resumo ?? ""));
    setStep("preview");
  };

  const emitir = async () => {
    setBusy(true);
    const { data, error } = await supabase.functions.invoke("gestao-nfe-emit", {
      body: {
        veiculo_id: veiculo.id,
        tipo_operacao: tipo,
        valor_total: valor ? Number(valor.replace(",", ".")) : undefined,
        tomador,
        confirm: true,
      },
    });
    setBusy(false);
    if (error || !data?.success) {
      toast.error(data?.error ?? "Emissão falhou.");
      return;
    }
    toast.success(`NF-e enviada (${data.status}).`);
    onOpenChange(false);
    onSuccess?.();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-lg">
        <DialogHeader>
          <DialogTitle>Emitir nota fiscal</DialogTitle>
        </DialogHeader>

        {step === "form" ? (
          <div className="space-y-3 text-sm">
            <p className="text-muted-foreground">
              {veiculo.marca} {veiculo.modelo} {veiculo.placa ? `· ${veiculo.placa}` : ""}
            </p>
            <div>
              <Label>Tipo</Label>
              <Select value={tipo} onValueChange={(v) => setTipo(v as GestaoNfeOperacaoKey)}>
                <SelectTrigger><SelectValue /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="saida_venda">Saída (venda)</SelectItem>
                  <SelectItem value="entrada_compra_pf">Entrada (compra PF)</SelectItem>
                  <SelectItem value="consignacao">Consignação</SelectItem>
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Valor da nota</Label>
              <Input value={valor} onChange={(e) => setValor(e.target.value)} />
            </div>
            <div><Label>Nome</Label><Input value={tomador.nome} onChange={(e) => setTomador({ ...tomador, nome: e.target.value })} /></div>
            <div><Label>CPF/CNPJ</Label><Input value={tomador.cpf_cnpj} onChange={(e) => setTomador({ ...tomador, cpf_cnpj: e.target.value })} /></div>
            <div><Label>Logradouro</Label><Input value={tomador.logradouro} onChange={(e) => setTomador({ ...tomador, logradouro: e.target.value })} /></div>
            <div className="grid grid-cols-2 gap-2">
              <div><Label>Número</Label><Input value={tomador.numero} onChange={(e) => setTomador({ ...tomador, numero: e.target.value })} /></div>
              <div><Label>CEP</Label><Input value={tomador.cep} onChange={(e) => setTomador({ ...tomador, cep: e.target.value })} /></div>
            </div>
            <div><Label>Bairro</Label><Input value={tomador.bairro} onChange={(e) => setTomador({ ...tomador, bairro: e.target.value })} /></div>
            <div className="grid grid-cols-3 gap-2">
              <div className="col-span-2"><Label>Município</Label><Input value={tomador.municipio} onChange={(e) => setTomador({ ...tomador, municipio: e.target.value })} /></div>
              <div><Label>UF</Label><Input maxLength={2} value={tomador.uf} onChange={(e) => setTomador({ ...tomador, uf: e.target.value.toUpperCase() })} /></div>
            </div>
          </div>
        ) : (
          <pre className="whitespace-pre-wrap rounded-md bg-muted p-3 text-xs">{resumo}</pre>
        )}

        <DialogFooter>
          {step === "form" ? (
            <Button disabled={busy} onClick={() => void loadPreview()}>
              {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Pré-visualizar"}
            </Button>
          ) : (
            <>
              <Button variant="outline" onClick={() => setStep("form")}>Voltar</Button>
              <Button disabled={busy} onClick={() => void emitir()}>Emitir NF-e</Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
