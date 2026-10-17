import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Collapsible,
  CollapsibleContent,
  CollapsibleTrigger,
} from "@/components/ui/collapsible";
import {
  applyComissaoRegraModo,
  calcGestaoComissao,
  detectComissaoRegraModo,
  normalizeComissaoRegra,
  type ComissaoRegraModo,
  type GestaoComissaoRegraJson,
  type GestaoFaixaMargem,
} from "../../../../supabase/functions/_shared/gestao-comissao-calc.ts";
import { GestaoMoneyInput } from "@/components/gestao/lucro/GestaoMoneyInput.tsx";
import { formatGestaoMoney } from "@/lib/gestao-format.ts";
import { parseGestaoMoneyField } from "@/lib/gestao-money.ts";
import { ChevronDown } from "lucide-react";

const PREVIEW_VENDA = 300_000;
const PREVIEW_LUCRO = 25_000;

type Props = {
  title: string;
  regra: GestaoComissaoRegraJson;
  onChange: (r: GestaoComissaoRegraJson) => void;
  onSave: () => void;
  saveLabel?: string;
};

function pctInput(val: number | null, on: (v: number | null) => void) {
  return (
    <Input
      type="number"
      step="0.01"
      min={0}
      placeholder="0"
      value={val ?? ""}
      onChange={(e) => {
        const raw = e.target.value;
        on(raw === "" ? null : Number(raw));
      }}
    />
  );
}

export function GestaoComissaoRegraForm({ title, regra, onChange, onSave, saveLabel }: Props) {
  const normalized = useMemo(() => normalizeComissaoRegra(regra), [regra]);
  const modo = detectComissaoRegraModo(normalized);
  const [advancedOpen, setAdvancedOpen] = useState(false);

  const previewValor = useMemo(() => {
    const margem = (PREVIEW_LUCRO / PREVIEW_VENDA) * 100;
    return calcGestaoComissao({
      valorVenda: PREVIEW_VENDA,
      lucroLiquido: PREVIEW_LUCRO,
      margemPct: margem,
      regra: normalized,
    }).total;
  }, [normalized]);

  const set = (patch: Partial<GestaoComissaoRegraJson>) => {
    onChange(normalizeComissaoRegra({ ...normalized, ...patch }));
  };

  const setModo = (m: ComissaoRegraModo) => {
    onChange(applyComissaoRegraModo(normalized, m));
  };

  const updateFaixa = (index: number, patch: Partial<GestaoFaixaMargem>) => {
    const next = [...normalized.faixasMargem];
    next[index] = { ...next[index], ...patch };
    set({ faixasMargem: next });
  };

  const addFaixa = () => {
    set({
      faixasMargem: [
        ...normalized.faixasMargem,
        { margemMinInclusive: 0, margemMaxExclusive: null, pctSobreLucro: 1 },
      ],
    });
  };

  const exemplo = `Carro vendido por ${formatGestaoMoney(PREVIEW_VENDA)} → vendedor recebe ${formatGestaoMoney(previewValor)}`;

  return (
    <div className="space-y-4 rounded-lg border p-4">
      <h3 className="font-semibold">{title}</h3>

      <div className="space-y-2">
        <Label className="text-sm">Como o vendedor ganha?</Label>
        <RadioGroup value={modo} onValueChange={(v) => setModo(v as ComissaoRegraModo)} className="gap-2">
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <RadioGroupItem value="pct_venda" />
            % do valor de venda (bruto) — recomendado
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <RadioGroupItem value="pct_lucro" />
            % do lucro
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <RadioGroupItem value="fixo" />
            Valor fixo por carro
          </label>
          <label className="flex cursor-pointer items-center gap-2 text-sm">
            <RadioGroupItem value="faixas" />
            Faixas por margem (avançado)
          </label>
        </RadioGroup>
      </div>

      {modo === "pct_venda" && (
        <div>
          <Label className="text-xs">Percentual sobre a venda (%)</Label>
          {pctInput(normalized.pctSobreVenda, (v) => set({ pctSobreVenda: v }))}
        </div>
      )}
      {modo === "pct_lucro" && (
        <div>
          <Label className="text-xs">Percentual sobre o lucro (%)</Label>
          {pctInput(normalized.pctSobreLucro, (v) => set({ pctSobreLucro: v }))}
        </div>
      )}
      {modo === "fixo" && (
        <GestaoMoneyInput
          label="Valor fixo por carro (R$)"
          value={normalized.fixoPorCarro != null ? String(normalized.fixoPorCarro) : ""}
          onChange={(raw) => set({ fixoPorCarro: raw ? parseGestaoMoneyField(raw) : null })}
        />
      )}
      {modo === "faixas" && (
        <div className="space-y-2">
          <p className="text-xs text-muted-foreground">Comissão (% do lucro) conforme margem bruta do carro.</p>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[420px] text-sm">
              <thead>
                <tr className="border-b text-left text-muted-foreground">
                  <th className="pb-1 pr-2">De (%)</th>
                  <th className="pb-1 pr-2">Até (%)</th>
                  <th className="pb-1 pr-2">% lucro</th>
                </tr>
              </thead>
              <tbody>
                {normalized.faixasMargem.map((f, i) => (
                  <tr key={i} className="border-b">
                    <td className="py-1 pr-2">
                      <Input
                        type="number"
                        className="h-8"
                        value={f.margemMinInclusive}
                        onChange={(e) => updateFaixa(i, { margemMinInclusive: Number(e.target.value) })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        type="number"
                        className="h-8"
                        placeholder="∞"
                        value={f.margemMaxExclusive ?? ""}
                        onChange={(e) => updateFaixa(i, {
                          margemMaxExclusive: e.target.value === "" ? null : Number(e.target.value),
                        })}
                      />
                    </td>
                    <td className="py-1 pr-2">
                      <Input
                        type="number"
                        step="0.01"
                        className="h-8"
                        value={f.pctSobreLucro}
                        onChange={(e) => updateFaixa(i, { pctSobreLucro: Number(e.target.value) })}
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={addFaixa}>+ faixa</Button>
        </div>
      )}

      <p className="rounded-md bg-muted/50 p-3 text-sm">{exemplo}</p>

      <Collapsible open={advancedOpen} onOpenChange={setAdvancedOpen}>
        <CollapsibleTrigger className="flex w-full items-center justify-between rounded-md border px-3 py-2 text-sm font-medium">
          Opções avançadas (gerente)
          <ChevronDown className={`h-4 w-4 transition-transform ${advancedOpen ? "rotate-180" : ""}`} />
        </CollapsibleTrigger>
        <CollapsibleContent className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <Label className="text-xs">Gerente — % sobre comissão da equipe</Label>
            {pctInput(normalized.gerentePctSobreComissaoEquipe, (v) =>
              set({
                gerentePctSobreComissaoEquipe: v,
                gerentePctSobreVenda: v != null ? null : normalized.gerentePctSobreVenda,
              })
            )}
          </div>
          <div>
            <Label className="text-xs">Gerente — % sobre a venda</Label>
            {pctInput(normalized.gerentePctSobreVenda, (v) =>
              set({
                gerentePctSobreVenda: v,
                gerentePctSobreComissaoEquipe: v != null ? null : normalized.gerentePctSobreComissaoEquipe,
              })
            )}
          </div>
        </CollapsibleContent>
      </Collapsible>

      <Button type="button" onClick={onSave}>{saveLabel ?? "Salvar regra"}</Button>
    </div>
  );
}
