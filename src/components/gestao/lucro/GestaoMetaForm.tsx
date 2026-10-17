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
import type { GestaoMetaConfigJson, GestaoBonusEscalonado } from "../../../../supabase/functions/_shared/gestao-meta-calc.ts";
import { GestaoMoneyInput } from "@/components/gestao/lucro/GestaoMoneyInput.tsx";
import { parseGestaoMoneyField } from "@/lib/gestao-money.ts";

type Props = {
  meta: GestaoMetaConfigJson;
  onChange: (m: GestaoMetaConfigJson) => void;
  onSave: () => void;
  metaLabel?: string;
};

export function GestaoMetaForm({ meta, onChange, onSave, metaLabel }: Props) {
  const setBonus = (index: number, patch: Partial<GestaoBonusEscalonado>) => {
    const next = [...meta.bonusEscalonado];
    next[index] = { ...next[index], ...patch };
    onChange({ ...meta, bonusEscalonado: next });
  };

  const addFaixaBonus = () => {
    onChange({
      ...meta,
      bonusEscalonado: [...meta.bonusEscalonado, { pctMeta: 100, bonus: 0 }],
    });
  };

  return (
    <div className="space-y-3">
      <div>
        <Label>Tipo de meta</Label>
        <Select
          value={meta.tipo}
          onValueChange={(v) => onChange({ ...meta, tipo: v as GestaoMetaConfigJson["tipo"] })}
        >
          <SelectTrigger><SelectValue /></SelectTrigger>
          <SelectContent>
            <SelectItem value="qtd">Quantidade de carros</SelectItem>
            <SelectItem value="faturamento">Faturamento (R$)</SelectItem>
            <SelectItem value="lucro">Lucro (R$)</SelectItem>
          </SelectContent>
        </Select>
      </div>

      <div>
        <Label>{metaLabel ?? "Valor da meta"}</Label>
        {meta.tipo === "qtd" ? (
          <Input
            type="number"
            min={1}
            value={meta.metaValor}
            onChange={(e) => onChange({ ...meta, metaValor: Number(e.target.value) })}
          />
        ) : (
          <GestaoMoneyInput
            value={String(meta.metaValor)}
            onChange={(raw) => {
              const v = parseGestaoMoneyField(raw);
              if (v != null) onChange({ ...meta, metaValor: v });
            }}
          />
        )}
      </div>

      <div>
        <Label className="text-xs">Bônus por carro parado +90 dias vendido (R$)</Label>
        <GestaoMoneyInput
          value={String(meta.bonusCarroParado90)}
          onChange={(raw) => {
            const v = parseGestaoMoneyField(raw, { allowZero: true });
            onChange({ ...meta, bonusCarroParado90: v ?? 0 });
          }}
        />
      </div>

      <div className="space-y-2">
        <Label className="text-xs">Faixas de bônus (atingimento → valor)</Label>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b text-left text-muted-foreground">
              <th className="pb-1 pr-2">Atingir (% meta)</th>
              <th className="pb-1 pr-2">Bônus (R$)</th>
            </tr>
          </thead>
          <tbody>
            {meta.bonusEscalonado.map((b, i) => (
              <tr key={i} className="border-b">
                <td className="py-1 pr-2">
                  <Input
                    type="number"
                    className="h-8"
                    value={b.pctMeta}
                    onChange={(e) => setBonus(i, { pctMeta: Number(e.target.value) })}
                  />
                </td>
                <td className="py-1 pr-2">
                  <GestaoMoneyInput
                    value={String(b.bonus)}
                    onChange={(raw) => {
                      const v = parseGestaoMoneyField(raw, { allowZero: true });
                      if (v != null) setBonus(i, { bonus: v });
                    }}
                  />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        <Button type="button" variant="outline" size="sm" onClick={addFaixaBonus}>+ faixa bônus</Button>
      </div>

      <Button type="button" variant="outline" onClick={onSave}>Salvar meta</Button>
    </div>
  );
}
