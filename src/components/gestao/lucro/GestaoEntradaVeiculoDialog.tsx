import { useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FileText, Loader2, Trash2 } from "lucide-react";
import { toast } from "sonner";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { GestaoMoneyInput } from "@/components/gestao/lucro/GestaoMoneyInput.tsx";
import { ConsignacaoTermosFields } from "@/components/gestao/ConsignacaoTermosFields.tsx";
import {
  type ConsignacaoFormValue,
  emptyConsignacaoForm,
  saveConsignacaoTermos,
} from "@/lib/consignacao-form.ts";
import { GESTAO_DESPESA_CATEGORIAS } from "@/lib/gestao-lucro-categories.ts";
import { parseGestaoMoneyField } from "@/lib/gestao-money.ts";
import { hojeSaoPaulo } from "../../../../supabase/functions/_shared/gestao-date-br.ts";
import { statusInicialEntradaVeiculo } from "../../../../supabase/functions/_shared/veiculo-estoque-status.ts";
import { supabase } from "@/integrations/supabase/client";
import {
  type CrlvLeituraView,
  crlvValuesForStock,
  GestaoCrlvConferencia,
} from "@/components/gestao/GestaoCrlvConferencia.tsx";

type Origem = "compra" | "troca" | "consignacao";
type Despesa = {
  id: string;
  valor: string;
  data: string;
  categoria: string;
  descricao: string;
  descontar: boolean;
};

type Props = {
  open: boolean;
  userId: string;
  onOpenChange: (open: boolean) => void;
  onSaved: () => void;
};

const initialVehicle = () => ({
  segmento: "carro",
  marca: "",
  modelo: "",
  versao: "",
  anoFabricacao: "",
  anoModelo: "",
  km: "",
  cor: "",
  combustivel: "",
  cambio: "",
  portas: "",
  placa: "",
  renavam: "",
  chassi: "",
  cilindradaCc: "",
  preco: "",
  descricao: "",
  fotos: "",
});

const optionalNumber = (value: string): number | null => {
  if (!value.trim()) return null;
  const n = Number(value.replace(",", "."));
  return Number.isFinite(n) ? n : null;
};

const photoList = (value: string) =>
  value.split(/[\n,]/).map((x) => x.trim()).filter(Boolean);

