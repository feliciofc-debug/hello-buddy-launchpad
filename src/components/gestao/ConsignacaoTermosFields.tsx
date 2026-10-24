import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { GestaoMoneyInput } from "@/components/gestao/lucro/GestaoMoneyInput.tsx";
import type { ConsignacaoFormValue } from "@/lib/consignacao-form.ts";

type Props = {
  value: ConsignacaoFormValue;
  onChange: (value: ConsignacaoFormValue) => void;
  disabled?: boolean;
  showConsignante?: boolean;
  showObservation?: boolean;
};

export function ConsignacaoTermosFields({
  value,
  onChange,
  disabled = false,
  showConsignante = true,
  showObservation = true,
}: Props) {
  const set = (patch: Partial<ConsignacaoFormValue>) =>
    onChange({ ...value, ...patch });

  return (
    <div className="space-y-3 rounded-lg border border-blue-200 p-3">
      <div>
        <h3 className="text-sm font-semibold">Termos da consignação</h3>
        <p className="text-xs text-muted-foreground">
          O valor garantido não entra como capital, juros ou IPVA da loja.
        </p>
      </div>
      <div className="flex flex-wrap gap-2">
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => set({ pctLoja: "100", pisoLoja: "" })}>
          Valor fixo
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => set({ valorGarantido: "0", pctLoja: "8", pisoLoja: "5000" })}>
          Comissão
        </Button>
        <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => set({ pctLoja: "50", pisoLoja: "" })}>
          Híbrido
        </Button>
      </div>
      <div className="grid gap-2 sm:grid-cols-2">
        {showConsignante && (
          <div>
            <Label>Nome do consignante</Label>
            <Input disabled={disabled} value={value.consignanteNome} onChange={(e) => set({ consignanteNome: e.target.value })} />
          </div>
        )}
        <GestaoMoneyInput label="Valor garantido ao dono" value={value.valorGarantido} onChange={(valorGarantido) => set({ valorGarantido })} />
        <div>
          <Label>Percentual da loja no excedente (%)</Label>
          <Input disabled={disabled} type="number" min="0" max="100" step="0.01" value={value.pctLoja} onChange={(e) => set({ pctLoja: e.target.value })} />
        </div>
        <GestaoMoneyInput label="Piso da loja" value={value.pisoLoja} onChange={(pisoLoja) => set({ pisoLoja })} />
        <GestaoMoneyInput label="Preço mínimo autorizado" value={value.precoMinimo} onChange={(precoMinimo) => set({ precoMinimo })} />
        <div>
          <Label>Data de início</Label>
          <Input disabled={disabled} type="date" value={value.dataInicio} onChange={(e) => set({ dataInicio: e.target.value })} />
        </div>
        <div>
          <Label>Prazo (dias)</Label>
          <Input disabled={disabled} type="number" min="1" value={value.prazoDias} onChange={(e) => set({ prazoDias: e.target.value })} />
        </div>
        {showObservation && (
          <div>
            <Label>Observação</Label>
            <Input disabled={disabled} value={value.observacao} onChange={(e) => set({ observacao: e.target.value })} />
          </div>
        )}
      </div>
    </div>
  );
}
