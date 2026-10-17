import { useEffect, useState } from "react";
import { Loader2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { supabase } from "@/integrations/supabase/client";

type CatalogOption = { codigo: number; nome: string };

async function fetchOptions(kind: string, extra?: Record<string, number>) {
  const { data, error } = await supabase.functions.invoke("webmotors-catalog-options", {
    body: { kind, ...extra },
  });
  if (error || !data?.success) throw new Error(data?.error ?? "Falha ao carregar catálogo.");
  return (data.options ?? []) as CatalogOption[];
}

export function WebmotorsDeparaDialog(props: {
  open: boolean;
  veiculoId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [busy, setBusy] = useState(false);
  const [marcas, setMarcas] = useState<CatalogOption[]>([]);
  const [modelos, setModelos] = useState<CatalogOption[]>([]);
  const [versoes, setVersoes] = useState<CatalogOption[]>([]);
  const [cores, setCores] = useState<CatalogOption[]>([]);
  const [modalidades, setModalidades] = useState<CatalogOption[]>([]);
  const [marca, setMarca] = useState<string>("");
  const [modelo, setModelo] = useState<string>("");
  const [versao, setVersao] = useState<string>("");
  const [cor, setCor] = useState<string>("");
  const [modalidade, setModalidade] = useState<string>("");

  useEffect(() => {
    if (!props.open) return;
    setBusy(true);
    Promise.all([fetchOptions("marcas"), fetchOptions("cores"), fetchOptions("modalidades")])
      .then(([m, c, mod]) => {
        setMarcas(m);
        setCores(c);
        setModalidades(mod);
      })
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setBusy(false));
  }, [props.open]);

  useEffect(() => {
    if (!marca) return;
    setBusy(true);
    fetchOptions("modelos", { codigo_marca: Number(marca) })
      .then(setModelos)
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setBusy(false));
  }, [marca]);

  useEffect(() => {
    if (!modelo) return;
    setBusy(true);
    fetchOptions("versoes", { codigo_modelo: Number(modelo) })
      .then(setVersoes)
      .catch((e) => toast.error((e as Error).message))
      .finally(() => setBusy(false));
  }, [modelo]);

  const save = async () => {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) return;
    setBusy(true);
    const { error } = await supabase.from("webmotors_veiculo_map").upsert({
      user_id: user.id,
      veiculo_id: props.veiculoId,
      codigo_marca: marca ? Number(marca) : null,
      codigo_modelo: modelo ? Number(modelo) : null,
      codigo_versao: versao ? Number(versao) : null,
      codigo_cor: cor ? Number(cor) : null,
      codigo_modalidade: modalidade ? Number(modalidade) : null,
      mapping_source: "manual",
      updated_at: new Date().toISOString(),
    }, { onConflict: "user_id,veiculo_id" });
    setBusy(false);
    if (error) {
      toast.error("Não foi possível salvar o de/para.");
      return;
    }
    toast.success("De/para Webmotors salvo.");
    props.onSaved();
    props.onClose();
  };

  return (
    <Dialog open={props.open} onOpenChange={(o) => !o && props.onClose()}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>De/para Webmotors</DialogTitle>
          <DialogDescription>
            Escolha os códigos do catálogo quando o casamento automático falhar.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-3 py-2">
          <Field label="Marca" value={marca} onChange={setMarca} options={marcas} disabled={busy} />
          <Field label="Modelo" value={modelo} onChange={setModelo} options={modelos} disabled={busy || !marca} />
          <Field label="Versão" value={versao} onChange={setVersao} options={versoes} disabled={busy || !modelo} />
          <Field label="Cor" value={cor} onChange={setCor} options={cores} disabled={busy} />
          <Field label="Modalidade" value={modalidade} onChange={setModalidade} options={modalidades} disabled={busy} />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={props.onClose} disabled={busy}>
            Cancelar
          </Button>
          <Button onClick={() => void save()} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : "Salvar"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function Field(props: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  options: CatalogOption[];
  disabled?: boolean;
}) {
  return (
    <div className="grid gap-1.5">
      <Label>{props.label}</Label>
      <Select value={props.value} onValueChange={props.onChange} disabled={props.disabled}>
        <SelectTrigger>
          <SelectValue placeholder="Selecione…" />
        </SelectTrigger>
        <SelectContent>
          {props.options.map((o) => (
            <SelectItem key={o.codigo} value={String(o.codigo)}>
              {o.nome}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