export function GestaoEntradaVeiculoDialog({
  open,
  userId,
  onOpenChange,
  onSaved,
}: Props) {
  const navigate = useNavigate();
  const crlvInputRef = useRef<HTMLInputElement>(null);
  const [vehicle, setVehicle] = useState(initialVehicle);
  const [origem, setOrigem] = useState<Origem>("compra");
  const [valorCompra, setValorCompra] = useState("");
  const [dataCompra, setDataCompra] = useState(hojeSaoPaulo());
  const [consignacao, setConsignacao] = useState<ConsignacaoFormValue>(
    emptyConsignacaoForm,
  );
  const [despesas, setDespesas] = useState<Despesa[]>([]);
  const [draftDespesa, setDraftDespesa] = useState<Despesa>({
    id: "",
    valor: "",
    data: hojeSaoPaulo(),
    categoria: "outros",
    descricao: "",
    descontar: false,
  });
  const [saving, setSaving] = useState(false);
  const [savedId, setSavedId] = useState<string | null>(null);
  const [readingCrlv, setReadingCrlv] = useState(false);
  const [pendingDocumentId, setPendingDocumentId] = useState<string | null>(
    null,
  );
  const [crlvReview, setCrlvReview] = useState<
    {
      documentoId: string;
      leitura: CrlvLeituraView;
    } | null
  >(null);

  const reset = () => {
    setVehicle(initialVehicle());
    setOrigem("compra");
    setValorCompra("");
    setDataCompra(hojeSaoPaulo());
    setConsignacao(emptyConsignacaoForm());
    setDespesas([]);
    setSavedId(null);
    setPendingDocumentId(null);
    setCrlvReview(null);
  };

  const uploadCrlv = async (file: File | null) => {
    if (!file) return;
    if (
      ![
        "application/pdf",
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/heic",
        "image/heif",
      ].includes(file.type)
    ) {
      toast.error("Envie PDF, JPG, PNG, WebP ou HEIC.");
      return;
    }
    if (!file.size || file.size > 15 * 1024 * 1024) {
      toast.error("O arquivo deve ter até 15 MB.");
      return;
    }
    setReadingCrlv(true);
    try {
      const base64 = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onerror = () => reject(new Error("Falha ao ler arquivo"));
        reader.onload = () =>
          resolve(String(reader.result).split(",")[1] ?? "");
        reader.readAsDataURL(file);
      });
      const { data, error } = await supabase.functions.invoke("gestao-cofre", {
        body: {
          action: "upload",
          base64,
          tipo: file.type === "application/pdf" ? "crlv_e" : "crlv",
          origem: "painel",
          mime: file.type,
          filename: file.name,
        },
      });
      if (error || data?.error) throw new Error(data?.error ?? error?.message);
      setPendingDocumentId(data.documento_id);
      if (data.leitura) {
        setCrlvReview({
          documentoId: data.documento_id,
          leitura: data.leitura,
        });
      } else {
        toast.warning(
          data.leitura_erro ??
            "Não consegui ler bem. Tire outra foto de cima, documento aberto, com boa luz",
        );
      }
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Falha ao ler o CRLV.",
      );
    } finally {
      setReadingCrlv(false);
      if (crlvInputRef.current) crlvInputRef.current.value = "";
    }
  };

  const addDespesa = () => {
    if (parseGestaoMoneyField(draftDespesa.valor) == null) {
      toast.error("Informe o valor da despesa.");
      return;
    }
    setDespesas((
      rows,
    ) => [...rows, { ...draftDespesa, id: crypto.randomUUID() }]);
    setDraftDespesa({
      id: "",
      valor: "",
      data: hojeSaoPaulo(),
      categoria: "outros",
      descricao: "",
      descontar: false,
    });
  };

  const save = async () => {
    if (!vehicle.marca.trim() || !vehicle.modelo.trim()) {
      toast.error("Informe marca e modelo.");
      return;
    }
    const placa = vehicle.placa.replace(/\W/g, "").toUpperCase();
    if (placa && placa.length !== 7) {
      toast.error("A placa deve ter 7 caracteres.");
      return;
    }
    const compra = origem === "consignacao"
      ? parseGestaoMoneyField(consignacao.valorGarantido) ?? 0
      : parseGestaoMoneyField(valorCompra);
    if (origem !== "consignacao" && compra == null) {
      toast.error("Informe o valor da compra/troca.");
      return;
    }

    const vehicleId = crypto.randomUUID();
    const fotos = photoList(vehicle.fotos);
    const preco = parseGestaoMoneyField(vehicle.preco);
    const status = statusInicialEntradaVeiculo({ fotos, preco });
    setSaving(true);
    try {
      const { error: veiculoError } = await supabase.from("veiculos_estoque")
        .insert({
          id: vehicleId,
          user_id: userId,
          segmento: vehicle.segmento,
          marca: vehicle.marca.trim(),
          modelo: vehicle.modelo.trim(),
          versao: vehicle.versao.trim() || null,
          ano_fabricacao: optionalNumber(vehicle.anoFabricacao),
          ano_modelo: optionalNumber(vehicle.anoModelo),
          km: optionalNumber(vehicle.km),
          cor: vehicle.cor.trim() || null,
          combustivel: vehicle.combustivel.trim() || null,
          cambio: vehicle.cambio.trim() || null,
          portas: optionalNumber(vehicle.portas),
          placa: placa || null,
          renavam: vehicle.renavam.trim() || null,
          chassi: vehicle.chassi.trim() || null,
          cilindrada_cc: optionalNumber(vehicle.cilindradaCc),
          preco,
          descricao: vehicle.descricao.trim() || null,
          fotos,
          status,
        } as never);
      if (veiculoError) throw veiculoError;

      if (origem === "consignacao") {
        await saveConsignacaoTermos(userId, vehicleId, consignacao, {
          syncCompra: true,
        });
      } else {
        const { error } = await supabase.from(
          "veiculo_compra" as "veiculos_estoque",
        )
          .insert({
            user_id: userId,
            veiculo_id: vehicleId,
            valor_compra: compra,
            data_compra: dataCompra,
            origem,
          });
        if (error) throw error;
      }

      if (despesas.length) {
        const { error } = await supabase.from(
          "veiculo_despesas" as "veiculos_estoque",
        )
          .insert(despesas.map((d) => ({
            user_id: userId,
            veiculo_id: vehicleId,
            valor: parseGestaoMoneyField(d.valor),
            data: d.data,
            categoria: d.categoria,
            descricao: d.descricao.trim() || null,
            descontar_do_consignante: origem === "consignacao" && d.descontar,
            origem_lancamento: "painel",
            lancado_por: "painel",
          })));
        if (error) throw error;
      }

      if (pendingDocumentId) {
        const { data, error } = await supabase.functions.invoke(
          "gestao-cofre",
          {
            body: {
              action: "vincular",
              documento_id: pendingDocumentId,
              veiculo_id: vehicleId,
            },
          },
        );
        if (error || data?.error) {
          throw new Error(data?.error ?? error?.message);
        }
      }

      setSavedId(vehicleId);
      toast.success(
        status === "disponivel"
          ? "Veículo adicionado ao estoque e liberado na vitrine."
          : "Veículo adicionado em preparação. Complete foto e preço para liberar.",
      );
      onSaved();
    } catch (error) {
      await supabase.from("veiculos_estoque").delete()
        .eq("id", vehicleId)
        .eq("user_id", userId);
      toast.error(
        `A entrada não foi concluída; nenhum registro foi mantido. ${
          error instanceof Error ? error.message : "Revise os dados."
        }`,
      );
    } finally {
      setSaving(false);
    }
  };

  const field = (
    label: string,
    key: keyof ReturnType<typeof initialVehicle>,
    type = "text",
  ) => (
    <div>
      <Label>{label}</Label>
      <Input
        type={type}
        value={vehicle[key]}
        onChange={(e) => setVehicle({ ...vehicle, [key]: e.target.value })}
      />
    </div>
  );

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) reset();
        onOpenChange(next);
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-3xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Entrada de veículo</DialogTitle>
        </DialogHeader>
        {savedId
          ? (
            <div className="space-y-4 py-4">
              <p className="text-sm">
                O carro já aparece na Gestão e no Giro 30-60-90.
              </p>
              <Button onClick={() => navigate(`/veiculos?edit=${savedId}`)}>
                Completar anúncio
              </Button>
            </div>
          )
          : (
            <div className="space-y-5">
              <div className="rounded-md border border-dashed p-3">
                <input
                  ref={crlvInputRef}
                  type="file"
                  className="hidden"
                  accept=".pdf,.jpg,.jpeg,.png,.webp,.heic,.heif"
                  onChange={(event) =>
                    void uploadCrlv(event.target.files?.[0] ?? null)}
                />
                <Button
                  type="button"
                  variant="outline"
                  disabled={readingCrlv}
                  onClick={() => crlvInputRef.current?.click()}
                >
                  {readingCrlv
                    ? <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    : <FileText className="mr-2 h-4 w-4" />}
                  {readingCrlv ? "Lendo documento…" : "Começar pelo documento"}
                </Button>
                {pendingDocumentId && (
                  <p className="mt-2 text-xs text-muted-foreground">
                    CRLV guardado no cofre e pronto para vincular ao novo
                    veículo.
                  </p>
                )}
              </div>
              <div className="grid gap-3 sm:grid-cols-3">
                <div>
                  <Label>Segmento</Label>
                  <Select
                    value={vehicle.segmento}
                    onValueChange={(segmento) =>
                      setVehicle({ ...vehicle, segmento })}
                  >
                    <SelectTrigger>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="carro">Carro</SelectItem>
                      <SelectItem value="moto">Moto</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                {field("Marca *", "marca")}
                {field("Modelo *", "modelo")}
                {field("Versão", "versao")}
                {field("Ano fabricação", "anoFabricacao", "number")}
                {field("Ano modelo", "anoModelo", "number")}
                {field("Km", "km", "number")}
                {field("Cor", "cor")}
                {field("Combustível", "combustivel")}
                {field("Câmbio", "cambio")}
                {field("Portas", "portas", "number")}
                <div>
                  <Label>Placa</Label>
                  <Input
                    value={vehicle.placa}
                    maxLength={8}
                    placeholder="Ex.: ABC1D23"
                    onChange={(e) =>
                      setVehicle({ ...vehicle, placa: e.target.value })}
                  />
                </div>
                {field("RENAVAM", "renavam")}
                {field("Chassi", "chassi")}
                {field("Cilindrada (cc)", "cilindradaCc", "number")}
                <GestaoMoneyInput
                  label="Preço de venda"
                  value={vehicle.preco}
                  onChange={(preco) => setVehicle({ ...vehicle, preco })}
                />
              </div>

              <div className="space-y-3 border-t pt-4">
                <Label>Origem</Label>
                <Select
                  value={origem}
                  onValueChange={(v) => setOrigem(v as Origem)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="compra">Compra</SelectItem>
                    <SelectItem value="troca">Troca</SelectItem>
                    <SelectItem value="consignacao">Consignação</SelectItem>
                  </SelectContent>
                </Select>
                {origem === "consignacao"
                  ? (
                    <ConsignacaoTermosFields
                      value={consignacao}
                      onChange={setConsignacao}
                      disabled={saving}
                    />
                  )
                  : (
                    <div className="grid gap-3 sm:grid-cols-2">
                      <GestaoMoneyInput
                        label="Valor"
                        value={valorCompra}
                        onChange={setValorCompra}
                      />
                      <div>
                        <Label>Data</Label>
                        <Input
                          type="date"
                          value={dataCompra}
                          onChange={(e) => setDataCompra(e.target.value)}
                        />
                      </div>
                    </div>
                  )}
              </div>

              <div className="space-y-3 border-t pt-4">
                <h3 className="text-sm font-semibold">Despesas iniciais</h3>
                {despesas.map((d) => (
                  <div
                    key={d.id}
                    className="flex items-center justify-between rounded border p-2 text-sm"
                  >
                    <span>
                      R$ {d.valor} · {d.categoria}
                      {d.descontar ? " · descontar do dono" : ""}
                    </span>
                    <Button
                      type="button"
                      size="icon"
                      variant="ghost"
                      onClick={() =>
                        setDespesas((rows) =>
                          rows.filter((x) => x.id !== d.id)
                        )}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                ))}
                <div className="grid gap-2 sm:grid-cols-2">
                  <GestaoMoneyInput
                    label="Valor"
                    value={draftDespesa.valor}
                    onChange={(valor) =>
                      setDraftDespesa({ ...draftDespesa, valor })}
                  />
                  <div>
                    <Label>Data</Label>
                    <Input
                      type="date"
                      value={draftDespesa.data}
                      onChange={(e) => setDraftDespesa({
                        ...draftDespesa,
                        data: e.target.value,
                      })}
                    />
                  </div>
                  <div>
                    <Label>Categoria</Label>
                    <Select
                      value={draftDespesa.categoria}
                      onValueChange={(categoria) =>
                        setDraftDespesa({ ...draftDespesa, categoria })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        {GESTAO_DESPESA_CATEGORIAS.map((c) => (
                          <SelectItem key={c.value} value={c.value}>
                            {c.label}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div>
                    <Label>Descrição</Label>
                    <Input
                      value={draftDespesa.descricao}
                      onChange={(e) =>
                        setDraftDespesa({
                          ...draftDespesa,
                          descricao: e.target.value,
                        })}
                    />
                  </div>
                  {origem === "consignacao" && (
                    <label className="flex items-center gap-2 text-sm">
                      <input
                        type="checkbox"
                        checked={draftDespesa.descontar}
                        onChange={(e) =>
                          setDraftDespesa({
                            ...draftDespesa,
                            descontar: e.target.checked,
                          })}
                      />Descontar do dono
                    </label>
                  )}
                </div>
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={addDespesa}
                >
                  + Adicionar despesa
                </Button>
              </div>

              <div className="grid gap-3 border-t pt-4 sm:grid-cols-2">
                <div>
                  <Label>Fotos (URLs, opcionais)</Label>
                  <Textarea
                    rows={3}
                    value={vehicle.fotos}
                    onChange={(e) =>
                      setVehicle({ ...vehicle, fotos: e.target.value })}
                  />
                </div>
                <div>
                  <Label>Descrição (opcional)</Label>
                  <Textarea
                    rows={3}
                    value={vehicle.descricao}
                    onChange={(e) =>
                      setVehicle({ ...vehicle, descricao: e.target.value })}
                  />
                </div>
              </div>
            </div>
          )}
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Fechar
          </Button>
          {!savedId && (
            <Button disabled={saving} onClick={() => void save()}>
              {saving
                ? <Loader2 className="h-4 w-4 animate-spin" />
                : "Salvar entrada"}
            </Button>
          )}
        </DialogFooter>
        {crlvReview && (
          <GestaoCrlvConferencia
            open
            onOpenChange={(next) => {
              if (!next) setCrlvReview(null);
            }}
            documentoId={crlvReview.documentoId}
            leitura={crlvReview.leitura}
            onConfirmed={(values) => {
              const parsed = crlvValuesForStock(crlvReview.leitura);
              setVehicle((current) => ({
                ...current,
                marca: String(values.marca ?? parsed.marca ?? current.marca),
                modelo: String(
                  values.modelo ?? parsed.modelo ?? current.modelo,
                ),
                versao: String(
                  values.versao ?? parsed.versao ?? current.versao,
                ),
                anoFabricacao: String(
                  values.ano_fabricacao ?? parsed.ano_fabricacao ??
                    current.anoFabricacao,
                ),
                anoModelo: String(
                  values.ano_modelo ?? parsed.ano_modelo ?? current.anoModelo,
                ),
                cor: String(values.cor ?? parsed.cor ?? current.cor),
                combustivel: String(
                  values.combustivel ?? parsed.combustivel ??
                    current.combustivel,
                ),
                placa: String(values.placa ?? parsed.placa ?? current.placa),
                renavam: String(
                  values.renavam ?? parsed.renavam ?? current.renavam,
                ),
                chassi: String(
                  values.chassi ?? parsed.chassi ?? current.chassi,
                ),
                cilindradaCc: String(
                  values.cilindrada_cc ?? parsed.cilindrada_cc ??
                    current.cilindradaCc,
                ),
              }));
              setCrlvReview(null);
            }}
          />
        )}
      </DialogContent>
    </Dialog>
  );
}
